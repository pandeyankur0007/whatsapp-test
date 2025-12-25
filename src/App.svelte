<script lang="ts">
  /**
   * Main App component - simplified for native calling
   */

  import { onMount } from "svelte";
  import { fcmService } from "./lib/services/fcm-service";
  import { initializeDemoData } from "./lib/services/storage-service";
  import ContactList from "./lib/components/ContactList.svelte";
  import type { Contact } from "./lib/types";
  import { callManager } from "./lib/services/call-manager";

  let isInitialized = $state(false);

  onMount(async () => {
    // Initialize storage and demo data
    await initializeDemoData();

    // Initialize FCM
    await fcmService.initialize();

    // Mark as initialized
    isInitialized = true;
  });

  function handleContactClick(contact: Contact) {
    // Initiate call via native plugin
    callManager.initiateCall(contact);
  }
</script>

<main>
  {#if !isInitialized}
    <!-- Loading state -->
    <div class="loading-container">
      <div class="loading-spinner"></div>
      <p>Initializing...</p>
    </div>
  {:else}
    <!-- Contact List -->
    <ContactList openContactInfo={handleContactClick} />
  {/if}
</main>

<style>
  main {
    width: 100%;
    height: 100vh;
    overflow: hidden;
    background: var(--background);
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
