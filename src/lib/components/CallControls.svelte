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
    <div class="controls-row">
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

        <!-- End call (Center) -->
        <button
            class="control-btn end-call"
            onclick={handleEndCall}
            aria-label="End call"
        >
            <svg class="icon icon-lg" viewBox="0 0 24 24" fill="currentColor">
                <path
                    d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"
                />
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
    </div>
</div>

<style>
    .call-controls {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        padding: var(--spacing-xl) var(--spacing-sm);
        padding-bottom: calc(var(--spacing-xl) + env(safe-area-inset-bottom));
        background: linear-gradient(to top, rgba(0, 0, 0, 0.7), transparent);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--spacing-md);
        pointer-events: none;
        transform: translateZ(0);
        width: 100%;
    }

    .duration {
        color: var(--text-primary);
        font-size: var(--font-size-lg);
        font-weight: 500;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
        pointer-events: none;
        margin-bottom: var(--spacing-sm);
    }

    .controls-row {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--spacing-md); /* Default gap */
        width: 100%;
        max-width: 100%;
        pointer-events: auto;
        overflow-x: auto; /* Safety for very small screens */
        padding: 0 var(--spacing-xs);
    }

    .control-btn {
        width: 50px;
        height: 50px;
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
        flex-shrink: 0;
    }

    .control-btn:active {
        transform: scale(0.9) translateZ(0);
    }

    .control-btn.active {
        background: var(
            --text-primary
        ); /* White when active (optional style choice, logic was error red before) */
        background: rgba(255, 255, 255, 0.9);
        color: var(--background);
        border-color: transparent;
    }

    /* Restore error color for End Call specifically */
    .control-btn.end-call {
        background: var(--error);
        width: 64px; /* Slightly larger */
        height: 64px;
        box-shadow: 0 4px 12px rgba(255, 0, 0, 0.4);
    }

    .icon {
        width: 24px;
        height: 24px;
        color: inherit;
    }

    .control-btn.end-call .icon {
        color: white;
    }

    /* Mute/Video Off styles */
    .control-btn[aria-label="Unmute microphone"].active,
    .control-btn[aria-label="Turn on camera"].active {
        background: rgba(255, 255, 255, 0.9);
        color: black;
    }

    /* Revert to original active style logic if needed, but white Background for "Muted" is standard */
    /* Let's keep specific active class logic from previous: */

    .control-btn.active {
        background: white;
        color: black;
    }

    @media (max-width: 380px) {
        .controls-row {
            gap: var(--spacing-sm);
        }
        .control-btn {
            width: 44px;
            height: 44px;
        }
        .control-btn.end-call {
            width: 56px;
            height: 56px;
        }
    }
</style>
