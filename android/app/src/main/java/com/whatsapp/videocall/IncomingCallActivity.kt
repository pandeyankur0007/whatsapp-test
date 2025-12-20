package com.whatsapp.videocall

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.ImageView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import android.media.Ringtone
import android.media.RingtoneManager
import android.net.Uri
import android.os.Handler
import android.os.Looper
import com.bumptech.glide.Glide
import android.content.BroadcastReceiver
import android.content.Context
import android.content.IntentFilter
import android.util.Log
import androidx.core.content.ContextCompat

class IncomingCallActivity : AppCompatActivity() {

    private lateinit var callerName: String
    private lateinit var roomName: String
    private var callerAvatar: String? = null
    private var livekitToken: String? = null
    private var callerToken: String? = null
    
    // Ringtone
    private var ringtone: Ringtone? = null
    private val handler = Handler(Looper.getMainLooper())

    private val stopRingingRunnable = Runnable { stopRinging() }

    private val callEndedReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == "com.whatsapp.videocall.ACTION_CALL_ENDED") {
                val endRoomName = intent.getStringExtra("ROOM_NAME")
                if (endRoomName == roomName) {
                    stopRinging()
                    finish()
                }
            }
        }
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        // Ensure screen turns on and keyguard acts appropriately
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                android.view.WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                android.view.WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                android.view.WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
                android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            )
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Ensure activity shows on lock screen
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            val keyguardManager = getSystemService(android.app.KeyguardManager::class.java)
            keyguardManager?.requestDismissKeyguard(this, null)
        }
        
        // Legacy flags - apply concurrently for maximum compatibility (some OEMs ignore the new APIs)
        @Suppress("DEPRECATION")
        window.addFlags(
            android.view.WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
            android.view.WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
            android.view.WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
            android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
        )

        setContentView(R.layout.activity_incoming_call)

        // Register Receiver
        // Register Receiver
        val filter = IntentFilter("com.whatsapp.videocall.ACTION_CALL_ENDED")
        ContextCompat.registerReceiver(this, callEndedReceiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED)

        // Get call data from intent
        callerName = intent.getStringExtra("CALLER_NAME") ?: "Unknown Caller"
        roomName = intent.getStringExtra("ROOM_NAME") ?: ""
        callerAvatar = intent.getStringExtra("CALLER_AVATAR")
        livekitToken = intent.getStringExtra("LIVEKIT_TOKEN")
        callerToken = intent.getStringExtra("CALLER_TOKEN")

        // Cancel the notification that launched this activity
        val notificationManager = getSystemService(android.content.Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
        notificationManager.cancel(roomName.hashCode())

        // Setup UI
        setupUI()
        // Setup UI
        setupUI()
        
        // Start Ringing
        startRinging()
        
        // Auto-reject after 60 seconds
        handler.postDelayed(stopRingingRunnable, 60000)

        // Handle back button dispatch
        onBackPressedDispatcher.addCallback(this, object : androidx.activity.OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                // Prevent back button during incoming call
                // User must explicitly accept or reject
            }
        })
    }
    
    private fun startRinging() {
        try {
            val notification = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            ringtone = RingtoneManager.getRingtone(applicationContext, notification)
            
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
                ringtone?.audioAttributes = android.media.AudioAttributes.Builder()
                    .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            }
            
            ringtone?.play()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
    
    private fun stopRinging() {
        try {
            ringtone?.stop()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
    
    override fun onDestroy() {
        super.onDestroy()
        stopRinging()
        stopRinging()
        handler.removeCallbacks(stopRingingRunnable)
        try {
            unregisterReceiver(callEndedReceiver)
        } catch (e: Exception) {
            // Receiver might not be registered or already unregistered
        }
    }

    private fun setupUI() {
        val callerNameText = findViewById<TextView>(R.id.caller_name)
        val callerAvatarView = findViewById<ImageView>(R.id.caller_avatar)
        val callerInitials = findViewById<TextView>(R.id.caller_initials)
        val acceptButton = findViewById<Button>(R.id.btn_accept)
        val rejectButton = findViewById<Button>(R.id.btn_reject)

        callerNameText.text = callerName

        // Load avatar or show initials
        if (!callerAvatar.isNullOrEmpty()) {
            Glide.with(this)
                .load(callerAvatar)
                .circleCrop()
                .into(callerAvatarView)
            callerInitials.visibility = android.view.View.GONE
            callerAvatarView.visibility = android.view.View.VISIBLE
        } else {
            callerInitials.text = callerName.take(1).uppercase()
            callerInitials.visibility = android.view.View.VISIBLE
            callerAvatarView.visibility = android.view.View.GONE
        }

        // Accept call
        acceptButton.setOnClickListener {
            acceptCall()
        }

        // Reject call
        rejectButton.setOnClickListener {
            rejectCall()
        }
    }

    private fun acceptCall() {
        stopRinging()
        // Launch CallActivity
        val intent = Intent(this, CallActivity::class.java).apply {
            putExtra("ROOM_NAME", roomName)
            putExtra("IS_INCOMING", true)
            if (!livekitToken.isNullOrEmpty()) {
                putExtra("TOKEN", livekitToken)
                // Also pass URL if available, but CallActivity might default it or we can pass it if we knew it to be safe.
                // Since we don't have the URL here easily (unless hardcoded), we rely on CallActivity's default or we should pass it from server too.
                // However, CallActivity.kt expects URL if TOKEN is present.
                putExtra("URL", "https://ultra-poject-ebwwosad.livekit.cloud") // Hardcoded from CallActivity.kt as a fallback/default
            }
        }
        startActivity(intent)
        finish()
    }


        
    private fun rejectCall() {
        stopRinging()
        
        // Notify server
        val urlString = "http://192.168.1.3:3000/call/action" // Use IP from server log
        
        Thread {
            try {
                if (callerToken.isNullOrEmpty()) {
                    Log.d("IncomingCall", "No callerToken available, cannot send rejection")
                    return@Thread
                }

                Log.d("IncomingCall", "Sending rejection to caller with token: ${callerToken?.take(10)}...")
                
                val json = org.json.JSONObject()
                json.put("action", "reject")
                json.put("roomName", roomName)
                json.put("recipientToken", callerToken) // Send rejection TO caller
                
                val url = java.net.URL(urlString)
                val conn = url.openConnection() as java.net.HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8")
                conn.doOutput = true
                
                val os = conn.outputStream
                os.write(json.toString().toByteArray(java.nio.charset.StandardCharsets.UTF_8))
                os.close()

                Log.d("IncomingCall", "Reject signal sent: " + conn.responseCode)
                conn.disconnect()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }.start()
        
        finish()
    }

}
