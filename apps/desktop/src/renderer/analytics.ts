/**
 * Analytics Module - Offline-First Event Tracking
 *
 * Privacy-respecting analytics that works offline.
 * Events are queued when offline and synced when online.
 *
 * Setup:
 * 1. Create account at https://app.posthog.com (free tier: 1M events/mo)
 * 2. Set VITE_POSTHOG_KEY in your environment
 * 3. Or use your own endpoint with VITE_ANALYTICS_ENDPOINT
 */

interface AnalyticsEvent {
  name: string;
  properties?: Record<string, unknown>;
  timestamp: number;
}

// Configuration
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const meta = import.meta as any;
const POSTHOG_KEY = meta.env?.VITE_POSTHOG_KEY || '';
const ANALYTICS_ENDPOINT = meta.env?.VITE_ANALYTICS_ENDPOINT || '';
const QUEUE_KEY = 'readied_analytics_queue';
const MAX_QUEUE_SIZE = 100;

// Event queue for offline support
let eventQueue: AnalyticsEvent[] = [];

// Load queue from localStorage on init
function loadQueue(): void {
  try {
    const stored = localStorage.getItem(QUEUE_KEY);
    if (stored) {
      eventQueue = JSON.parse(stored);
    }
  } catch {
    eventQueue = [];
  }
}

// Save queue to localStorage
function saveQueue(): void {
  try {
    // Trim queue if too large
    if (eventQueue.length > MAX_QUEUE_SIZE) {
      eventQueue = eventQueue.slice(-MAX_QUEUE_SIZE);
    }
    localStorage.setItem(QUEUE_KEY, JSON.stringify(eventQueue));
  } catch {
    // Ignore storage errors
  }
}

// Check if analytics is enabled
function isEnabled(): boolean {
  // Disabled if no key configured
  if (!POSTHOG_KEY && !ANALYTICS_ENDPOINT) {
    return false;
  }

  // Respect user preference (could add opt-out UI)
  const optOut = localStorage.getItem('readied_analytics_optout');
  return optOut !== 'true';
}

/**
 * Track an event
 */
export function track(name: string, properties?: Record<string, unknown>): void {
  if (!isEnabled()) return;

  const event: AnalyticsEvent = {
    name,
    properties: {
      ...properties,
      app_version: (window.readied as any)?.version || 'unknown',
    },
    timestamp: Date.now(),
  };

  eventQueue.push(event);
  saveQueue();

  // Try to flush immediately if online
  if (navigator.onLine) {
    flush();
  }
}

/**
 * Flush queued events to server
 */
async function flush(): Promise<void> {
  if (eventQueue.length === 0) return;
  if (!navigator.onLine) return;

  const events = [...eventQueue];
  eventQueue = [];
  saveQueue();

  try {
    if (POSTHOG_KEY) {
      // PostHog batch API
      await fetch('https://app.posthog.com/batch/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: POSTHOG_KEY,
          batch: events.map(e => ({
            event: e.name,
            properties: e.properties,
            timestamp: new Date(e.timestamp).toISOString(),
          })),
        }),
      });
    } else if (ANALYTICS_ENDPOINT) {
      // Custom endpoint
      await fetch(ANALYTICS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
      });
    }
  } catch {
    // Re-queue events on failure
    eventQueue = [...events, ...eventQueue];
    saveQueue();
  }
}

/**
 * Opt out of analytics
 */
export function optOut(): void {
  localStorage.setItem('readied_analytics_optout', 'true');
  eventQueue = [];
  saveQueue();
}

/**
 * Opt back in to analytics
 */
export function optIn(): void {
  localStorage.removeItem('readied_analytics_optout');
}

/**
 * Check if user has opted out
 */
export function hasOptedOut(): boolean {
  return localStorage.getItem('readied_analytics_optout') === 'true';
}

// Initialize
loadQueue();

// Flush on online
window.addEventListener('online', flush);

// Flush before unload
window.addEventListener('beforeunload', flush);

// Periodic flush (every 30 seconds if online)
setInterval(() => {
  if (navigator.onLine && eventQueue.length > 0) {
    flush();
  }
}, 30000);

// ===== PREDEFINED EVENTS =====

export const Analytics = {
  // App lifecycle
  appLaunched: () => track('app_launched'),
  appClosed: () => track('app_closed'),

  // Notes
  noteCreated: () => track('note_created'),
  noteDeleted: () => track('note_deleted'),
  noteExported: (format: string) => track('note_exported', { format }),

  // Features
  featureUsed: (feature: string) => track('feature_used', { feature }),
  searchUsed: () => track('search_used'),
  graphViewOpened: () => track('graph_view_opened'),
  backupCreated: () => track('backup_created'),

  // Errors (also sent to Sentry)
  errorOccurred: (error: string) => track('error_occurred', { error }),
};
