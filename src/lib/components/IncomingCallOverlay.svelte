<script lang="ts">
    /**
     * IncomingCallOverlay - Full-screen incoming call notification
     * Slide-to-answer gesture with haptic feedback
     */

    import { callStore } from "../stores/call-store.svelte";
    import { callManager } from "../services/call-manager";
    import { Haptics, ImpactStyle } from "@capacitor/haptics";
    import { scale, slide } from "svelte/transition";

    let slidePosition = $state(0);
    let isDragging = $state(false);
    let startX = 0;
    const threshold = 100; // pixels to slide before accepting

    function handleTouchStart(e: TouchEvent) {
        isDragging = true;
        startX = e.touches[0].clientX - slidePosition;
    }

    function handleTouchMove(e: TouchEvent) {
        if (!isDragging) return;

        const currentX = e.touches[0].clientX - startX;
        slidePosition = Math.max(0, Math.min(currentX, threshold));

        // Haptic feedback at halfway point
        if (
            slidePosition > threshold / 2 &&
            slidePosition < threshold / 2 + 2
        ) {
            Haptics.impact({ style: ImpactStyle.Light });
        }
    }

    async function handleTouchEnd() {
        if (slidePosition >= threshold) {
            await Haptics.impact({ style: "medium" });
            await callManager.acceptCall();
        } else {
            slidePosition = 0;
        }
        isDragging = false;
    }

    async function handleReject() {
        await Haptics.impact({ style: ImpactStyle.Heavy });
        await callManager.rejectCall();
    }
</script>

{#if callStore.incomingCall}
    <div
        class="incoming-call-overlay"
        transition:scale={{ duration: 300, start: 0.9 }}
    >
        <div class="content">
            <!-- Caller info -->
            <div class="caller-info">
                <div class="avatar pulse">
                    {#if callStore.incomingCall.callerAvatar}
                        <img
                            src={callStore.incomingCall.callerAvatar}
                            alt={callStore.incomingCall.callerName}
                        />
                    {:else}
                        <div class="avatar-placeholder">
                            {callStore.incomingCall.callerName
                                .charAt(0)
                                .toUpperCase()}
                        </div>
                    {/if}
                </div>

                <div class="caller-name">
                    {callStore.incomingCall.callerName}
                </div>
                <div class="call-type">WhatsApp Video Call</div>
            </div>

            <!-- Slide to answer -->
            <div class="answer-container">
                <div
                    class="answer-slider"
                    ontouchstart={handleTouchStart}
                    ontouchmove={handleTouchMove}
                    ontouchend={handleTouchEnd}
                >
                    <div class="slider-track">
                        <div
                            class="slider-progress"
                            style="width: {(slidePosition / threshold) * 100}%"
                        ></div>
                        <span class="slider-text">Slide to answer</span>
                    </div>
                    <div
                        class="slider-thumb"
                        style="transform: translateX({slidePosition}px) translateZ(0)"
                    >
                        <svg viewBox="0 0 24 24" fill="white">
                            <path
                                d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"
                            />
                        </svg>
                    </div>
                </div>
            </div>

            <!-- Reject button -->
            <button class="reject-btn button-press" onclick={handleReject}>
                <svg viewBox="0 0 24 24" fill="white">
                    <path
                        d="M19.79,15.41C18.46,15.41,17.17,15.21,16,14.82C15.66,14.7,15.26,14.79,15,15.05L13.59,17.02C11.55,15.9,9.11,13.46,8,11.41L9.95,10.04C10.21,9.78,10.3,9.38,10.18,9.04C9.79,7.87,9.59,6.58,9.59,5.25C9.59,4.84,9.25,4.5,8.84,4.5H5.25C4.84,4.5,4.5,4.84,4.5,5.25C4.5,13.99,11.51,21,20.25,21C20.66,21,21,20.66,21,20.25V16.66C21,16.25,20.66,15.91,20.25,15.91L19.79,15.41Z"
                    />
                </svg>
                <span>Decline</span>
            </button>
        </div>
    </div>
{/if}

<style>
    .incoming-call-overlay {
        position: fixed;
        inset: 0;
        background: linear-gradient(
            135deg,
            var(--primary-dark),
            var(--secondary)
        );
        z-index: var(--z-notification);
        display: flex;
        align-items: center;
        justify-content: center;
        transform: translateZ(0);
    }

    .content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--spacing-xl);
        padding: var(--spacing-xl);
        width: 100%;
    }

    .caller-info {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--spacing-md);
    }

    .avatar {
        width: 120px;
        height: 120px;
        border-radius: var(--radius-full);
        overflow: hidden;
        border: 4px solid white;
        box-shadow: var(--shadow-3);
    }

    .avatar.pulse {
        animation: pulse 1.5s ease-in-out infinite;
    }

    .avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .avatar-placeholder {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--primary);
        color: white;
        font-size: 48px;
        font-weight: 600;
    }

    .caller-name {
        font-size: 32px;
        font-weight: 600;
        color: white;
        text-align: center;
    }

    .call-type {
        font-size: var(--font-size-lg);
        color: rgba(255, 255, 255, 0.8);
    }

    .answer-container {
        width: 100%;
        max-width: 320px;
        margin-top: var(--spacing-xl);
    }

    .answer-slider {
        position: relative;
        touch-action: none;
    }

    .slider-track {
        position: relative;
        height: 64px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: var(--radius-full);
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .slider-progress {
        position: absolute;
        left: 0;
        top: 0;
        height: 100%;
        background: var(--success);
        transition: width 0.1s ease-out;
        transform: translateZ(0);
    }

    .slider-text {
        position: relative;
        z-index: 1;
        color: white;
        font-size: var(--font-size-md);
        font-weight: 500;
        pointer-events: none;
    }

    .slider-thumb {
        position: absolute;
        left: 8px;
        top: 8px;
        width: 48px;
        height: 48px;
        background: white;
        border-radius: var(--radius-full);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: var(--shadow-2);
        will-change: transform;
    }

    .slider-thumb svg {
        width: 24px;
        height: 24px;
        fill: var(--success);
    }

    .reject-btn {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        padding: var(--spacing-md) var(--spacing-xl);
        background: var(--error);
        border-radius: var(--radius-full);
        color: white;
        font-size: var(--font-size-lg);
        font-weight: 500;
        box-shadow: var(--shadow-2);
        margin-top: var(--spacing-lg);
    }

    .reject-btn svg {
        width: 24px;
        height: 24px;
    }

    @keyframes pulse {
        0%,
        100% {
            transform: scale(1) translateZ(0);
        }
        50% {
            transform: scale(1.05) translateZ(0);
        }
    }
</style>
