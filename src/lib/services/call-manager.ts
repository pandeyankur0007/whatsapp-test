/**
 * Call manager - orchestrates the complete calling workflow
 * Handles call initiation, acceptance, rejection, and cleanup
 */

import { liveKitService } from './livekit-service';
import { fcmService } from './fcm-service';
import { storageService } from './storage-service';
import { callStore } from '../stores/call-store.svelte';
import type { Contact, CallHistoryEntry, Participant } from '../types';
import { nanoid } from 'nanoid';

class CallManager {
    private callDurationInterval: ReturnType<typeof setInterval> | null = null;

    /**
     * Initiate an outgoing call
     */
    async initiateCall(contact: Contact): Promise<void> {
        try {
            callStore.setCallState('initiating');

            // Generate room name
            const roomName = `call_${nanoid()}`;

            // Get LiveKit token from server
            const token = await this.getCallToken(roomName, 'me'); // Replace 'me' with actual user ID

            // Send FCM notification to recipient
            if (contact.fcmToken) {
                const myToken = fcmService.getToken();
                await fcmService.sendCallNotification(
                    contact.fcmToken,
                    'You', // Replace with actual user name
                    roomName,
                    undefined // Your avatar
                );
            }

            // Set up room metadata
            callStore.setRoom({
                roomName,
                caller: {
                    id: 'me',
                    name: 'You'
                },
                callee: {
                    id: contact.id,
                    name: contact.name,
                    avatar: contact.avatar,
                    fcmToken: contact.fcmToken
                }
            });

            callStore.setRemoteParticipant({
                id: contact.id,
                name: contact.name,
                avatar: contact.avatar
            });

            callStore.setCallState('ringing');

            // Connect to LiveKit room
            const livekitUrl = import.meta.env.VITE_LIVEKIT_URL || 'https://ultra-poject-ebwwosad.livekit.cloud';
            if (!livekitUrl) {
                console.error('Missing VITE_LIVEKIT_URL');
                throw new Error('Missing LiveKit URL');
            }

            // check if native platform and use native call
            if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()) {
                const NativeCall = (await import('../utils/native-call')).default;
                console.log('Starting Native Call Activity...');
                await NativeCall.startCall({
                    token,
                    url: livekitUrl,
                    roomName,
                    recipientToken: contact.fcmToken
                });
                // We do not proceed to set up local listeners as the native activity takes over
                return;
            }

            await liveKitService.connect(token, livekitUrl);

            // Start call duration timer
            this.startCallDurationTimer();

        } catch (error) {
            console.error('Failed to initiate call:', error);
            callStore.setCallState('ended');
            throw error;
        }
    }

    /**
     * Accept an incoming call
     */
    async acceptCall(): Promise<void> {
        try {
            const incomingCall = callStore.incomingCall;
            if (!incomingCall) {
                throw new Error('No incoming call');
            }

            // Stop ringtone
            fcmService.stopRingtone();

            callStore.setCallState('connecting');

            // Get LiveKit token
            const token = await this.getCallToken(incomingCall.roomName, 'me');

            // Connect to LiveKit room
            const livekitUrl = import.meta.env.VITE_LIVEKIT_URL || 'https://ultra-poject-ebwwosad.livekit.cloud';
            await liveKitService.connect(token, livekitUrl);

            // Clear incoming call notification
            callStore.setIncomingCall(null);

            // Start call duration timer
            this.startCallDurationTimer();

        } catch (error) {
            console.error('Failed to accept call:', error);
            callStore.setCallState('ended');
            throw error;
        }
    }

    /**
     * Reject an incoming call
     */
    async rejectCall(): Promise<void> {
        // Stop ringtone
        fcmService.stopRingtone();

        const incomingCall = callStore.incomingCall;

        // Send rejection signal to caller
        if (incomingCall?.callerFcmToken) {
            await fcmService.sendCallSignal(incomingCall.callerFcmToken, 'call_rejected');
        }

        // Save to call history as missed
        if (incomingCall) {
            await this.saveCallHistory({
                id: nanoid(),
                contactId: 'unknown',
                contactName: incomingCall.callerName,
                contactAvatar: incomingCall.callerAvatar,
                type: 'missed',
                timestamp: new Date(),
                wasVideoCall: true
            });
        }

        // Clear incoming call
        callStore.setIncomingCall(null);
        callStore.setCallState('idle');
    }

    /**
     * End the current call
     */
    async endCall(): Promise<void> {
        try {
            // Stop call duration timer
            this.stopCallDurationTimer();

            // Save call to history
            const room = callStore.currentRoom;
            const duration = callStore.callDuration;

            if (room) {
                const callEntry: CallHistoryEntry = {
                    id: nanoid(),
                    contactId: room.callee.id,
                    contactName: room.callee.name,
                    contactAvatar: room.callee.avatar,
                    type: 'outgoing',
                    duration,
                    timestamp: new Date(),
                    wasVideoCall: true
                };

                await this.saveCallHistory(callEntry);
            }

            // Disconnect from LiveKit
            await liveKitService.disconnect();

            callStore.setCallState('ended');

            // Reset state after a delay
            setTimeout(() => {
                callStore.reset();
            }, 1000);

        } catch (error) {
            console.error('Failed to end call:', error);
        }
    }

    /**
     * Toggle microphone mute
     */
    async toggleMicrophone(): Promise<void> {
        await liveKitService.toggleMicrophone();
    }

    /**
     * Toggle camera on/off
     */
    async toggleCamera(): Promise<void> {
        await liveKitService.toggleCamera();
    }

    /**
     * Switch between front/back camera
     */
    async switchCamera(): Promise<void> {
        await liveKitService.switchCamera();
    }

    /**
     * Get or create a unique identity for this client
     */
    private getClientIdentity(): string {
        const STORAGE_KEY = 'whatsapp_client_id';
        let id = localStorage.getItem(STORAGE_KEY);
        if (!id) {
            id = `user_${nanoid(8)}`;
            localStorage.setItem(STORAGE_KEY, id);
        }
        return id;
    }

    /**
     * Get LiveKit access token from server (or generate demo token)
     */
    private async getCallToken(roomName: string, participantName: string): Promise<string> {
        try {
            const apiUrl = import.meta.env.VITE_API_URL;

            // Demo mode: Generate token client-side if no API URL is configured
            if (!apiUrl || apiUrl === 'undefined') {
                console.warn('⚠️ No API URL configured - using DEMO MODE with client-side tokens');
                return this.generateDemoToken(roomName, participantName);
            }

            console.log('Fetching token from:', apiUrl, 'for room:', roomName);
            const identity = this.getClientIdentity();

            const fullUrl = `${apiUrl}/token?roomName=${encodeURIComponent(roomName)}&participantName=${encodeURIComponent(identity)}`;
            console.log('Request URL:', fullUrl);

            const response = await fetch(fullUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                console.error('Token fetch response status:', response.status);
                console.warn('⚠️ Backend unavailable - falling back to DEMO MODE');
                return this.generateDemoToken(roomName, participantName);
            }

            const data = await response.json();
            return data.token;

        } catch (error) {
            console.error('Error getting call token:', error);
            console.warn('⚠️ Backend error - falling back to DEMO MODE');
            return this.generateDemoToken(roomName, participantName);
        }
    }

    /**
     * Generate a demo LiveKit token for testing without backend
     * NOTE: This uses the LiveKit API key/secret directly in the client.
     * This is ONLY for demo/testing purposes and should NEVER be used in production!
     */
    private generateDemoToken(roomName: string, participantName: string): string {
        const identity = this.getClientIdentity();
        const livekitApiKey = import.meta.env.VITE_LIVEKIT_API_KEY;
        const livekitApiSecret = import.meta.env.VITE_LIVEKIT_API_SECRET;

        if (!livekitApiKey || !livekitApiSecret) {
            throw new Error(
                'Missing LiveKit credentials. Please set VITE_LIVEKIT_API_KEY and VITE_LIVEKIT_API_SECRET in your .env file, ' +
                'or set up a backend server and configure VITE_API_URL'
            );
        }

        // Simple JWT generation for demo purposes
        // In production, tokens MUST be generated server-side!
        const header = {
            alg: 'HS256',
            typ: 'JWT'
        };

        const now = Math.floor(Date.now() / 1000);
        const payload = {
            exp: now + 3600, // 1 hour
            iss: livekitApiKey,
            nbf: now,
            sub: identity,
            name: participantName,
            video: {
                room: roomName,
                roomJoin: true,
                canPublish: true,
                canSubscribe: true,
            }
        };

        // Base64 URL encode
        const base64UrlEncode = (obj: any) => {
            return btoa(JSON.stringify(obj))
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=/g, '');
        };

        // Create signature using HMAC SHA256
        const stringToSign = `${base64UrlEncode(header)}.${base64UrlEncode(payload)}`;

        // Simple HMAC-SHA256 implementation for demo
        // Note: In production, use a proper crypto library on the server
        const signature = this.hmacSHA256(stringToSign, livekitApiSecret);

        const token = `${stringToSign}.${signature}`;
        console.log('✅ Generated demo token for room:', roomName);

        return token;
    }

    /**
     * Simple HMAC-SHA256 for demo token generation
     * WARNING: This is a simplified implementation for demo purposes only!
     */
    private hmacSHA256(message: string, secret: string): string {
        // For demo purposes, we'll use a simple hash
        // In production, this MUST be done server-side with proper crypto
        const encoder = new TextEncoder();
        const data = encoder.encode(message + secret);

        // Simple hash for demo - NOT cryptographically secure!
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            hash = ((hash << 5) - hash) + data[i];
            hash = hash & hash;
        }

        return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array([hash]))))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    }

    /**
     * Start call duration timer
     */
    private startCallDurationTimer(): void {
        this.callDurationInterval = setInterval(() => {
            const duration = callStore.callDuration + 1;
            callStore.updateCallDuration(duration);
        }, 1000);
    }

    /**
     * Stop call duration timer
     */
    private stopCallDurationTimer(): void {
        if (this.callDurationInterval) {
            clearInterval(this.callDurationInterval);
            this.callDurationInterval = null;
        }
    }

    /**
     * Save call to history
     */
    private async saveCallHistory(entry: CallHistoryEntry): Promise<void> {
        try {
            await storageService.saveCallHistory(entry);
        } catch (error) {
            console.error('Failed to save call history:', error);
        }
    }
}

export const callManager = new CallManager();
