/**
 * Central state management using Svelte 5 runes
 * Manages call state, room connection, and participants
 */

import type {
    CallState,
    RoomMetadata,
    Participant,
    PerformanceMetrics,
    CallNotification
} from '../types';

// Create reactive state using Svelte 5 runes
class CallStore {
    // Call state
    callState = $state<CallState>('idle');

    // Room and participants
    currentRoom = $state<RoomMetadata | null>(null);
    localParticipant = $state<Participant | null>(null);
    remoteParticipant = $state<Participant | null>(null);

    // Incoming call
    incomingCall = $state<CallNotification | null>(null);

    // Media state
    isMicMuted = $state(false);
    isVideoMuted = $state(false);
    isSpeakerOn = $state(true);
    facingMode = $state<'user' | 'environment'>('user');

    // Connection state
    isConnecting = $state(false);
    connectionQuality = $state<'excellent' | 'good' | 'poor'>('excellent');

    // Call duration
    callStartTime = $state<Date | null>(null);
    callDuration = $state(0);

    // Performance metrics
    performanceMetrics = $state<PerformanceMetrics>({
        fps: 60,
        memoryUsage: 0,
        videoQuality: 'high',
        networkQuality: 100
    });

    // UI state
    showControls = $state(true);
    isFullscreen = $state(false);

    // Actions
    setCallState(state: CallState) {
        this.callState = state;
    }

    setRoom(room: RoomMetadata | null) {
        this.currentRoom = room;
    }

    setLocalParticipant(participant: Participant | null) {
        this.localParticipant = participant;
    }

    setRemoteParticipant(participant: Participant | null) {
        this.remoteParticipant = participant;
    }

    setIncomingCall(call: CallNotification | null) {
        this.incomingCall = call;
    }

    toggleMic() {
        this.isMicMuted = !this.isMicMuted;
    }

    toggleVideo() {
        this.isVideoMuted = !this.isVideoMuted;
    }

    toggleSpeaker() {
        this.isSpeakerOn = !this.isSpeakerOn;
    }

    switchCamera() {
        this.facingMode = this.facingMode === 'user' ? 'environment' : 'user';
    }

    updatePerformanceMetrics(metrics: Partial<PerformanceMetrics>) {
        this.performanceMetrics = { ...this.performanceMetrics, ...metrics };
    }

    startCall() {
        this.callStartTime = new Date();
        this.callDuration = 0;
    }

    updateCallDuration(duration: number) {
        this.callDuration = duration;
    }

    reset() {
        this.callState = 'idle';
        this.currentRoom = null;
        this.remoteParticipant = null;
        this.incomingCall = null;
        this.isMicMuted = false;
        this.isVideoMuted = false;
        this.isSpeakerOn = true;
        this.facingMode = 'user';
        this.isConnecting = false;
        this.callStartTime = null;
        this.callDuration = 0;
        this.showControls = true;
        this.isFullscreen = false;
    }
}

// Export singleton instance
export const callStore = new CallStore();
