<script lang="ts">
    /**
     * ContactList - Virtual scrolling contact list with search
     * Optimized for 1000+ contacts with minimal memory footprint
     */

    import { onMount } from "svelte";
    import { createVirtualizer } from "@tanstack/svelte-virtual";
    import { storageService } from "../services/storage-service";
    import { callManager } from "../services/call-manager";
    import { Haptics, ImpactStyle } from "@capacitor/haptics";
    import type { Contact } from "../types";
    import { debounce } from "../utils/performance";

    import { fcmService } from "../services/fcm-service";

    let contacts = $state<Contact[]>([]);
    let filteredContacts = $state<Contact[]>([]);
    let searchQuery = $state("");
    let scrollContainer: HTMLDivElement;
    let myToken = $state<string>("");
    let showToken = $state(false);

    onMount(async () => {
        try {
            // Load contacts
            console.log("Fetching contacts...");
            contacts = await storageService.getAllContacts();
            console.log("Contacts loaded:", $state.snapshot(contacts));
            filteredContacts = contacts;

            // Get my token
            const token = fcmService.getToken();
            if (token) myToken = token;
        } catch (error) {
            console.error("Error loading contacts:", error);
        }
    });

    // Debounced search
    const handleSearchDebounced = debounce((query: string) => {
        if (!query.trim()) {
            filteredContacts = contacts;
        } else {
            const lowerQuery = query.toLowerCase();
            filteredContacts = contacts.filter(
                (contact) =>
                    contact.name.toLowerCase().includes(lowerQuery) ||
                    contact.phoneNumber.includes(query),
            );
        }
    }, 300);

    function handleSearch(e: Event) {
        const input = e.target as HTMLInputElement;
        searchQuery = input.value;
        handleSearchDebounced(searchQuery);
    }

    async function handleCallContact(contact: Contact) {
        await Haptics.impact({ style: ImpactStyle.Medium });
        await callManager.initiateCall(contact);
    }

    async function handleCopyToken() {
        if (myToken) {
            await navigator.clipboard.writeText(myToken);
            alert("Token copied! Send this to the other device.");
        } else {
            alert("No token generated yet. Check permissions.");
        }
    }

    async function handleEditContact(contact: Contact, e: Event) {
        e.stopPropagation(); // Prevent calling
        const newToken = prompt(
            `Enter FCM Token for ${contact.name}:`,
            contact.fcmToken || "",
        );
        if (newToken !== null) {
            const updatedContact = { ...contact, fcmToken: newToken };
            await storageService.saveContact(updatedContact);

            // Update local state
            const index = contacts.findIndex((c) => c.id === contact.id);
            if (index !== -1) {
                contacts[index] = updatedContact;
                // Re-filter to update view
                handleSearchDebounced(searchQuery);
            }
        }
    }

    // Virtual scroller - using $derived for Svelte 5
    let virtualizer = $derived(
        scrollContainer
            ? createVirtualizer({
                  count: filteredContacts.length,
                  getScrollElement: () => scrollContainer,
                  estimateSize: () => 72,
                  overscan: 5,
                  observeElementResize: (instance, cb) => {
                      const ro = new ResizeObserver(cb);
                      ro.observe(instance.scrollElement);
                      return ro;
                  },
              })
            : null,
    );
</script>

<div class="contact-list">
    <!-- Header -->
    <div class="header safe-area-top">
        <div class="header-top">
            <h1>Contacts</h1>
            <button class="token-btn" onclick={() => (showToken = !showToken)}>
                {showToken ? "Hide ID" : "My ID"}
            </button>
        </div>

        {#if showToken}
            <div class="my-token-box">
                <p>Share this token with the caller:</p>
                <div
                    class="token-value"
                    onclick={handleCopyToken}
                    onkeydown={(e) => e.key === "Enter" && handleCopyToken()}
                    role="button"
                    tabindex="0"
                >
                    {myToken ? myToken.slice(0, 20) + "..." : "Loading..."}
                    <span class="copy-icon">📋</span>
                </div>
            </div>
        {/if}

        <div class="search-box">
            <svg
                class="search-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
            >
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
            </svg>
            <input
                type="text"
                placeholder="Search contacts..."
                value={searchQuery}
                oninput={handleSearch}
            />
        </div>
    </div>

    <!-- Virtual scrolling list -->
    <div bind:this={scrollContainer} class="contact-scroll">
        {#if filteredContacts.length === 0}
            <div class="empty-state">
                <p>No contacts found.</p>
                {#if searchQuery}
                    <small>Try a different search term</small>
                {/if}
            </div>
        {:else if virtualizer}
            {@const items = $virtualizer.getVirtualItems()}
            {@const totalSize = $virtualizer.getTotalSize()}
            <div
                style="height: {totalSize}px; position: relative; width: 100%;"
            >
                {#each items as item (item.index)}
                    {@const contact = filteredContacts[item.index]}
                    <div
                        class="contact-item button-press"
                        style="position: absolute; top: 0; left: 0; width: 100%; height: 72px; transform: translateY({item.start}px);"
                        onclick={() => handleCallContact(contact)}
                        onkeydown={(e) =>
                            e.key === "Enter" && handleCallContact(contact)}
                        role="button"
                        tabindex="0"
                    >
                        <div class="contact-avatar">
                            {#if contact.avatar}
                                <img
                                    src={contact.avatar}
                                    alt={contact.name}
                                    loading="lazy"
                                />
                            {:else}
                                <div class="avatar-placeholder">
                                    {contact.name.charAt(0).toUpperCase()}
                                </div>
                            {/if}
                            {#if contact.isOnline}
                                <div class="online-indicator"></div>
                            {/if}
                        </div>

                        <div class="contact-info">
                            <div class="contact-name">{contact.name}</div>
                            <div class="contact-phone">
                                {contact.phoneNumber}
                            </div>
                        </div>

                        <div class="actions">
                            <button
                                class="action-btn edit-btn"
                                aria-label="Edit {contact.name}"
                                onclick={(e) => handleEditContact(contact, e)}
                            >
                                ✏️
                            </button>
                            <button
                                class="action-btn call-btn"
                                aria-label="Call {contact.name}"
                            >
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path
                                        d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"
                                    />
                                </svg>
                            </button>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>

<style>
    .contact-list {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--background);
    }

    .header {
        padding: var(--spacing-lg);
        padding-top: calc(var(--spacing-lg) + env(safe-area-inset-top));
        background: var(--background-secondary);
        border-bottom: 1px solid var(--surface);
    }

    h1 {
        font-size: var(--font-size-xl);
        font-weight: 600;
        margin-bottom: var(--spacing-md);
    }

    .search-box {
        position: relative;
        display: flex;
        align-items: center;
    }

    .search-icon {
        position: absolute;
        left: var(--spacing-md);
        width: 20px;
        height: 20px;
        color: var(--text-tertiary);
        pointer-events: none;
    }

    .search-box input {
        width: 100%;
        padding: var(--spacing-sm) var(--spacing-md);
        padding-left: 40px;
        background: var(--surface);
        border-radius: var(--radius-md);
        color: var(--text-primary);
        font-size: var(--font-size-md);
    }

    .search-box input::placeholder {
        color: var(--text-tertiary);
    }

    .contact-scroll {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
    }

    .contact-item {
        display: flex;
        align-items: center;
        gap: var(--spacing-md);
        padding: var(--spacing-md) var(--spacing-lg);
        width: 100%;
        height: 72px;
        cursor: pointer;
        transition: background-color var(--transition-fast);
    }

    .contact-item:hover {
        background: var(--surface-hover);
    }

    .contact-item:active {
        background: var(--surface);
    }

    .contact-avatar {
        position: relative;
        width: 48px;
        height: 48px;
        flex-shrink: 0;
    }

    .contact-avatar img {
        width: 100%;
        height: 100%;
        border-radius: var(--radius-full);
        object-fit: cover;
    }

    .avatar-placeholder {
        width: 100%;
        height: 100%;
        border-radius: var(--radius-full);
        background: var(--primary);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 600;
        font-size: var(--font-size-lg);
    }

    .online-indicator {
        position: absolute;
        bottom: 0;
        right: 0;
        width: 12px;
        height: 12px;
        background: var(--success);
        border: 2px solid var(--background);
        border-radius: var(--radius-full);
    }

    .contact-info {
        flex: 1;
        min-width: 0;
    }

    .contact-name {
        font-size: var(--font-size-md);
        font-weight: 500;
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .contact-phone {
        font-size: var(--font-size-sm);
        color: var(--text-secondary);
    }

    .header-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--spacing-sm);
    }

    .token-btn {
        background: rgba(255, 255, 255, 0.1);
        border: none;
        color: var(--text-secondary);
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
    }

    .my-token-box {
        background: var(--surface-secondary);
        padding: var(--spacing-sm);
        border-radius: var(--radius-md);
        margin-bottom: var(--spacing-md);
        font-size: 12px;
    }

    .my-token-box p {
        margin-bottom: 4px;
        color: var(--text-secondary);
    }

    .token-value {
        font-family: monospace;
        background: rgba(0, 0, 0, 0.2);
        padding: 8px;
        border-radius: 4px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
    }

    .actions {
        display: flex;
        gap: var(--spacing-sm);
    }

    .action-btn {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .call-btn {
        background: var(--primary);
        color: white;
    }

    .edit-btn {
        background: var(--surface-secondary);
        color: var(--text-secondary);
        font-size: 14px;
    }

    .call-btn:active,
    .edit-btn:active {
        transform: scale(0.95);
    }

    .call-btn svg {
        width: 20px;
        height: 20px;
    }

    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: var(--text-tertiary);
        gap: var(--spacing-sm);
        padding: var(--spacing-xl);
        text-align: center;
    }

    .empty-state p {
        font-size: var(--font-size-lg);
        font-weight: 500;
    }
</style>
