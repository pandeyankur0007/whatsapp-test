<script lang="ts">
    /**
     * CallHistory - Virtual scrolling call history
     */

    import { onMount } from "svelte";
    import { createVirtualizer } from "@tanstack/svelte-virtual";
    import { storageService } from "../services/storage-service";
    import { callManager } from "../services/call-manager";
    import type { CallHistoryEntry } from "../types";
    import { Haptics, ImpactStyle } from "@capacitor/haptics";

    let callHistory = $state<CallHistoryEntry[]>([]);
    let scrollContainer: HTMLDivElement;

    onMount(async () => {
        callHistory = await storageService.getCallHistory();
    });

    function formatTimestamp(date: Date): string {
        const now = new Date();
        const diff = now.getTime() - new Date(date).getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return "Today";
        if (days === 1) return "Yesterday";
        if (days < 7) return `${days} days ago`;

        return new Date(date).toLocaleDateString();
    }

    function formatDuration(seconds?: number): string {
        if (!seconds) return "Missed";

        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;

        if (mins === 0) return `${secs}s`;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    }

    async function handleCallBack(entry: CallHistoryEntry) {
        await Haptics.impact({ style: ImpactStyle.Medium });

        const contact = await storageService.getContact(entry.contactId);
        if (contact) {
            await callManager.initiateCall(contact);
        }
    }

    // Virtual scroller - using $derived for Svelte 5
    let virtualizer = $derived(
        scrollContainer
            ? createVirtualizer({
                  count: callHistory.length,
                  getScrollElement: () => scrollContainer,
                  estimateSize: () => 80,
                  overscan: 5,
              })
            : null,
    );
</script>

<div class="call-history">
    <div class="header safe-area-top">
        <h1>Recent</h1>
    </div>

    <div bind:this={scrollContainer} class="history-scroll">
        {#if callHistory.length === 0}
            <div class="empty-state">
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                >
                    <path
                        d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
                    ></path>
                </svg>
                <p>No call history yet</p>
            </div>
        {:else if virtualizer}
            {@const items = $virtualizer.getVirtualItems()}
            {@const totalSize = $virtualizer.getTotalSize()}
            <div style="height: {totalSize}px; position: relative;">
                {#each items as item (item.index)}
                    {@const entry = callHistory[item.index]}
                    <div
                        class="history-item button-press"
                        style="position: absolute; transform: translateY({item.start}px) translateZ(0);"
                        onclick={() => handleCallBack(entry)}
                        onkeydown={(e) =>
                            e.key === "Enter" && handleCallBack(entry)}
                        role="button"
                        tabindex="0"
                    >
                        <div class="history-avatar">
                            {#if entry.contactAvatar}
                                <img
                                    src={entry.contactAvatar}
                                    alt={entry.contactName}
                                    loading="lazy"
                                />
                            {:else}
                                <div class="avatar-placeholder">
                                    {entry.contactName.charAt(0).toUpperCase()}
                                </div>
                            {/if}
                        </div>

                        <div class="history-info">
                            <div class="contact-name">{entry.contactName}</div>
                            <div class="call-meta">
                                <svg
                                    class="call-icon {entry.type}"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                >
                                    {#if entry.type === "incoming"}
                                        <path
                                            d="M20 15.5c-1.25 0-2.45-.2-3.57-.57-.35-.11-.74-.03-1.02.24l-2.2 2.2c-2.83-1.44-5.15-3.75-6.59-6.59l2.2-2.21c.28-.26.36-.65.25-1C8.7 6.45 8.5 5.25 8.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1zM19 12h2c0-4.97-4.03-9-9-9v2c3.87 0 7 3.13 7 7z"
                                        />
                                    {:else if entry.type === "outgoing"}
                                        <path
                                            d="M20 15.5c-1.25 0-2.45-.2-3.57-.57-.35-.11-.74-.03-1.02.24l-2.2 2.2c-2.83-1.44-5.15-3.75-6.59-6.59l2.2-2.21c.28-.26.36-.65.25-1C8.7 6.45 8.5 5.25 8.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1zM9 4h2c0 3.87 3.13 7 7 7v2c-4.97 0-9-4.03-9-9z"
                                        />
                                    {:else}
                                        <path
                                            d="M19.23 15.26l-2.54-.29c-.61-.07-1.21.14-1.64.57l-1.84 1.84c-2.83-1.44-5.15-3.75-6.59-6.59l1.85-1.85c.43-.43.64-1.03.57-1.64l-.29-2.52c-.12-1.01-.97-1.77-1.99-1.77H5.03c-1.13 0-2.07.94-2 2.07.53 8.54 7.36 15.36 15.89 15.89 1.13.07 2.07-.87 2.07-2v-1.73c.01-1.01-.75-1.86-1.76-1.98z"
                                        />
                                    {/if}
                                </svg>
                                <span class="timestamp"
                                    >{formatTimestamp(entry.timestamp)}</span
                                >
                            </div>
                        </div>

                        <div class="call-duration {entry.type}">
                            {formatDuration(entry.duration)}
                        </div>

                        <button
                            class="video-call-btn"
                            aria-label="Video call {entry.contactName}"
                        >
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path
                                    d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"
                                />
                            </svg>
                        </button>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>

<style>
    .call-history {
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
    }

    .history-scroll {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
    }

    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        gap: var(--spacing-md);
        color: var(--text-secondary);
    }

    .empty-state svg {
        width: 64px;
        height: 64px;
    }

    .empty-state p {
        font-size: var(--font-size-lg);
    }

    .history-item {
        display: flex;
        align-items: center;
        gap: var(--spacing-md);
        padding: var(--spacing-md) var(--spacing-lg);
        width: 100%;
        height: 80px;
        cursor: pointer;
        transition: background-color var(--transition-fast);
    }

    .history-item:hover {
        background: var(--surface-hover);
    }

    .history-avatar {
        width: 48px;
        height: 48px;
        flex-shrink: 0;
    }

    .history-avatar img {
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

    .history-info {
        flex: 1;
        min-width: 0;
    }

    .contact-name {
        font-size: var(--font-size-md);
        font-weight: 500;
        color: var(--text-primary);
        margin-bottom: var(--spacing-xs);
    }

    .call-meta {
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
    }

    .call-icon {
        width: 16px;
        height: 16px;
    }

    .call-icon.incoming {
        color: var(--success);
    }

    .call-icon.outgoing {
        color: var(--text-secondary);
    }

    .call-icon.missed {
        color: var(--error);
    }

    .timestamp {
        font-size: var(--font-size-sm);
        color: var(--text-secondary);
    }

    .call-duration {
        font-size: var(--font-size-sm);
        margin-right: var(--spacing-sm);
        flex-shrink: 0;
    }

    .call-duration.missed {
        color: var(--error);
    }

    .video-call-btn {
        width: 40px;
        height: 40px;
        border-radius: var(--radius-full);
        background: var(--primary);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .video-call-btn svg {
        width: 20px;
        height: 20px;
    }
</style>
