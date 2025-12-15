import {
    Room,
    RoomEvent,
    Track,
    RemoteParticipant,
    createLocalTracks,
    VideoPresets,
    ConnectionQuality,
    type LocalTrack,
    type RemoteTrackPublication,
    type RemoteTrack,
    LocalVideoTrack
} from 'livekit-client';

import { callStore } from '../stores/call-store.svelte';
import type { VideoTrackSettings, AudioTrackSettings } from '../types';

class LiveKitService {
    private room: Room | null = null;
    private localTracks: LocalTrack[] = [];
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private isVideoLowQuality = false;
    private currentVideoResolution = VideoPresets.h540.resolution;
    private poorNetworkTimer: ReturnType<typeof setTimeout> | null = null;
    private isVideoMutedForNetwork = false;

    // URL of your backend endpoint that returns a valid LiveKit token
    private tokenEndpoint = 'http://localhost:3000/token';
    private roomName = 'call_1Yn60hZM1X_9Uppel1ZVJ';
    private participantName = 'me';

    constructor() {
        this.room = new Room({
            adaptiveStream: true,
            dynacast: true,
            videoCaptureDefaults: {
                resolution: VideoPresets.h540.resolution,
            }
        });
        this.setupEventListeners();
    }

    private setupEventListeners() {
        if (!this.room) return;

        this.room.on(RoomEvent.Connected, () => {
            console.log('Connected to room');
            callStore.setCallState('connected');
            callStore.startCall();
            this.reconnectAttempts = 0;
        });

        this.room.on(RoomEvent.Disconnected, () => {
            console.log('Disconnected from room');
            callStore.setCallState('ended');
        });

        this.room.on(RoomEvent.Reconnecting, () => {
            console.log('Reconnecting...');
            callStore.setCallState('reconnecting');
        });

        this.room.on(RoomEvent.Reconnected, () => {
            console.log('Reconnected');
            callStore.setCallState('connected');
        });

        this.room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
            console.log('Participant connected:', participant.identity);
            callStore.setRemoteParticipant({
                id: participant.sid,
                name: participant.identity,
            });
        });

        this.room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
            console.log('Participant disconnected:', participant.identity);
            callStore.setRemoteParticipant(null);

            // For 1-to-1 calls, end call immediately when the other party leaves
            console.log('Remote participant left, ending call sequence...');

            // Set ended processing state
            callStore.setCallState('ended');

            // Disconnect immediately to clear connection
            this.disconnect();
        });

        this.room.on(
            RoomEvent.TrackSubscribed,
            (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
                console.log('Track subscribed:', track.kind);
                if (track.kind === Track.Kind.Video) {
                    const element = track.attach();
                    element.id = 'remote-video';
                    element.style.transform = 'translateZ(0)';
                    element.style.willChange = 'transform';
                    window.dispatchEvent(
                        new CustomEvent('remote-video-ready', { detail: { element } })
                    );
                } else if (track.kind === Track.Kind.Audio) {
                    const element = track.attach();
                    element.id = 'remote-audio';
                    document.body.appendChild(element);
                }
            }
        );

        this.room.on(
            RoomEvent.TrackUnsubscribed,
            (track: RemoteTrack) => {
                console.log('Track unsubscribed:', track.kind);
                track.detach();
            }
        );

        this.room.on(RoomEvent.ConnectionQualityChanged, (quality: ConnectionQuality) => {
            const qualityMap = {
                [ConnectionQuality.Excellent]: 'excellent',
                [ConnectionQuality.Good]: 'good',
                [ConnectionQuality.Poor]: 'poor',
                [ConnectionQuality.Lost]: 'poor',
                [ConnectionQuality.Unknown]: 'poor',
            };
            callStore.connectionQuality = qualityMap[quality] as 'excellent' | 'good' | 'poor';

            if (quality === ConnectionQuality.Poor) {
                this.setVideoQuality('low');
                // If poor connection persists for 10 seconds, switch to audio-only
                if (!this.poorNetworkTimer && !this.isVideoMutedForNetwork) {
                    this.poorNetworkTimer = setTimeout(() => {
                        this.muteVideoForNetwork();
                    }, 10000);
                }
            } else if (quality === ConnectionQuality.Good || quality === ConnectionQuality.Excellent) {
                // Clear any pending audio-only switch
                if (this.poorNetworkTimer) {
                    clearTimeout(this.poorNetworkTimer);
                    this.poorNetworkTimer = null;
                }

                // Restore video if it was muted purely for network reasons
                if (this.isVideoMutedForNetwork) {
                    this.restoreVideoFromNetworkMute();
                }

                this.setVideoQuality('high');
            }
        });
    }

    // Fetch a fresh token from backend
    private async fetchToken(): Promise<string> {
        const url = `${this.tokenEndpoint}?roomName=${this.roomName}&participantName=${this.participantName}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch token');
        const data = await res.json();
        return data.token;
    }

    // Connect using a token fetched from backend
    async connectWithTokenFromServer(roomName: string, participantName: string): Promise<void> {
        try {
            this.roomName = roomName;
            this.participantName = participantName;

            const token = await this.fetchToken();
            const url = 'https://ultra-poject-ebwwosad.livekit.cloud';
            await this.connect(token, url);
        } catch (error) {
            console.error('Failed to connect with server token:', error);
            await this.disconnect(); // Ensure cleanup
            throw error;
        }
    }

    async connect(token: string, url: string): Promise<void> {
        if (!this.room) throw new Error('Room not initialized');

        try {
            // Ensure we are disconnected from any previous session
            if (this.room.state !== 'disconnected') {
                console.warn('Closing existing connection before new one...');
                await this.disconnect();
                // Re-initialize room to be safe
                this.room = new Room({
                    adaptiveStream: true,
                    dynacast: true,
                    videoCaptureDefaults: {
                        resolution: VideoPresets.h540.resolution,
                    }
                });
                this.setupEventListeners();
            }

            callStore.setCallState('connecting');
            console.log('Connecting to LiveKit URL:', url);

            await this.room.connect(url, token);

            console.log('Room connected successfully. State:', this.room.state);

            // Double check state before publishing
            if (this.room.state === 'connected') {
                console.log('Publishing local tracks...');
                await this.publishLocalTracks();
            } else {
                console.error('Room not connected after connect() call. Current state:', this.room.state);
            }
        } catch (error) {
            console.error('Failed to connect:', error);
            await this.disconnect();
            callStore.setCallState('ended');
            throw error;
        }
    }

    async publishLocalTracks(
        videoSettings?: Partial<VideoTrackSettings>,
        audioSettings?: Partial<AudioTrackSettings>
    ) {
        this.localTracks = await createLocalTracks({
            audio: {
                echoCancellation: audioSettings?.echoCancellation ?? true,
                noiseSuppression: audioSettings?.noiseSuppression ?? true,
                autoGainControl: audioSettings?.autoGainControl ?? true,
            },
            video: {
                // Use qHD (540p) which is a good balance for mobile performance
                resolution: VideoPresets.h540.resolution,
                // Limit frame rate to 24fps for better bandwidth usage
                frameRate: 24,
                facingMode: videoSettings?.facingMode ?? 'user',
            },
        });

        for (const track of this.localTracks) {
            // Enable simulcast for video tracks to allow adaptive stream switching
            const isVideo = track.kind === Track.Kind.Video;
            const isAudio = track.kind === Track.Kind.Audio;
            await this.room?.localParticipant.publishTrack(track, {
                simulcast: isVideo,
                dtx: isAudio, // Discontinuous transmission (save bandwidth on silence)
                red: isAudio, // Redundant encoding (FEC for audio)
            });
        }

        const videoTrack = this.localTracks.find(t => t.kind === Track.Kind.Video);
        if (videoTrack) {
            const element = videoTrack.attach();
            element.id = 'local-video';
            element.style.transform = 'translateZ(0)';
            element.style.willChange = 'transform';
            window.dispatchEvent(new CustomEvent('local-video-ready', { detail: { element } }));
        }
    }

    async toggleMicrophone() {
        const audioTrack = this.localTracks.find(t => t.kind === Track.Kind.Audio);
        if (!audioTrack) return;
        if (callStore.isMicMuted) await audioTrack.unmute();
        else await audioTrack.mute();
        callStore.toggleMic();
    }

    async toggleCamera() {
        const videoTrack = this.localTracks.find(t => t.kind === Track.Kind.Video);
        if (!videoTrack) return;

        // Reset network pause flags because user is manually taking control
        if (this.isVideoMutedForNetwork) {
            // this.isVideoPausedForNetwork is not used anymore, but just in case
            this.isVideoMutedForNetwork = false;
            if (this.poorNetworkTimer) clearTimeout(this.poorNetworkTimer);
        }

        // When manually toggling, we maintain the current quality adaptation state
        // unless it was fully muted due to network, in which case unmuting is the user's intent.

        if (callStore.isVideoMuted) await videoTrack.unmute();
        else await videoTrack.mute();
        callStore.toggleVideo();
    }

    async switchCamera() {
        const videoTrack = this.localTracks.find(t => t.kind === Track.Kind.Video) as LocalVideoTrack | undefined;
        if (!videoTrack) return;

        try {
            // Get list of video devices
            const devices = await Room.getLocalDevices('videoinput');
            const validDevices = devices.filter(d => d.deviceId !== 'default' && d.deviceId !== 'communications');

            if (validDevices.length < 2) {
                console.warn('No potential alternate camera found');
                return;
            }

            // Find current device index
            const currentDeviceId = videoTrack.mediaStreamTrack.getSettings().deviceId;
            const currentIndex = validDevices.findIndex(d => d.deviceId === currentDeviceId);

            // Pick next device (cycle)
            const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % validDevices.length;
            const nextDevice = validDevices[nextIndex];

            console.log('Switching camera to device:', nextDevice.label);

            await videoTrack.setDeviceId(nextDevice.deviceId);

            // Update store state (toggle)
            callStore.switchCamera();

        } catch (error) {
            console.error('Failed to switch camera device:', error);
            // Fallback: Brute force with delay to avoid Code 3
            await this.handleCameraSwitchFallback();
        }
    }

    private async handleCameraSwitchFallback() {
        console.log('Using fallback camera switch...');
        const videoTrack = this.localTracks.find(t => t.kind === Track.Kind.Video);
        if (!videoTrack || !this.room) return;

        await this.room.localParticipant.unpublishTrack(videoTrack);
        videoTrack.stop();
        this.localTracks = this.localTracks.filter(t => t !== videoTrack);

        // DELAY is critical for Android "Device error code 3"
        await new Promise(resolve => setTimeout(resolve, 500));

        callStore.switchCamera();

        const [newTrack] = await createLocalTracks({
            video: {
                facingMode: callStore.facingMode,
                resolution: VideoPresets.h540.resolution,
            },
        });

        if (newTrack) {
            await this.room.localParticipant.publishTrack(newTrack);
            this.localTracks.push(newTrack);

            const element = newTrack.attach();
            element.id = 'local-video';
            element.style.transform = 'translateZ(0)';
            window.dispatchEvent(new CustomEvent('local-video-updated', { detail: { element } }));
        }
    }

    private async setVideoQuality(quality: 'low' | 'high') {
        const videoTrack = this.localTracks.find(t => t.kind === Track.Kind.Video) as LocalVideoTrack | undefined;
        if (!videoTrack || !this.room || callStore.isVideoMuted) return;

        // Prevent unnecessary restarts
        if (quality === 'low' && this.isVideoLowQuality) return;
        if (quality === 'high' && !this.isVideoLowQuality) return;

        this.isVideoLowQuality = (quality === 'low');
        callStore.updatePerformanceMetrics({ videoQuality: quality });

        console.log(`Adapting video quality to: ${quality}`);

        try {
            if (quality === 'low') {
                // Lower FPS and Resolution for poor network
                // Cast to any to bypass protected visibility if TS complains - restart is public in runtime
                await (videoTrack as any).restart({
                    ...(VideoPresets.h360.resolution),
                    frameRate: 15,
                });
            } else {
                // Restore standard quality
                await (videoTrack as any).restart({
                    ...(VideoPresets.h540.resolution),
                    frameRate: 24,
                });
            }
        } catch (error) {
            console.error('Failed to adapt video quality:', error);
        }
    }

    private async muteVideoForNetwork() {
        if (this.isVideoMutedForNetwork || callStore.isVideoMuted) return;

        const videoTrack = this.localTracks.find(t => t.kind === Track.Kind.Video);
        if (videoTrack && !videoTrack.isMuted) {
            console.log('Network critical: Disabling video to preserve audio');
            try {
                await videoTrack.mute();
                this.isVideoMutedForNetwork = true;
                callStore.updatePerformanceMetrics({ videoQuality: 'audio-only' });
            } catch (e) {
                console.error('Failed to mute for network:', e);
            }
        }
    }

    private async restoreVideoFromNetworkMute() {
        if (!this.isVideoMutedForNetwork) return;

        this.isVideoMutedForNetwork = false;

        // If user manually muted broadly, we don't unmute
        if (callStore.isVideoMuted) return;

        const videoTrack = this.localTracks.find(t => t.kind === Track.Kind.Video);
        if (videoTrack) {
            console.log('Network recovering: Restoring video track');
            try {
                await videoTrack.unmute();
                // setVideoQuality('high') will be called by the event listener
            } catch (e) {
                console.error('Failed to restore video from network mute:', e);
            }
        }
    }

    async disconnect() {
        if (!this.room) return;

        for (const track of this.localTracks) track.stop();
        this.localTracks = [];

        await this.room.disconnect();
        callStore.reset();
    }

    getRoom(): Room | null {
        return this.room;
    }

    private wasVideoEnabledBeforeBackground = false;

    async handleAppPause() {
        console.log('App paused: managing tracks...');
        const videoTrack = this.localTracks.find(t => t.kind === Track.Kind.Video) as LocalVideoTrack | undefined;
        if (videoTrack && !videoTrack.isMuted) {
            console.log('Stopping video track for background mode');
            this.wasVideoEnabledBeforeBackground = true;
            // Mute first to notify server
            await videoTrack.mute();
            // Explicitly STOP the media stream to release Android Camera Hardware
            // This prevents "Handler on dead thread" and "CameraCaptureSession" leaks
            videoTrack.mediaStreamTrack.stop();
        }
    }

    async handleAppResume() {
        console.log('App resumed: restoring tracks...');
        if (this.wasVideoEnabledBeforeBackground) {
            const videoTrack = this.localTracks.find(t => t.kind === Track.Kind.Video) as LocalVideoTrack | undefined;
            if (videoTrack) {
                console.log('Restarting video track from background mode');
                // Use restart because the previous stream was stopped
                await (videoTrack as any).restart({
                    ...(this.isVideoLowQuality ? VideoPresets.h360.resolution : VideoPresets.h540.resolution),
                });
                // Ensure it's unmuted (restart usually unmutes, but just in case)
                await videoTrack.unmute();
            }
            this.wasVideoEnabledBeforeBackground = false;
        }
    }
}

export const liveKitService = new LiveKitService();
