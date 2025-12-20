<script lang="ts">
  /**
   * Main App component with navigation and call state management
   */

  import { onMount, onDestroy } from "svelte";
  import { callStore } from "./lib/stores/call-store.svelte";
  import { fcmService } from "./lib/services/fcm-service";
  import { liveKitService } from "./lib/services/livekit-service";
  import { App } from "@capacitor/app";
  import { callManager } from "./lib/services/call-manager";
  import { initializeDemoData } from "./lib/services/storage-service";
  import { FrameRateMonitor } from "./lib/utils/performance";

  import ContactList from "./lib/components/ContactList.svelte";
  import CallHistory from "./lib/components/CallHistory.svelte";
  import CallScreen from "./lib/components/CallScreen.svelte";
  import IncomingCallOverlay from "./lib/components/IncomingCallOverlay.svelte";
  import type { Contact } from "./lib/types";

  let currentTab = $state<"contacts" | "history" | "contact-info">("contacts");
  let selectedContact = $state<Contact | null>(null);
  let fpsMonitor: FrameRateMonitor;
  let isInitialized = $state(false);

  onMount(async () => {
    // Initialize storage and demo data
    await initializeDemoData();

    // Initialize FCM
    fcmService.initialize();

    // Start FPS monitoring
    fpsMonitor = new FrameRateMonitor();
    fpsMonitor.start((fps) => {
      callStore.updatePerformanceMetrics({ fps });
    });

    // Mark as initialized
    isInitialized = true;

    // Handle App Lifecycle for Video Calls
    App.addListener("appStateChange", ({ isActive }) => {
      console.log("App state changed. Is active?", isActive);
      if (isActive) {
        liveKitService.handleAppResume();
      } else {
        liveKitService.handleAppPause();
      }
    });
  });

  onDestroy(() => {
    if (fpsMonitor) {
      fpsMonitor.stop();
    }
  });

  function switchTab(tab: "contacts" | "history" | "contact-info") {
    currentTab = tab;
  }

  function openContactInfo(contact: Contact) {
    selectedContact = contact;
    currentTab = "contact-info";
  }

  function goBack() {
    if (currentTab === "contact-info") {
      currentTab = "contacts";
    }
  }

  // Handle user interaction to unlock AudioContext
  function handleInteraction() {
    const AudioContext =
      window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContext) {
      const ctx = new AudioContext();
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      // Unlock Web Audio
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);

      window.removeEventListener("click", handleInteraction);
      window.removeEventListener("touchstart", handleInteraction);
    }
  }

  onMount(() => {
    window.addEventListener("click", handleInteraction);
    window.addEventListener("touchstart", handleInteraction);
  });
</script>

<main>
  {#if !isInitialized}
    <!-- Loading state -->
    <div class="loading-container">
      <div class="loading-spinner"></div>
      <p>Initializing...</p>
    </div>
  {:else if callStore.callState === "connected" || callStore.callState === "connecting" || callStore.callState === "reconnecting"}
    <!-- Active call screen -->
    <CallScreen />
  {:else}
    <!-- Main app interface -->
    <div class="app-container">
      <!-- Navigation tabs -->
      <nav class="nav-tabs safe-area-top">
        <button
          class="tab"
          class:active={currentTab === "contacts"}
          onclick={() => switchTab("contacts")}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <span>Contacts</span>
        </button>

        <button
          class="tab"
          class:active={currentTab === "history"}
          onclick={() => switchTab("history")}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span>Recent</span>
        </button>
      </nav>

      <!-- Content area -->
      <div class="content">
        {#if currentTab === "contacts"}
          <ContactList {openContactInfo} />
        {:else if currentTab === "history"}
          <CallHistory />
        {:else if currentTab === "contact-info" && selectedContact}
          <div class="contact-info-view">
            <header class="chat-header safe-area-top">
              <div class="header-left">
                <button
                  class="back-btn"
                  onclick={goBack}
                  aria-label="Back to contacts"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="m15 18-6-6 6-6"></path>
                  </svg>
                </button>
                <span>Contact Info</span>
              </div>
            </header>
            <div class="info-content">
              <div class="large-avatar pulse">
                {#if selectedContact.avatar}
                  <img
                    src={selectedContact.avatar}
                    alt={selectedContact.name}
                  />
                {:else}
                  <div class="avatar-placeholder">
                    {selectedContact.name.charAt(0).toUpperCase()}
                  </div>
                {/if}
              </div>
              <h2>{selectedContact.name}</h2>
              <p class="phone">{selectedContact.phoneNumber}</p>

              <div class="info-actions">
                <button
                  class="info-action-btn"
                  onclick={() => callManager.initiateCall(selectedContact!)}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path
                      d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"
                    />
                  </svg>
                  <span>Video Call</span>
                </button>
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Incoming call overlay -->
  <IncomingCallOverlay />

  <!-- Performance metrics (dev only) -->
  {#if import.meta.env.DEV}
    <div class="performance-metrics">
      <span>FPS: {callStore.performanceMetrics.fps}</span>
    </div>
  {/if}
</main>

<style>
  main {
    width: 100%;
    height: 100vh;
    overflow: hidden;
  }

  .app-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--background);
  }

  .nav-tabs {
    display: flex;
    background: var(--background-secondary);
    border-bottom: 1px solid var(--surface);
    padding-top: env(safe-area-inset-top);
  }

  .tab {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-md);
    color: var(--text-secondary);
    transition: color var(--transition-fast);
    position: relative;
    background: transparent;
    border: none;
  }

  .tab svg {
    width: 24px;
    height: 24px;
  }

  .tab span {
    font-size: var(--font-size-sm);
    font-weight: 500;
  }

  .tab.active {
    color: var(--primary);
  }

  .tab.active::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--primary);
  }

  .content {
    flex: 1;
    overflow: hidden;
  }

  .performance-metrics {
    position: fixed;
    top: 10px;
    left: 10px;
    background: rgba(0, 0, 0, 0.8);
    color: var(--primary);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-family: monospace;
    z-index: 9999;
    pointer-events: none;
  }

  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: var(--spacing-lg);
    color: var(--text-secondary);
  }

  .loading-spinner {
    width: 48px;
    height: 48px;
    border: 4px solid var(--text-tertiary);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Contact Info Styles */
  .contact-info-view {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 100;
  }

  .info-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--spacing-xl);
    gap: var(--spacing-lg);
  }

  .large-avatar {
    width: 200px;
    height: 200px;
    border-radius: 50%;
    overflow: hidden;
    box-shadow: var(--shadow-3);
  }

  .large-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .info-actions {
    display: flex;
    gap: var(--spacing-md);
    margin-top: var(--spacing-lg);
  }

  .info-action-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-xs);
    background: transparent;
    border: none;
    color: var(--primary);
  }

  .info-action-btn svg {
    width: 32px;
    height: 32px;
  }
</style>
