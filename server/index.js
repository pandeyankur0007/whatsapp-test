/**
 * Backend server for WhatsApp-style video calling app
 * Handles LiveKit token generation and FCM push notifications
 */

import express from 'express';
import cors from 'cors';
import { AccessToken } from 'livekit-server-sdk';
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { readFile } from 'fs/promises';
import { networkInterfaces } from 'os';

dotenv.config({ path: '../.env' });

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// LiveKit configuration
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'devkey';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'secret';

// Initialize Firebase Admin (if service account exists)
let firebaseInitialized = false;
try {
    // Try to load service account
    const serviceAccount = JSON.parse(
        await readFile('./firebase-service-account.json', 'utf-8')
    );

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });

    firebaseInitialized = true;
    console.log('Firebase Admin initialized');
} catch (error) {
    console.warn('Firebase Admin not initialized - FCM notifications will not work');
    console.warn('Place your firebase-service-account.json in the server directory');
}

/**
 * Generate LiveKit access token
 * GET /token?roomName=xxx&participantName=xxx
 */
app.get('/token', async (req, res) => {
    try {
        const { roomName, participantName } = req.query;

        if (!roomName || !participantName) {
            return res.status(400).json({
                error: 'roomName and participantName are required'
            });
        }

        // Create access token
        const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
            identity: participantName,
            ttl: '2h',
        });

        // Grant permissions
        at.addGrant({
            room: roomName,
            roomJoin: true,
            canPublish: true,
            canSubscribe: true,
        });

        const token = await at.toJwt();

        res.json({ token });
    } catch (error) {
        console.error('Error generating token:', error);
        res.status(500).json({ error: 'Failed to generate token' });
    }
});

/**
 * Send FCM push notification for incoming call
 * POST /call/notify
 * Body: { recipientToken, callerName, roomName, callerAvatar?, type }
 */
app.post('/call/notify', async (req, res) => {
    try {
        if (!firebaseInitialized) {
            return res.status(503).json({
                error: 'FCM not configured. Add firebase-service-account.json'
            });
        }

        const { recipientToken, callerName, roomName, callerAvatar, type } = req.body;

        if (!recipientToken || !callerName || !roomName) {
            return res.status(400).json({
                error: 'recipientToken, callerName, and roomName are required'
            });
        }

        const message = {
            token: recipientToken,
            // notification: { ... }  <-- REMOVED: Triggers system tray notification automatically, bypassing onMessageReceived
            data: { // Use data payload for custom information
                type: type || 'incoming_call',
                callerName,
                roomName,
                callerAvatar: callerAvatar || '',
                callId: `call_${Date.now()}`,
                livekitToken: await generateCalleeToken(callerName, roomName) // Generate token for callee (using callerName as identity for now, or random)
            },
            android: {
                priority: 'high',
                // notification: { ... } <-- REMOVED
            }
        };

        const response = await admin.messaging().send(message);
        console.log('FCM notification sent:', response);

        res.json({ success: true, messageId: response });
    } catch (error) {
        console.error('Error sending FCM notification:', error);
        res.status(500).json({ error: 'Failed to send notification' });
    }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        livekit: 'configured',
        fcm: firebaseInitialized ? 'configured' : 'not configured'
    });
});

// Start server
// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
🚀 Server running on port ${PORT}

Endpoints:
  GET  /token?roomName=xxx&participantName=xxx - Generate LiveKit token
  POST /call/notify - Send FCM push notification
  GET  /health - Health check

Configuration:
  LiveKit API Key: ${LIVEKIT_API_KEY}
  FCM Status: ${firebaseInitialized ? '✓ Configured' : '✗ Not configured'}
  External Access: http://${getIpAddress()}:${PORT}
  `);
});


function getIpAddress() {
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return 'localhost';
}

async function generateCalleeToken(participantName, roomName) {
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
        identity: `user_${Math.floor(Math.random() * 10000)}`, // Generate a random identity for the callee for now, or use recipientToken if it was an ID
        name: 'Recipient',
        ttl: '2h',
    });

    at.addGrant({
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
    });

    return await at.toJwt();
}
