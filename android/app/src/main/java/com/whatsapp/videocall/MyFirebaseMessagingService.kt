package com.whatsapp.videocall

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class MyFirebaseMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // You might want to forward this to Capacitor plugin if needed, 
        // but typically the plugin registers its own listener or we can broadcast it.
        // For now, let's just log it.
        Log.d("MyFCM", "New token: $token")
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        val data = remoteMessage.data
        val type = data["type"]

        if (type == "incoming_call") {
            handleIncomingCall(remoteMessage)
        } else if (type == "call_ended") {
            handleCallEnded(remoteMessage)
        } else {
            super.onMessageReceived(remoteMessage)
        }
    }

    private fun handleCallEnded(remoteMessage: RemoteMessage) {
        val roomName = remoteMessage.data["roomName"] ?: return
        
        // Cancel Notification
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.cancel(roomName.hashCode())

        // Broadcast to Activities to close
        val intent = Intent("com.whatsapp.videocall.ACTION_CALL_ENDED")
        intent.putExtra("ROOM_NAME", roomName)
        intent.setPackage(packageName)
        sendBroadcast(intent)
        
        Log.d("MyFCM", "Call ended signal received for room: $roomName")
    }
    private fun handleIncomingCall(remoteMessage: RemoteMessage) {
        val data = remoteMessage.data
        val roomName = data["roomName"] ?: return
        val callerName = data["callerName"] ?: "Unknown"
        val callerAvatar = data["callerAvatar"]
        val livekitToken = data["livekitToken"]
        val callerToken = data["callerToken"]

        Log.d("MyFCM", "Incoming call from $callerName, room: $roomName")

        val intent = Intent(this, IncomingCallActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("CALLER_NAME", callerName)
            putExtra("ROOM_NAME", roomName)
            putExtra("CALLER_AVATAR", callerAvatar)
            putExtra("LIVEKIT_TOKEN", livekitToken)
            putExtra("CALLER_TOKEN", callerToken)
        }

        val pendingIntent = PendingIntent.getActivity(
            this,
            roomName.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Create Notification Channel for Calls
        val channelId = "video_calls_urgent_v2" // Changed to force fresh High Priority channel creation
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
            val attributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()

            val channel = NotificationChannel(
                channelId,
                "Video Calls",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Incoming Video Calls"
                setSound(soundUri, attributes)
                enableVibration(true)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            notificationManager.createNotificationChannel(channel)
        }

        // Build Notification
        val notificationBuilder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.mipmap.ic_launcher) // Accessing R from our package
            .setContentTitle("Incoming Video Call")
            .setContentText(callerName)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setAutoCancel(true)
            .setOngoing(true)
            .setFullScreenIntent(pendingIntent, true)
            .setContentIntent(pendingIntent)

        // Show it
        notificationManager.notify(roomName.hashCode(), notificationBuilder.build())

        // AGGRESSIVE START: Attempt to start activity directly
        // This is required for some devices to show the UI immediately, not just a notification
        try {
            val powerManager = getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
            // Use PARTIAL_WAKE_LOCK to ensure CPU runs, but ACQUIRE_CAUSES_WAKEUP to turn screen on
            // Note: ACQUIRE_CAUSES_WAKEUP is deprecated in API 33 but still works or ignored.
            // FULL_WAKE_LOCK is deprecated.
            
            // Just explicitly start activity. If blocked, the notification FullScreenIntent handles it.
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            startActivity(intent)
        } catch (e: Exception) {
            // This is expected on Android 10+ if we don't have "Display over other apps" permission
            // The system will just show the notification instead, which is correct behavior.
            Log.d("MyFCM", "Direct launch failed (background restriction), relying on Notification: ${e.message}")
        }
    }
}
