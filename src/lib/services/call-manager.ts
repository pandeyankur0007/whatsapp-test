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
     * Get LiveKit access token from server
     */
    private async getCallToken(roomName: string, participantName: string): Promise<string> {
        try {
            const apiUrl = import.meta.env.VITE_API_URL;

            const response = await fetch(
                `${apiUrl}/token?roomName=${encodeURIComponent(roomName)}&participantName=${encodeURIComponent(participantName)}`
            );

            if (!response.ok) {
                throw new Error('Failed to get call token');
            }

            const data = await response.json();
            return data.token;

        } catch (error) {
            console.error('Error getting call token:', error);
            throw error;
        }
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
