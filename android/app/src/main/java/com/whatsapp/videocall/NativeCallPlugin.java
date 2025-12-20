package com.whatsapp.videocall;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativeCall")
public class NativeCallPlugin extends Plugin {

    @PluginMethod
    public void startCall(PluginCall call) {
        String token = call.getString("token");
        String url = call.getString("url");
        String roomName = call.getString("roomName");

        Intent intent = new Intent(getContext(), CallActivity.class);
        intent.putExtra("TOKEN", token);
        intent.putExtra("URL", url);
        intent.putExtra("ROOM_NAME", roomName);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK); // Required if context is not Activity context, though getContext() usually is BridgeActivity.
        
        getContext().startActivity(intent);
        call.resolve();
    }
}
