<script lang="ts">
    /**
     * CallScreen - Main video call interface
     * Optimized for smooth performance during video calls
     */

    import { callStore } from "../stores/call-store.svelte";
    import VideoRenderer from "./VideoRenderer.svelte";
    import CallControls from "./CallControls.svelte";
    import { fade } from "svelte/transition";

    let showControls = $state(true);
    let controlsTimeout: ReturnType<typeof setTimeout> | null = null;

    function handleScreenTap() {
        showControls = true;
        callStore.showControls = true;

        // Auto-hide controls after 5 seconds
        if (controlsTimeout) {
            clearTimeout(controlsTimeout);
        }

        controlsTimeout = setTimeout(() => {
            showControls = false;
            callStore.showControls = false;
        }, 5000);
    }

    $effect(() => {
        // Show controls initially
        handleScreenTap();

        return () => {
            if (controlsTimeout) {
                clearTimeout(controlsTimeout);
            }
        };
    });
</script>

<div
    class="call-screen"
    onclick={handleScreenTap}
    onkeydown={(e) => e.key === "Enter" && handleScreenTap()}
    role="button"
    tabindex="0"
>
    <!-- Remote video (full screen) -->
    <div class="remote-video">
        <VideoRenderer isLocal={false} />

        <!-- Participant info overlay -->
        {#if showControls && callStore.remoteParticipant}
            <div class="participant-info" transition:fade={{ duration: 200 }}>
                <div class="avatar">
                    {#if callStore.remoteParticipant.avatar}
                        <img
                            src={callStore.remoteParticipant.avatar}
                            alt={callStore.remoteParticipant.name}
                        />
                    {:else}
                        <div class="avatar-placeholder">
                            {callStore.remoteParticipant.name
                                .charAt(0)
                                .toUpperCase()}
                        </div>
                    {/if}
                </div>
                <div class="name">{callStore.remoteParticipant.name}</div>
                {#if callStore.callState === "ringing"}
                    <div class="status">Ringing...</div>
                {:else if callStore.callState === "connecting"}
                    <div class="status">Connecting...</div>
                {:else if callStore.callState === "reconnecting"}
                    <div class="status">Reconnecting...</div>
                {/if}
            </div>
        {/if}

        <!-- Connection quality indicator -->
        {#if callStore.callState === "connected" && showControls}
            <div
                class="connection-quality {callStore.connectionQuality}"
                transition:fade={{ duration: 200 }}
            >
                <div class="quality-icon"></div>
            </div>
        {/if}
    </div>

    <!-- Local video (picture-in-picture) -->
    {#if callStore.callState === "connected" || callStore.callState === "reconnecting"}
        <div class="local-video" transition:fade={{ duration: 300 }}>
            <VideoRenderer isLocal={true} />
        </div>
    {/if}

    <!-- Call controls -->
    {#if showControls}
        <div transition:fade={{ duration: 200 }}>
            <CallControls />
        </div>
    {/if}
</div>

<style>
    .call-screen {
        position: fixed;
        inset: 0;
        background: var(--background);
        overflow: hidden;
        transform: translateZ(0);
    }

    .remote-video {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
    }

    .participant-info {
        position: absolute;
        top: var(--spacing-xl);
        top: calc(var(--spacing-xl) + env(safe-area-inset-top));
        left: 0;
        right: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--spacing-sm);
        padding: var(--spacing-lg);
        pointer-events: none;
        z-index: var(--z-modal);
    }

    .avatar {
        width: 80px;
        height: 80px;
        border-radius: var(--radius-full);
        overflow: hidden;
        border: 3px solid white;
        box-shadow: var(--shadow-3);
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
        font-size: var(--font-size-xl);
        font-weight: 600;
    }

    .name {
        font-size: var(--font-size-xl);
        font-weight: 600;
        color: white;
        text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
    }

    .status {
        font-size: var(--font-size-md);
        color: rgba(255, 255, 255, 0.9);
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
    }

    .connection-quality {
        position: absolute;
        top: var(--spacing-lg);
        top: calc(var(--spacing-lg) + env(safe-area-inset-top));
        right: var(--spacing-lg);
        width: 12px;
        height: 12px;
        border-radius: var(--radius-full);
        z-index: var(--z-modal);
    }

    .quality-icon {
        width: 100%;
        height: 100%;
        border-radius: inherit;
        animation: pulse 2s ease-in-out infinite;
    }

    .connection-quality.excellent .quality-icon {
        background: var(--success);
    }

    .connection-quality.good .quality-icon {
        background: var(--warning);
    }

    .connection-quality.poor .quality-icon {
        background: var(--error);
    }

    .local-video {
        position: absolute;
        top: calc(var(--spacing-xl) + env(safe-area-inset-top));
        right: var(--spacing-lg);
        width: 120px;
        height: 160px;
        border-radius: var(--radius-lg);
        overflow: hidden;
        box-shadow: var(--shadow-3);
        border: 2px solid rgba(255, 255, 255, 0.2);
        z-index: var(--z-dropdown);
        transform: translateZ(0);
    }

    @keyframes pulse {
        0%,
        100% {
            transform: scale(1) translateZ(0);
            opacity: 1;
        }
        50% {
            transform: scale(1.2) translateZ(0);
            opacity: 0.7;
        }
    }

    @media (max-width: 480px) {
        .local-video {
            width: 100px;
            height: 133px;
            top: var(--spacing-lg);
            top: calc(var(--spacing-lg) + env(safe-area-inset-top));
            right: var(--spacing-md);
        }

        .avatar {
            width: 60px;
            height: 60px;
        }
    }
</style>
