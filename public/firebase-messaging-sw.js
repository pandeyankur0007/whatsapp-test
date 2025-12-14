// Firebase Cloud Messaging Service Worker
// This file must be in the public directory to handle push notifications

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
firebase.initializeApp({
    apiKey: "AIzaSyDKc4XUwTRwXQBHz33aw7wLgPYi-83I9wg",
    authDomain: "whatsapp-test-99f25.firebaseapp.com",
    projectId: "whatsapp-test-99f25",
    storageBucket: "whatsapp-test-99f25.firebasestorage.app",
    messagingSenderId: "67166229406",
    appId: "1:67166229406:web:fad9ee0f05af2dd1493c8f",
    measurementId: "G-T1EG998J70"
});

// Retrieve an instance of Firebase Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message', payload);

    const notificationTitle = payload.notification?.title || 'Incoming Call';
    const notificationOptions = {
        body: payload.notification?.body || 'WhatsApp Video Call',
        icon: '/vite.svg',
        badge: '/vite.svg',
        tag: 'incoming-call',
        requireInteraction: true,
        data: payload.data
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    console.log('[firebase-messaging-sw.js] Notification click received.');

    event.notification.close();

    // Open the app
    event.waitUntil(
        clients.openWindow('/')
    );
});
