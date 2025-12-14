/**
 * Firebase Cloud Messaging service for push notifications
 * Handles incoming call notifications
 */

import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';
import { callStore } from '../stores/call-store.svelte';
import type { CallNotification } from '../types';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDKc4XUwTRwXQBHz33aw7wLgPYi-83I9wg",
    authDomain: "whatsapp-test-99f25.firebaseapp.com",
    projectId: "whatsapp-test-99f25",
    storageBucket: "whatsapp-test-99f25.firebasestorage.app",
    messagingSenderId: "67166229406",
    appId: "1:67166229406:web:fad9ee0f05af2dd1493c8f",
    measurementId: "G-T1EG998J70"
};

class FCMService {
    private messaging: Messaging | null = null;
    private currentToken: string | null = null;

    async initialize(): Promise<void> {
        try {
            if (Capacitor.isNativePlatform()) {
                await this.initializeNative();
            } else {
                await this.initializeWeb();
            }
        } catch (error) {
            console.error('Failed to initialize FCM:', error);
        }
    }

    private async initializeNative(): Promise<void> {
        console.log('Initializing Native Push Notifications');

        // request permission
        const permission = await PushNotifications.requestPermissions();

        if (permission.receive === 'granted') {
            // register
            await PushNotifications.register();

            // Create notification channel for video calls
            await PushNotifications.createChannel({
                id: 'video_calls',
                name: 'Video Calls',
                description: 'Notifications for incoming video calls',
                importance: 5, // High importance
                visibility: 1, // Public visibility
                sound: 'ringtone.mp3', // Custom sound if valid, else default
                vibration: true
            });

            // handling registration (getting token)
            PushNotifications.addListener('registration', (token) => {
                console.log('Push Registration Token:', token.value);
                this.currentToken = token.value;
                localStorage.setItem('fcm_token', token.value);
            });

            PushNotifications.addListener('registrationError', (error) => {
                console.error('Push Registration Error:', error);
            });

            // handling incoming notification (foreground)
            PushNotifications.addListener('pushNotificationReceived', (notification) => {
                console.log('Push Received:', notification);
                this.handleIncomingCall(notification.data);
            });

            // handling notification click (background/closed)
            PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
                console.log('Push Action Performed:', notification);
                const data = notification.notification.data;
                this.handleIncomingCall(data);
            });
        }
    }

    private async initializeWeb(): Promise<void> {
        console.log('Initializing Web FCM');
        try {
            const app = initializeApp(firebaseConfig);
            this.messaging = getMessaging(app);

            // Request permission and get token
            const permission = await Notification.requestPermission();

            if (permission === 'granted' && this.messaging) {
                // Get VAPID key from: Firebase Console → Project Settings → Cloud Messaging → Web Push certificates
                this.currentToken = await getToken(this.messaging, {
                    vapidKey: 'BAV0tWXcZachTWtKYpHRUNzSXKt-sGeDk3O2UlcwjBwnOC6Cu1Qiig0sVbpbwg41JJwY_qa8DAY-ZueKTmh6utA'
                });

                console.log('Web FCM Token:', this.currentToken);
                if (this.currentToken) {
                    localStorage.setItem('fcm_token', this.currentToken);
                }

                // Setup listener
                onMessage(this.messaging, (payload) => {
                    console.log('Message received:', payload);
                    this.handleIncomingCall(payload.data);
                });
            }
        } catch (error) {
            console.error('Web FCM Error:', error);
        }
    }

    private handleIncomingCall(data: any) {
        if (!data) return;

        // Handle incoming call notification
        // Note: data payload structure might differ slightly between web/native
        if (data.type === 'incoming_call') {
            const notification: CallNotification = {
                callId: data.callId,
                callerName: data.callerName,
                callerAvatar: data.callerAvatar,
                roomName: data.roomName,
                timestamp: new Date()
            };

            callStore.setIncomingCall(notification);
            callStore.setCallState('ringing');

            // Play ringtone
            this.playRingtone();
        }
    }

    private playRingtone(): void {
        try {
            // Try playing file first
            const audio = new Audio('/ringtone.mp3');
            audio.loop = true;

            const promise = audio.play();
            if (promise !== undefined) {
                promise.catch(error => {
                    console.log('Using synthetic ringtone (file not found)');
                    this.playSynthRingtone();
                });
            }
            (window as any).__ringtone = audio;
        } catch (e) {
            this.playSynthRingtone();
        }
    }

    private playSynthRingtone(): void {
        if ((window as any).__synthReq) return; // Already playing

        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;

        const ctx = new AudioContext();

        // Try to resume if suspended (requires user gesture previously, but good to try)
        if (ctx.state === 'suspended') {
            ctx.resume().catch(err => console.warn('Could not resume audio context:', err));
        }

        let nextNoteTime = ctx.currentTime;

        const scheduleRing = () => {
            // High - Low tone pattern (classic phone ring)
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();

            osc1.connect(gain1);
            gain1.connect(ctx.destination);

            osc1.frequency.value = 800;
            gain1.gain.value = 0.5; // Increased volume

            osc1.start(nextNoteTime);
            osc1.stop(nextNoteTime + 0.4);

            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();

            osc2.connect(gain2);
            gain2.connect(ctx.destination);

            osc2.frequency.value = 600;
            gain2.gain.value = 0.5; // Increased volume

            osc2.start(nextNoteTime + 0.4);
            osc2.stop(nextNoteTime + 0.8);

            // Repeat every 2 seconds
            nextNoteTime += 2;

            // Keep loop going
            (window as any).__synthReq = requestAnimationFrame(scheduleRing);
        };

        scheduleRing();
        (window as any).__synthCtx = ctx;
    }

    stopRingtone(): void {
        // Stop Audio Element
        const audio = (window as any).__ringtone;
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
            delete (window as any).__ringtone;
        }

        // Stop Synth
        if ((window as any).__synthCtx) {
            (window as any).__synthCtx.close();
            cancelAnimationFrame((window as any).__synthReq);
            delete (window as any).__synthCtx;
            delete (window as any).__synthReq;
        }
    }

    getToken(): string | null {
        return this.currentToken || localStorage.getItem('fcm_token');
    }

    async sendCallNotification(
        recipientToken: string,
        callerName: string,
        roomName: string,
        callerAvatar?: string
    ): Promise<void> {
        try {
            const apiUrl = import.meta.env.VITE_API_URL;

            const response = await fetch(`${apiUrl}/call/notify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    recipientToken,
                    callerName,
                    roomName,
                    callerAvatar,
                    type: 'incoming_call'
                })
            });

            if (!response.ok) {
                throw new Error('Failed to send notification');
            }
        } catch (error) {
            console.error('Error sending call notification:', error);
            throw error;
        }
    }
}

export const fcmService = new FCMService();
