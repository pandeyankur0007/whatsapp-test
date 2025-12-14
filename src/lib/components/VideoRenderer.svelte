<script lang="ts">
  /**
   * VideoRenderer - Optimized video rendering component
   * Uses direct DOM manipulation for best performance
   */

  import { onMount, onDestroy } from "svelte";
  import {
    enableGPUAcceleration,
    disableGPUAcceleration,
  } from "../utils/performance";

  interface Props {
    isLocal?: boolean;
    className?: string;
  }

  let { isLocal = false, className = "" }: Props = $props();

  let videoContainer: HTMLDivElement;
  let videoElement = $state<HTMLElement | null>(null);

  onMount(() => {
    // Listen for video ready events from LiveKit service
    const eventName = isLocal ? "local-video-ready" : "remote-video-ready";
    const updateEventName = isLocal
      ? "local-video-updated"
      : "remote-video-updated";

    const handleVideoReady = (event: CustomEvent) => {
      if (videoElement) {
        videoElement.remove();
      }

      videoElement = event.detail.element;

      // Enable GPU acceleration
      enableGPUAcceleration(videoElement);

      // Attach to container
      if (videoContainer) {
        videoContainer.appendChild(videoElement);
      }
    };

    window.addEventListener(eventName, handleVideoReady as EventListener);
    window.addEventListener(updateEventName, handleVideoReady as EventListener);

    return () => {
      window.removeEventListener(eventName, handleVideoReady as EventListener);
      window.removeEventListener(
        updateEventName,
        handleVideoReady as EventListener,
      );

      if (videoElement) {
        disableGPUAcceleration(videoElement);
        videoElement.remove();
      }
    };
  });
</script>

<div
  bind:this={videoContainer}
  class="video-renderer {className}"
  class:local={isLocal}
  class:remote={!isLocal}
>
  {#if !videoElement}
    <div class="video-placeholder">
      <div class="loading-spinner"></div>
    </div>
  {/if}
</div>

<style>
  .video-renderer {
    position: relative;
    width: 100%;
    height: 100%;
    background: var(--background);
    overflow: hidden;
  }

  .video-renderer :global(video) {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .video-placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--background-secondary);
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--text-tertiary);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    transform: translateZ(0);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg) translateZ(0);
    }
  }

  .local {
    border-radius: var(--radius-md);
  }
</style>
