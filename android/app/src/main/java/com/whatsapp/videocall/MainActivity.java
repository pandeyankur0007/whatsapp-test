package com.whatsapp.videocall;

import android.app.PictureInPictureParams;
import android.os.Build;
import android.util.Rational;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        
        // Only enter PiP if we are in a call (Audio Mode is Communication)
        android.media.AudioManager am = (android.media.AudioManager) getSystemService(android.content.Context.AUDIO_SERVICE);
        if (am.getMode() == android.media.AudioManager.MODE_IN_COMMUNICATION) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                PictureInPictureParams params = new PictureInPictureParams.Builder()
                    .setAspectRatio(new Rational(9, 16))
                    .build();
                enterPictureInPictureMode(params);
            }
        }
    }
}
