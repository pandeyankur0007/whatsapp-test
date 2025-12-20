package com.whatsapp.videocall

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.View
import android.widget.ImageButton
import android.widget.ProgressBar
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import io.livekit.android.LiveKit
import io.livekit.android.events.RoomEvent
import io.livekit.android.events.collect
import io.livekit.android.renderer.TextureViewRenderer
import io.livekit.android.room.Room
import io.livekit.android.room.participant.Participant
import io.livekit.android.room.participant.RemoteParticipant
import io.livekit.android.room.track.Track
import io.livekit.android.room.track.VideoTrack
import kotlinx.coroutines.launch
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter

import android.widget.ImageView
import android.widget.TextView
import io.livekit.android.events.ParticipantEvent
import io.livekit.android.room.participant.ConnectionQuality
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import android.util.Base64

class CallActivity : AppCompatActivity() {

    private lateinit var room: Room
    private lateinit var remoteVideoView: TextureViewRenderer
    private lateinit var localVideoView: TextureViewRenderer
    private lateinit var progressBar: ProgressBar

    private var isMuted = false
    private var isVideoOff = false
    private var hasPermissions = false
    
    // Store URL and token for permission callback
    private var pendingUrl: String? = null
    private var pendingToken: String? = null
    
    // Store recipient token if we are the caller
    private var recipientToken: String? = null
    private var roomName: String? = null

    // Indicator Views
    private lateinit var remoteName: TextView
    private lateinit var remoteMutedIndicator: ImageView
    private lateinit var remoteNetworkQuality: ImageView
    private lateinit var remoteSpeakingIndicator: View
    private lateinit var remotePlaceholder: View
    
    private lateinit var localMutedIndicator: ImageView
    private lateinit var localPlaceholder: View

    private val callEndedReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
             if (intent?.action == "com.whatsapp.videocall.ACTION_CALL_ENDED") {
                 disconnectAndFinish()
             }
        }
    }

    // Permission launcher - must be registered before onCreate completes
    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        if (results.all { it.value }) {
            hasPermissions = true
            // Connect to room after permissions granted
            pendingUrl?.let { url ->
                pendingToken?.let { token ->
                    connectToRoom(url, token)
                }
            }
        } else {
            Toast.makeText(this, "Camera and microphone permissions are required for video calls", Toast.LENGTH_LONG).show()
            finish()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_call)

        // Initialize Views
        remoteVideoView = findViewById(R.id.remote_video_view)
        localVideoView = findViewById(R.id.local_video_view)
        progressBar = findViewById(R.id.progress_bar)

        remoteName = findViewById(R.id.remote_name)
        remoteMutedIndicator = findViewById(R.id.remote_muted_indicator)
        remoteNetworkQuality = findViewById(R.id.remote_network_quality)
        remoteSpeakingIndicator = findViewById(R.id.remote_speaking_indicator)
        remotePlaceholder = findViewById(R.id.remote_placeholder)

        localMutedIndicator = findViewById(R.id.local_muted_indicator)
        localPlaceholder = findViewById(R.id.local_placeholder)

        val btnEndCall = findViewById<ImageButton>(R.id.btn_end_call)
        val btnMute = findViewById<ImageButton>(R.id.btn_mute)
        val btnVideo = findViewById<ImageButton>(R.id.btn_video)
        val btnSwitchCamera = findViewById<ImageButton>(R.id.btn_switch_camera)
        val btnAudio = findViewById<ImageButton>(R.id.btn_audio_output)

        // Setup Buttons
        btnEndCall.setOnClickListener { disconnectAndFinish() }

        btnMute.setOnClickListener {
            isMuted = !isMuted
            lifecycleScope.launch {
                room.localParticipant.setMicrophoneEnabled(!isMuted)
            }
            btnMute.alpha = if (isMuted) 0.5f else 1.0f
        }

        btnVideo.setOnClickListener {
            isVideoOff = !isVideoOff
            lifecycleScope.launch {
                room.localParticipant.setCameraEnabled(!isVideoOff)
            }
            btnVideo.alpha = if (isVideoOff) 0.5f else 1.0f
        }

        btnSwitchCamera.setOnClickListener {
            val track = room.localParticipant.getTrackPublication(Track.Source.CAMERA)?.track as? io.livekit.android.room.track.LocalVideoTrack
            lifecycleScope.launch {
                track?.switchCamera()
            }
        }

        btnAudio.setOnClickListener {
            showAudioDeviceSelectionDialog()
        }

        // Get Intent Data
        // Get Intent Data
        val url = intent.getStringExtra("URL") ?: ""
        val token = intent.getStringExtra("TOKEN") ?: ""
        recipientToken = intent.getStringExtra("RECIPIENT_TOKEN")
        roomName = intent.getStringExtra("ROOM_NAME")

        if (url.isEmpty() || token.isEmpty()) {
            Toast.makeText(this, "Check your connection", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        // Initialize Room
        room = LiveKit.create(applicationContext)

        // Initialize Renderers
        room.initVideoRenderer(remoteVideoView)
        room.initVideoRenderer(localVideoView)

        val isIncoming = intent.getBooleanExtra("IS_INCOMING", false)

        if (token.isNotEmpty()) {
             // We have a token (likely outgoing)
             checkPermissionsAndConnect(url, token)
        } else if (intent.hasExtra("ROOM_NAME") && isIncoming) {
             // Incoming call with no token - fetch one
             val roomName = intent.getStringExtra("ROOM_NAME") ?: ""
             val fetchUrl = "https://ultra-poject-ebwwosad.livekit.cloud" // Default from JS

             lifecycleScope.launch {
                 val fetchedToken = fetchToken(roomName, "Recipient") // Or use stored identity
                 if (fetchedToken != null) {
                     checkPermissionsAndConnect(fetchUrl, fetchedToken)
                 } else {
                     Toast.makeText(this@CallActivity, "Failed to get token", Toast.LENGTH_LONG).show()
                     finish()
                 }
             }
        } else {
            // No token and not a valid incoming setup
             Toast.makeText(this, "Check your connection", Toast.LENGTH_SHORT).show()
             finish()
        }
        
        // Register Receiver
        val filter = IntentFilter("com.whatsapp.videocall.ACTION_CALL_ENDED")
        ContextCompat.registerReceiver(this, callEndedReceiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED)
    }

    private suspend fun fetchToken(roomName: String, participantName: String): String? {
        return withContext(Dispatchers.IO) {
            try {
                // TRY 1: Fetch from Backend (Set this in your code)
                val apiUrl = "YOUR_BACKEND_API_URL" // e.g., "https://your-app.firebaseapp.com"
                if (!apiUrl.contains("YOUR_BACKEND")) {
                     val url = URL("$apiUrl/token?roomName=$roomName&participantName=$participantName")
                     val conn = url.openConnection() as HttpURLConnection
                     conn.requestMethod = "GET"
                     if (conn.responseCode == 200) {
                         val reader = BufferedReader(InputStreamReader(conn.inputStream))
                         val response = StringBuilder()
                         var line: String?
                         while (reader.readLine().also { line = it } != null) {
                             response.append(line)
                         }
                         reader.close()
                         val json = JSONObject(response.toString())
                         return@withContext json.getString("token")
                     }
                }

                // TRY 2: Generate Demo Token (Fallback for testing)
                // WARNING: Do not ship secrets in production app!
                val apiKey = "YOUR_LIVEKIT_API_KEY"
                val apiSecret = "YOUR_LIVEKIT_API_SECRET"
                
                if (!apiKey.contains("YOUR_LIVEKIT")) {
                    return@withContext generateDemoToken(apiKey, apiSecret, roomName, participantName)
                }

                null
            } catch (e: Exception) {
                e.printStackTrace()
                null
            }
        }
    }

    private fun generateDemoToken(apiKey: String, apiSecret: String, roomName: String, participantName: String): String {
        val header = JSONObject()
        header.put("alg", "HS256")
        header.put("typ", "JWT")

        val now = System.currentTimeMillis() / 1000
        val payload = JSONObject()
        payload.put("exp", now + 3600)
        payload.put("iss", apiKey)
        payload.put("nbf", now)
        payload.put("sub", participantName)
        payload.put("name", participantName)

        val video = JSONObject()
        video.put("room", roomName)
        video.put("roomJoin", true)
        video.put("canPublish", true)
        video.put("canSubscribe", true)
        payload.put("video", video)

        val base64Header = Base64.encodeToString(header.toString().toByteArray(), Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
        val base64Payload = Base64.encodeToString(payload.toString().toByteArray(), Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)

        val dataToSign = "$base64Header.$base64Payload"
        val secretKeySpec = SecretKeySpec(apiSecret.toByteArray(), "HmacSHA256")
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(secretKeySpec)
        val signature = mac.doFinal(dataToSign.toByteArray())
        val base64Signature = Base64.encodeToString(signature, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)

        return "$dataToSign.$base64Signature"
    }

    private fun showAudioDeviceSelectionDialog() {
        // Audio device selection is handled automatically by LiveKit
        Toast.makeText(this, "Audio routing is automatic", Toast.LENGTH_SHORT).show()
    }

    private fun checkPermissionsAndConnect(url: String, token: String) {
        val permissions = arrayOf(
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO
        )

        val needed = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }

        if (needed.isEmpty()) {
            // Already have permissions
            hasPermissions = true
            connectToRoom(url, token)
        } else {
            // Need to request permissions
            pendingUrl = url
            pendingToken = token
            permissionLauncher.launch(needed.toTypedArray())
        }
    }

    private fun connectToRoom(url: String, token: String) {
        lifecycleScope.launch {
            try {
                // Collect Room events
                launch {
                    room.events.collect { event ->
                        when (event) {
                            is RoomEvent.TrackSubscribed -> onTrackSubscribed(event)
                            is RoomEvent.TrackUnsubscribed -> onTrackUnsubscribed(event)
                            is RoomEvent.ActiveSpeakersChanged -> onActiveSpeakersChanged(event.speakers)
                            is RoomEvent.ParticipantConnected -> setupParticipantListeners(event.participant, false)
                            is RoomEvent.ConnectionQualityChanged -> {
                                if (event.participant is RemoteParticipant) {
                                    updateNetworkIndicator(event.quality, remoteNetworkQuality)
                                }
                            }
                            is RoomEvent.Reconnecting -> progressBar.visibility = View.VISIBLE
                            is RoomEvent.Reconnected -> progressBar.visibility = View.GONE
                            is RoomEvent.Disconnected -> finishAndGoHome()
                            is RoomEvent.ParticipantDisconnected -> {
                                Toast.makeText(this@CallActivity, "Call ended", Toast.LENGTH_SHORT).show()
                                disconnectAndFinish()
                            }
                            else -> {}
                        }
                    }
                }

                // Connect to room first
                room.connect(url, token)
                
                // Only enable camera/microphone AFTER successful connection
                // and ensure we have permissions
                if (hasPermissions) {
                    try {
                        room.localParticipant.setMicrophoneEnabled(true)
                        room.localParticipant.setCameraEnabled(true)
                    } catch (e: SecurityException) {
                        Toast.makeText(this@CallActivity, "Permission error: ${e.message}", Toast.LENGTH_SHORT).show()
                        finishAndGoHome()
                        return@launch
                    }
                }

                // Listen to local participant events
                setupParticipantListeners(room.localParticipant, true)

                // Listen to existing remote participants
                for (participant in room.remoteParticipants.values) {
                    setupParticipantListeners(participant, false)
                }

                // Attach Local Video
                launch {
                    val videoTrack = room.localParticipant.getTrackPublication(Track.Source.CAMERA)?.track as? VideoTrack
                    if (videoTrack != null) {
                        videoTrack.addRenderer(localVideoView)
                        localPlaceholder.visibility = View.GONE
                    }
                }
                
                progressBar.visibility = View.GONE
                
            } catch (e: Exception) {
                Toast.makeText(this@CallActivity, "Failed to connect: ${e.message}", Toast.LENGTH_LONG).show()
                finishAndGoHome()
            }
        }
    }

    private fun setupParticipantListeners(participant: Participant, isLocal: Boolean) {
        lifecycleScope.launch {
            participant.events.collect { event ->
                handleParticipantEvent(participant, event, isLocal)
            }
        }
        
        // Initial setup for the participant
        if (!isLocal) {
            val identity = participant.identity?.value ?: "Participant"
            remoteName.text = identity
            findViewById<TextView>(R.id.remote_initials).text = identity.take(1).uppercase()
            remotePlaceholder.visibility = if (participant.getTrackPublication(Track.Source.CAMERA)?.muted == true) View.VISIBLE else View.GONE
            remoteMutedIndicator.visibility = if (participant.getTrackPublication(Track.Source.MICROPHONE)?.muted == true) View.VISIBLE else View.GONE
        } else {
            localPlaceholder.visibility = if (participant.getTrackPublication(Track.Source.CAMERA)?.muted == true) View.VISIBLE else View.GONE
            localMutedIndicator.visibility = if (participant.getTrackPublication(Track.Source.MICROPHONE)?.muted == true) View.VISIBLE else View.GONE
        }
    }

    private fun handleParticipantEvent(participant: Participant, event: ParticipantEvent, isLocal: Boolean) {
        when (event) {
            is ParticipantEvent.TrackMuted -> {
                if (event.publication.source == Track.Source.CAMERA) {
                    if (isLocal) localPlaceholder.visibility = View.VISIBLE else remotePlaceholder.visibility = View.VISIBLE
                } else if (event.publication.source == Track.Source.MICROPHONE) {
                    if (isLocal) localMutedIndicator.visibility = View.VISIBLE else remoteMutedIndicator.visibility = View.VISIBLE
                }
            }
            is ParticipantEvent.TrackUnmuted -> {
                if (event.publication.source == Track.Source.CAMERA) {
                    if (isLocal) localPlaceholder.visibility = View.GONE else remotePlaceholder.visibility = View.GONE
                } else if (event.publication.source == Track.Source.MICROPHONE) {
                    if (isLocal) localMutedIndicator.visibility = View.GONE else remoteMutedIndicator.visibility = View.GONE
                }
            }
            is ParticipantEvent.SpeakingChanged -> {
                if (!isLocal) {
                    remoteSpeakingIndicator.visibility = if (event.isSpeaking) View.VISIBLE else View.GONE
                }
            }
            else -> {}
        }
    }

    private fun onActiveSpeakersChanged(speakers: List<Participant>) {
        // Find the remote participant in the speakers list
        val isRemoteSpeaking = speakers.any { it is RemoteParticipant }
        remoteSpeakingIndicator.visibility = if (isRemoteSpeaking) View.VISIBLE else View.GONE
    }

    private fun updateNetworkIndicator(quality: ConnectionQuality, imageView: ImageView) {
        when (quality) {
            ConnectionQuality.EXCELLENT -> {
                imageView.alpha = 1.0f
                imageView.visibility = View.VISIBLE
            }
            ConnectionQuality.GOOD -> {
                imageView.alpha = 0.7f
                imageView.visibility = View.VISIBLE
            }
            ConnectionQuality.POOR -> {
                imageView.alpha = 0.3f
                imageView.visibility = View.VISIBLE
            }
            ConnectionQuality.LOST -> {
                imageView.visibility = View.GONE
            }
            else -> {}
        }
    }

    private fun onTrackSubscribed(event: RoomEvent.TrackSubscribed) {
        val track = event.track
        if (track is VideoTrack) {
            track.addRenderer(remoteVideoView)
            remoteVideoView.visibility = View.VISIBLE
            remotePlaceholder.visibility = View.GONE
        }
    }

    private fun onTrackUnsubscribed(event: RoomEvent.TrackUnsubscribed) {
        val track = event.track
        if (track is VideoTrack) {
            track.removeRenderer(remoteVideoView)
            remotePlaceholder.visibility = View.VISIBLE
        }
    }

    private fun disconnectAndFinish() {
        // If we have a recipientToken and we are ending the call, we should notify them.
        // This handles the "Dialer cancels call" scenario.
        if (!recipientToken.isNullOrEmpty() && !roomName.isNullOrEmpty()) {
             android.util.Log.d("CallActivity", "Sending cancellation to recipient with token: ${recipientToken?.take(10)}...")
             // Notify server to cancel/end call for the other user
             notifyServerCallEnded()
        } else {
             android.util.Log.d("CallActivity", "No recipientToken or roomName, skipping server notification")
        }
        
        lifecycleScope.launch {
            try {
                room.disconnect()
            } catch (e: Exception) {
                // ignore
            }
            finishAndGoHome()
        }
    }
    
    private fun notifyServerCallEnded() {
        val urlString = "http://192.168.1.3:3000/call/action"
        val rToken = recipientToken ?: return
        val rName = roomName ?: return

        Thread {
            try {
                val json = JSONObject()
                json.put("action", "cancel")
                json.put("roomName", rName)
                json.put("recipientToken", rToken) // Notify the RECEIVER that call is cancelled
                
                val url = URL(urlString)
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8")
                conn.doOutput = true
                
                val os = conn.outputStream
                os.write(json.toString().toByteArray(java.nio.charset.StandardCharsets.UTF_8))
                os.close()
                
                android.util.Log.d("CallActivity", "Cancel signal sent: " + conn.responseCode)
                conn.disconnect()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }.start()
    }
    
    private fun finishAndGoHome() {
        // Ensure we go back to MainActivity (Contact List)
        val intent = Intent(this, MainActivity::class.java)
        intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        // If MainActivity was not running, REORDER_TO_FRONT brings it up or starts it.
        // If you want to force reset to a specific screen, you might need to pass data to handle navigation in MainActivity.
        // For now, bringing MainActivity to front is usually enough.
        startActivity(intent)
        finish()
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
             val params = android.app.PictureInPictureParams.Builder()
                .setAspectRatio(android.util.Rational(9, 16))
                .build()
            enterPictureInPictureMode(params)
        }
    }

    override fun onPictureInPictureModeChanged(isInPictureInPictureMode: Boolean, newConfig: android.content.res.Configuration) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
        if (isInPictureInPictureMode) {
            // Hide UI controls in PiP
            findViewById<View>(R.id.controls_container).visibility = View.GONE
            findViewById<View>(R.id.local_video_container).visibility = View.GONE
            findViewById<View>(R.id.btn_switch_camera).visibility = View.GONE
            findViewById<View>(R.id.remote_name).visibility = View.GONE
            findViewById<View>(R.id.remote_network_quality).visibility = View.GONE
        } else {
            // Restore UI controls
            findViewById<View>(R.id.controls_container).visibility = View.VISIBLE
            findViewById<View>(R.id.local_video_container).visibility = View.VISIBLE
            findViewById<View>(R.id.btn_switch_camera).visibility = View.VISIBLE
            findViewById<View>(R.id.remote_name).visibility = View.VISIBLE
            findViewById<View>(R.id.remote_network_quality).visibility = View.VISIBLE
        }
    }

    override fun onStart() {
        super.onStart()

        // Only enable camera if we have permissions and room is initialized
        if (hasPermissions && ::room.isInitialized && !isVideoOff) {
            lifecycleScope.launch {
                try {
                    room.localParticipant.setCameraEnabled(true)
                } catch (e: Exception) {
                    // Ignore - camera might not be available yet
                }
            }
        }
    }

    override fun onStop() {
        super.onStop()

        // Only disable camera if we have permissions and room is initialized
        if (hasPermissions && ::room.isInitialized && !isInPictureInPictureMode) {
            lifecycleScope.launch {
                try {
                    room.localParticipant.setCameraEnabled(false)
                } catch (e: Exception) {
                    // Ignore - camera might already be disabled
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        lifecycleScope.launch {
            room.disconnect()
            room.release()
        }
        try {
            unregisterReceiver(callEndedReceiver)
        } catch (e: Exception) {
            // Ignore
        }
    }
}
