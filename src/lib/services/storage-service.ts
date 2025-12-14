/**
 * IndexedDB-based local storage service
 * Stores contacts, call history, and user preferences
 */

import type { Contact, CallHistoryEntry } from '../types';

const DB_NAME = 'whatsapp_video_call';
const DB_VERSION = 1;

class StorageService {
    private db: IDBDatabase | null = null;

    async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                // Create object stores
                if (!db.objectStoreNames.contains('contacts')) {
                    const contactStore = db.createObjectStore('contacts', { keyPath: 'id' });
                    contactStore.createIndex('phoneNumber', 'phoneNumber', { unique: true });
                }

                if (!db.objectStoreNames.contains('callHistory')) {
                    const historyStore = db.createObjectStore('callHistory', { keyPath: 'id' });
                    historyStore.createIndex('timestamp', 'timestamp', { unique: false });
                    historyStore.createIndex('contactId', 'contactId', { unique: false });
                }

                if (!db.objectStoreNames.contains('preferences')) {
                    db.createObjectStore('preferences', { keyPath: 'key' });
                }
            };
        });
    }

    // Contact operations
    async saveContact(contact: Contact): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        const transaction = this.db.transaction(['contacts'], 'readwrite');
        const store = transaction.objectStore('contacts');

        return new Promise((resolve, reject) => {
            const request = store.put(contact);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getContact(id: string): Promise<Contact | null> {
        if (!this.db) throw new Error('Database not initialized');

        const transaction = this.db.transaction(['contacts'], 'readonly');
        const store = transaction.objectStore('contacts');

        return new Promise((resolve, reject) => {
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllContacts(): Promise<Contact[]> {
        if (!this.db) throw new Error('Database not initialized');

        const transaction = this.db.transaction(['contacts'], 'readonly');
        const store = transaction.objectStore('contacts');

        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteContact(id: string): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        const transaction = this.db.transaction(['contacts'], 'readwrite');
        const store = transaction.objectStore('contacts');

        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Call history operations
    async saveCallHistory(entry: CallHistoryEntry): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        const transaction = this.db.transaction(['callHistory'], 'readwrite');
        const store = transaction.objectStore('callHistory');

        return new Promise((resolve, reject) => {
            const request = store.put(entry);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getCallHistory(limit: number = 100): Promise<CallHistoryEntry[]> {
        if (!this.db) throw new Error('Database not initialized');

        const transaction = this.db.transaction(['callHistory'], 'readonly');
        const store = transaction.objectStore('callHistory');
        const index = store.index('timestamp');

        return new Promise((resolve, reject) => {
            const request = index.openCursor(null, 'prev'); // Descending order
            const results: CallHistoryEntry[] = [];

            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest).result;
                if (cursor && results.length < limit) {
                    results.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };

            request.onerror = () => reject(request.error);
        });
    }

    async getCallHistoryForContact(contactId: string): Promise<CallHistoryEntry[]> {
        if (!this.db) throw new Error('Database not initialized');

        const transaction = this.db.transaction(['callHistory'], 'readonly');
        const store = transaction.objectStore('callHistory');
        const index = store.index('contactId');

        return new Promise((resolve, reject) => {
            const request = index.getAll(contactId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Preferences
    async setPreference(key: string, value: any): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        const transaction = this.db.transaction(['preferences'], 'readwrite');
        const store = transaction.objectStore('preferences');

        return new Promise((resolve, reject) => {
            const request = store.put({ key, value });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getPreference<T>(key: string): Promise<T | null> {
        if (!this.db) throw new Error('Database not initialized');

        const transaction = this.db.transaction(['preferences'], 'readonly');
        const store = transaction.objectStore('preferences');

        return new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result?.value || null);
            request.onerror = () => reject(request.error);
        });
    }
}

export const storageService = new StorageService();

// Initialize some demo contacts
export async function initializeDemoData() {
    await storageService.init();

    const contacts = await storageService.getAllContacts();
    if (contacts.length === 0) {
        // Add demo contacts
        const demoContacts: Contact[] = [
            {
                id: '1',
                name: 'Alice Johnson',
                phoneNumber: '+1234567890',
                avatar: 'https://i.pravatar.cc/150?img=1',
                isOnline: true
            },
            {
                id: '2',
                name: 'Bob Smith',
                phoneNumber: '+1234567891',
                avatar: 'https://i.pravatar.cc/150?img=2',
                isOnline: false
            },
            {
                id: '3',
                name: 'Carol Williams',
                phoneNumber: '+1234567892',
                avatar: 'https://i.pravatar.cc/150?img=3',
                isOnline: true
            },
            {
                id: '4',
                name: 'David Brown',
                phoneNumber: '+1234567893',
                avatar: 'https://i.pravatar.cc/150?img=4',
                isOnline: false
            },
            {
                id: '5',
                name: 'Emma Davis',
                phoneNumber: '+1234567894',
                avatar: 'https://i.pravatar.cc/150?img=5',
                isOnline: true
            }
        ];

        for (const contact of demoContacts) {
            await storageService.saveContact(contact);
        }
    }
}
