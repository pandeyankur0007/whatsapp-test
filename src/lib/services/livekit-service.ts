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
    type RemoteTrack
} from 'livekit-client';

import { callStore } from '../stores/call-store.svelte';
import type { VideoTrackSettings, AudioTrackSettings } from '../types';

class LiveKitService {
    private room: Room | null = null;
    private localTracks: LocalTrack[] = [];
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;

    // URL of your backend endpoint that returns a valid LiveKit token
    private tokenEndpoint = 'http://localhost:3000/token';
    private roomName = 'call_1Yn60hZM1X_9Uppel1ZVJ';
    private participantName = 'me';

    constructor() {
        this.room = new Room();
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
            };
            callStore.connectionQuality = qualityMap[quality] as 'excellent' | 'good' | 'poor';

            if (quality === ConnectionQuality.Poor) {
                this.degradeVideoQuality();
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
                this.room = new Room();
                this.setupEventListeners();
            }

            callStore.setCallState('connecting');
            console.log('Connecting to LiveKit URL:', url);

            await this.room.connect(url, token, {
                adaptiveStream: true,
                dynacast: true,
            });

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
                resolution: {
                    width: videoSettings?.width ?? 1280,
                    height: videoSettings?.height ?? 720,
                    frameRate: videoSettings?.frameRate ?? 30,
                },
                facingMode: videoSettings?.facingMode ?? 'user',
            },
        });

        for (const track of this.localTracks) {
            await this.room?.localParticipant.publishTrack(track);
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
        if (callStore.isVideoMuted) await videoTrack.unmute();
        else await videoTrack.mute();
        callStore.toggleVideo();
    }

    async switchCamera() {
        const videoTrack = this.localTracks.find(t => t.kind === Track.Kind.Video);
        if (!videoTrack || !this.room) return;

        await this.room.localParticipant.unpublishTrack(videoTrack);
        videoTrack.stop();
        this.localTracks = this.localTracks.filter(t => t !== videoTrack);

        callStore.switchCamera();

        const [newTrack] = await createLocalTracks({
            video: {
                facingMode: callStore.facingMode,
                resolution: VideoPresets.h720.resolution,
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

    private async degradeVideoQuality() {
        const videoTrack = this.localTracks.find(t => t.kind === Track.Kind.Video);
        if (videoTrack) callStore.updatePerformanceMetrics({ videoQuality: 'low' });
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
}

export const liveKitService = new LiveKitService();
