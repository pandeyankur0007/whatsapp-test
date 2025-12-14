<script lang="ts">
    /**
     * CallControls - In-call control buttons
     * Optimized for touch interactions with haptic feedback
     */

    import { Haptics, ImpactStyle } from "@capacitor/haptics";
    import { callStore } from "../stores/call-store.svelte";
    import { callManager } from "../services/call-manager";

    async function handleMicToggle() {
        await Haptics.impact({ style: "Light" });
        await callManager.toggleMicrophone();
    }

    async function handleVideoToggle() {
        await Haptics.impact({ style: "Light" });
        await callManager.toggleCamera();
    }

    async function handleSpeakerToggle() {
        await Haptics.impact({ style: "Light" });
        callStore.toggleSpeaker();
    }

    async function handleCameraSwitch() {
        await Haptics.impact({ style: "Light" });
        await callManager.switchCamera();
    }

    async function handleEndCall() {
        await Haptics.impact({ style: ImpactStyle.Heavy });
        await callManager.endCall();
    }

    function formatDuration(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    }
</script>

<div class="call-controls">
    <!-- Call duration -->
    {#if callStore.callState === "connected"}
        <div class="duration">
            {formatDuration(callStore.callDuration)}
        </div>
    {/if}

    <!-- Control buttons -->
    <div class="controls-grid">
        <!-- Microphone toggle -->
        <button
            class="control-btn"
            class:active={callStore.isMicMuted}
            onclick={handleMicToggle}
            aria-label={callStore.isMicMuted
                ? "Unmute microphone"
                : "Mute microphone"}
        >
            <svg
                class="icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
            >
                {#if callStore.isMicMuted}
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                    <path
                        d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"
                    ></path>
                    <path
                        d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"
                    ></path>
                    <line x1="12" y1="19" x2="12" y2="23"></line>
                    <line x1="8" y1="23" x2="16" y2="23"></line>
                {:else}
                    <path
                        d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"
                    ></path>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                    <line x1="12" y1="19" x2="12" y2="23"></line>
                    <line x1="8" y1="23" x2="16" y2="23"></line>
                {/if}
            </svg>
        </button>

        <!-- Video toggle -->
        <button
            class="control-btn"
            class:active={callStore.isVideoMuted}
            onclick={handleVideoToggle}
            aria-label={callStore.isVideoMuted
                ? "Turn on camera"
                : "Turn off camera"}
        >
            <svg
                class="icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
            >
                {#if callStore.isVideoMuted}
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                    <path d="M10.66 5H14a2 2 0 0 1 2 2v2.34l1 1L23 7v10"></path>
                    <path
                        d="M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2l10 10z"
                    ></path>
                {:else}
                    <polygon points="23 7 16 12 23 17 23 7"></polygon>
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2"
                    ></rect>
                {/if}
            </svg>
        </button>

        <!-- Speaker toggle -->
        <button
            class="control-btn"
            class:active={!callStore.isSpeakerOn}
            onclick={handleSpeakerToggle}
            aria-label={callStore.isSpeakerOn
                ? "Turn off speaker"
                : "Turn on speaker"}
        >
            <svg
                class="icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
            >
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                {#if callStore.isSpeakerOn}
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                {:else}
                    <line x1="23" y1="9" x2="17" y2="15"></line>
                    <line x1="17" y1="9" x2="23" y2="15"></line>
                {/if}
            </svg>
        </button>

        <!-- Switch camera -->
        <button
            class="control-btn"
            onclick={handleCameraSwitch}
            aria-label="Switch camera"
        >
            <svg
                class="icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
            >
                <path d="M17 1l4 4-4 4"></path>
                <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                <path d="M7 23l-4-4 4-4"></path>
                <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
            </svg>
        </button>

        <!-- End call -->
        <button
            class="control-btn end-call"
            onclick={handleEndCall}
            aria-label="End call"
        >
            <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
                <path
                    d="M23,11.74c-0.64-0.43-1.33-0.76-2-1.08l-1.48,1.48c0.22,0.09,0.44,0.19,0.66,0.3 c0.37,0.19,0.66,0.49,0.84,0.85c0.18,0.36,0.27,0.77,0.27,1.19c0,0.42-0.09,0.83-0.27,1.19c-0.18,0.36-0.47,0.66-0.84,0.85 c-3.73,1.91-8.16,1.91-11.89,0c-0.37-0.19-0.66-0.49-0.84-0.85C7.27,15.31,7.18,14.9,7.18,14.48c0-0.42,0.09-0.83,0.27-1.19 c0.18-0.36,0.47-0.66,0.84-0.85c0.22-0.11,0.44-0.21,0.66-0.3L7.47,10.66c-0.67,0.32-1.36,0.65-2,1.08 C4.27,12.47,3.5,13.42,3.5,14.48c0,1.06,0.77,2.01,1.97,2.74c4.19,2.15,9.17,2.15,13.36,0c1.2-0.73,1.97-1.68,1.97-2.74 C20.8,13.42,20.03,12.47,23,11.74z M13.5,2v8.5c0,0.83-0.67,1.5-1.5,1.5s-1.5-0.67-1.5-1.5V2c0-0.83,0.67-1.5,1.5-1.5 S13.5,1.17,13.5,2z"
                />
            </svg>
        </button>
    </div>
</div>

<style>
    .call-controls {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        padding: var(--spacing-xl) var(--spacing-lg);
        padding-bottom: calc(var(--spacing-xl) + env(safe-area-inset-bottom));
        background: linear-gradient(to top, rgba(0, 0, 0, 0.7), transparent);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--spacing-md);
        pointer-events: none;
        transform: translateZ(0);
    }

    .duration {
        color: var(--text-primary);
        font-size: var(--font-size-lg);
        font-weight: 500;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
        pointer-events: none;
    }

    .controls-grid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: var(--spacing-md);
        width: 100%;
        max-width: 400px;
        pointer-events: auto;
    }

    .control-btn {
        width: 56px;
        height: 56px;
        border-radius: var(--radius-full);
        background: rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(10px);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all var(--transition-fast);
        border: 2px solid transparent;
        transform: translateZ(0);
        will-change: transform;
    }

    .control-btn:active {
        transform: scale(0.9) translateZ(0);
    }

    .control-btn.active {
        background: var(--error);
        border-color: var(--error);
    }

    .control-btn.end-call {
        background: var(--error);
        grid-column: 3;
    }

    .icon {
        width: 24px;
        height: 24px;
        color: white;
    }

    @media (max-width: 480px) {
        .controls-grid {
            max-width: 100%;
        }

        .control-btn {
            width: 48px;
            height: 48px;
        }

        .icon {
            width: 20px;
            height: 20px;
        }
    }
</style>
