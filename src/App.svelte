<script lang="ts">
  /**
   * Main App component with navigation and call state management
   */

  import { onMount, onDestroy } from "svelte";
  import { callStore } from "./lib/stores/call-store.svelte";
  import { fcmService } from "./lib/services/fcm-service";
  import { initializeDemoData } from "./lib/services/storage-service";
  import { FrameRateMonitor } from "./lib/utils/performance";

  import ContactList from "./lib/components/ContactList.svelte";
  import CallHistory from "./lib/components/CallHistory.svelte";
  import CallScreen from "./lib/components/CallScreen.svelte";
  import IncomingCallOverlay from "./lib/components/IncomingCallOverlay.svelte";

  let currentTab = $state<"contacts" | "history">("contacts");
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
  });

  onDestroy(() => {
    if (fpsMonitor) {
      fpsMonitor.stop();
    }
  });

  function switchTab(tab: "contacts" | "history") {
    currentTab = tab;
  }
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
          <ContactList />
        {:else}
          <CallHistory />
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

  .dev-tools {
    position: fixed;
    top: 10px;
    left: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 9999;
    pointer-events: none;
  }

  .metrics {
    background: rgba(0, 0, 0, 0.8);
    color: var(--primary);
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-family: monospace;
  }

  .simulate-btn {
    pointer-events: auto;
    background: rgba(255, 69, 0, 0.9);
    color: white;
    border: none;
    padding: 8px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
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
</style>
