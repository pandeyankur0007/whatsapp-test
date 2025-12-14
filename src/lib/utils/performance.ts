/**
 * Performance utilities for maintaining 60fps during video calls
 * All utilities designed to avoid blocking the main thread
 */

/**
 * Debounce function calls to reduce execution frequency
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    return function executedFunction(...args: Parameters<T>) {
        const later = () => {
            timeout = null;
            func(...args);
        };

        if (timeout !== null) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function calls to limit execution rate
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle: boolean;

    return function executedFunction(...args: Parameters<T>) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}

/**
 * Execute callback during browser idle time to avoid blocking main thread
 */
export function runWhenIdle(callback: () => void, options?: IdleRequestOptions): number {
    if ('requestIdleCallback' in window) {
        return window.requestIdleCallback(callback, options);
    } else {
        // Fallback for browsers that don't support requestIdleCallback
        return window.setTimeout(callback, 1) as unknown as number;
    }
}

/**
 * Cancel idle callback
 */
export function cancelIdle(handle: number): void {
    if ('cancelIdleCallback' in window) {
        window.cancelIdleCallback(handle);
    } else {
        window.clearTimeout(handle);
    }
}

/**
 * Frame rate monitor - tracks FPS and detects dropped frames
 */
export class FrameRateMonitor {
    private frameCount = 0;
    private lastTime = performance.now();
    private fps = 60;
    private rafId: number | null = null;

    start(onUpdate: (fps: number) => void) {
        const measure = () => {
            this.frameCount++;
            const currentTime = performance.now();
            const delta = currentTime - this.lastTime;

            // Update FPS every second
            if (delta >= 1000) {
                this.fps = Math.round((this.frameCount * 1000) / delta);
                onUpdate(this.fps);
                this.frameCount = 0;
                this.lastTime = currentTime;
            }

            this.rafId = requestAnimationFrame(measure);
        };

        this.rafId = requestAnimationFrame(measure);
    }

    stop() {
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }

    getCurrentFps(): number {
        return this.fps;
    }
}

/**
 * Memory usage tracker
 */
export function getMemoryUsage(): number {
    if ('memory' in performance) {
        const memory = (performance as any).memory;
        return Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100);
    }
    return 0;
}

/**
 * Batch DOM updates using requestAnimationFrame
 */
export function batchDOMUpdates(updates: () => void): void {
    requestAnimationFrame(() => {
        updates();
    });
}

/**
 * Optimize image loading with lazy loading and size optimization
 */
export function optimizeImage(url: string, maxWidth: number = 400): string {
    // You can implement image optimization service here
    // For now, just return the original URL
    return url;
}

/**
 * Check if the device supports hardware acceleration
 */
export function hasHardwareAcceleration(): boolean {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!gl;
}

/**
 * Force GPU acceleration hint
 */
export function enableGPUAcceleration(element: HTMLElement): void {
    element.style.transform = 'translateZ(0)';
    element.style.willChange = 'transform';
}

/**
 * Disable GPU acceleration hint (to conserve resources)
 */
export function disableGPUAcceleration(element: HTMLElement): void {
    element.style.transform = '';
    element.style.willChange = 'auto';
}
