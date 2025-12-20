import { registerPlugin } from '@capacitor/core';

export interface NativeCallPlugin {
    startCall(options: { token: string; url: string; roomName: string; recipientToken?: string }): Promise<void>;
}

const NativeCall = registerPlugin<NativeCallPlugin>('NativeCall');

export default NativeCall;
