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

    let {
        openContactInfo,
    }: {
        openContactInfo: (contact: Contact) => void;
    } = $props();

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
                  observeElementRect: (instance, cb) => {
                      const ro = new ResizeObserver((entries) => {
                          cb(entries[0].contentRect);
                      });
                      if (instance.scrollElement) {
                          ro.observe(instance.scrollElement);
                      }
                      return () => ro.disconnect();
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
                        <div
                            class="contact-avatar"
                            onclick={(e) => {
                                e.stopPropagation();
                                openContactInfo(contact);
                            }}
                            onkeydown={(e) => {
                                if (e.key === "Enter") {
                                    e.stopPropagation();
                                    openContactInfo(contact);
                                }
                            }}
                            role="button"
                            tabindex="0"
                        >
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
                                onclick={(e) => {
                                    e.stopPropagation();
                                    handleCallContact(contact);
                                }}
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
        color: var(--text-primary);
    }

    .header {
        padding: 10px 16px;
        padding-top: calc(10px + env(safe-area-inset-top));
        background: var(--background-secondary);
        display: flex;
        flex-direction: column;
        gap: 10px;
        box-shadow: 0 1px 0 rgba(255, 255, 255, 0.05);
        z-index: 10;
    }

    .header-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        height: 48px;
    }

    h1 {
        font-size: 20px;
        font-weight: 500;
        color: var(
            --text-secondary
        ); /* WhatsApp uses secondary color for title */
    }

    .search-box {
        background: var(--surface);
        border-radius: 8px;
        height: 36px;
        display: flex;
        align-items: center;
        padding: 0 12px;
    }

    .search-icon {
        width: 18px;
        height: 18px;
        color: var(--text-secondary);
        margin-right: 12px;
    }

    .search-box input {
        background: transparent;
        border: none;
        color: var(--text-primary);
        width: 100%;
        font-size: 15px;
        outline: none;
    }

    .contact-scroll {
        flex: 1;
        overflow-y: auto;
    }

    /* WhatsApp List Item Style */
    .contact-item {
        display: flex;
        align-items: center;
        padding: 0 16px; /* WhatsApp padding */
        height: 72px; /* WhatsApp standard row height */
        width: 100%;
        cursor: pointer;
        position: relative;
    }

    .contact-item:active {
        background: rgba(255, 255, 255, 0.05); /* Subtle ripple effect */
    }

    .contact-avatar {
        width: 48px;
        height: 48px;
        margin-right: 16px;
        position: relative;
    }

    .contact-avatar img,
    .avatar-placeholder {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        object-fit: cover;
    }

    .avatar-placeholder {
        background: var(--surface-hover);
        color: var(--text-secondary);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        font-size: 20px;
        border: none; /* Removed border */
    }

    .contact-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
        height: 100%;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05); /* Separator */
        padding-right: 8px;
    }

    .contact-name {
        font-size: 17px;
        font-weight: 500; /* WhatsApp uses medium weight */
        color: var(--text-primary);
        margin-bottom: 2px;
    }

    .contact-phone {
        font-size: 14px;
        color: var(--text-secondary);
    }

    /* Call Action similar to WhatsApp Calls tab */
    .actions {
        display: flex;
        align-items: center;
        height: 100%;
        padding-left: 8px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    .call-btn {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: none;
        background: transparent;
        color: var(--primary); /* WhatsApp Green */
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
    }

    .call-btn:active {
        background: rgba(37, 211, 102, 0.1);
    }

    .call-btn svg {
        width: 24px; /* Larger icon */
        height: 24px;
    }

    /* Utilities */
    .online-indicator {
        position: absolute;
        bottom: 2px;
        right: 2px;
        width: 12px;
        height: 12px;
        background: var(--success);
        border: 2px solid var(--background);
        border-radius: 50%;
    }

    .empty-state {
        padding: 40px;
        text-align: center;
        color: var(--text-secondary);
    }

    /* Token UI */
    .token-btn {
        color: var(--primary);
        background: transparent;
        font-weight: 500;
        font-size: 14px;
        border: none;
    }

    .my-token-box {
        margin: 0 16px 10px 16px;
        padding: 12px;
        background: var(--surface);
        border-radius: 8px;
    }

    .token-value {
        font-family: monospace;
        color: var(--text-primary);
        margin-top: 4px;
        font-size: 13px;
    }
</style>
