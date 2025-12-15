// Core types for the video calling application

export interface Contact {
    id: string;
    name: string;
    phoneNumber: string;
    avatar?: string;
    fcmToken?: string;
    isOnline?: boolean;
    lastSeen?: Date;
}

export interface CallHistoryEntry {
    id: string;
    contactId: string;
    contactName: string;
    contactAvatar?: string;
    type: 'incoming' | 'outgoing' | 'missed';
    duration?: number; // in seconds
    timestamp: Date;
    wasVideoCall: boolean;
}

export type CallState =
    | 'idle'
    | 'initiating'
    | 'ringing'
    | 'connecting'
    | 'connected'
    | 'reconnecting'
    | 'ended';

export interface RoomMetadata {
    roomName: string;
    caller: Participant;
    callee: Participant;
    startTime?: Date;
    endTime?: Date;
}

export interface Participant {
    id: string;
    name: string;
    avatar?: string;
    fcmToken?: string;
}

export interface CallNotification {
    callId: string;
    callerName: string;
    callerAvatar?: string;
    roomName: string;
    timestamp: Date;
    callerFcmToken?: string;
}

export interface PerformanceMetrics {
    fps: number;
    memoryUsage: number;
    cpuUsage?: number;
    videoQuality: 'audio-only' | 'low' | 'medium' | 'high';
    networkQuality: number; // 0-100
}

export interface VideoTrackSettings {
    width: number;
    height: number;
    frameRate: number;
    facingMode?: 'user' | 'environment';
}

export interface AudioTrackSettings {
    echoCancellation: boolean;
    noiseSuppression: boolean;
    autoGainControl: boolean;
}
