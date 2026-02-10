/**
 * License IPC Handlers
 *
 * Handles license state, trial management, and subscription checkout.
 * Fetches subscription status from API with local caching.
 */

import { ipcMain, shell } from 'electron';
import type {
  LicenseStorage,
  AppLicenseState,
  StoredSubscriptionData,
  SubscriptionInfo,
} from '@readied/licensing';
import {
  computeLicenseState,
  startTrial,
  canStartTrial,
  isCachedSubscriptionValid,
} from '@readied/licensing';
import { loggers } from '../logger';
import type { ApiClient, SubscriptionStatus } from '../services/apiClient';

function getLicenseLogger() {
  return loggers.license();
}

export interface LicenseHandlerDependencies {
  licenseStorage: LicenseStorage;
  apiClient: ApiClient;
}

/**
 * Maps API subscription status to StoredSubscriptionData for local caching
 */
function mapApiToSubscriptionData(
  apiStatus: SubscriptionStatus,
  email: string
): StoredSubscriptionData | null {
  // No active subscription
  if (apiStatus.plan === 'free' || apiStatus.status === 'inactive') {
    return null;
  }

  const statusMap: Record<string, SubscriptionInfo['status']> = {
    active: 'active',
    trialing: 'active',
    canceled: 'canceled',
    past_due: 'past_due',
  };

  return {
    subscription: {
      subscriptionId: apiStatus.stripeSubscriptionId || '',
      customerId: apiStatus.stripeCustomerId || '',
      email,
      plan: 'monthly', // Default; API doesn't expose interval yet
      status: statusMap[apiStatus.status] || 'canceled',
      currentPeriodStart: '', // API doesn't expose this
      currentPeriodEnd: apiStatus.currentPeriodEnd || '',
      cancelAtPeriodEnd: apiStatus.cancelAtPeriodEnd || false,
    },
    lastVerified: new Date().toISOString(),
    cacheExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
  };
}

/**
 * Fetches subscription data, using cache when valid
 */
async function getSubscriptionData(
  licenseStorage: LicenseStorage,
  apiClient: ApiClient,
  ignoreCache = false
): Promise<StoredSubscriptionData | null> {
  // 1. Read cached subscription data
  const cached = await licenseStorage.readSubscriptionData();

  // 2. If cache is valid and we're not ignoring it, use it
  if (cached && !ignoreCache && isCachedSubscriptionValid(cached)) {
    return cached;
  }

  // 3. Try to fetch fresh data from API
  try {
    const user = await apiClient.getCurrentUser();
    if (!user?.email) {
      // Not authenticated — return cache if we have it, otherwise null
      return cached;
    }

    const apiStatus = await apiClient.getSubscriptionStatus();
    const freshData = mapApiToSubscriptionData(apiStatus, user.email);

    if (freshData) {
      await licenseStorage.writeSubscriptionData(freshData);
    } else {
      // User is free tier — remove any stale cache
      await licenseStorage.removeSubscriptionData();
    }

    return freshData;
  } catch (error) {
    getLicenseLogger().warn(
      { error: error instanceof Error ? error.message : String(error) },
      'Failed to fetch subscription status from API, using cache'
    );
    // API unavailable — return cache if we have it
    return cached;
  }
}

/**
 * Register all license-related IPC handlers
 */
export function registerLicenseHandlers(deps: LicenseHandlerDependencies): void {
  const { licenseStorage, apiClient } = deps;

  /**
   * Get current license state
   * Trial data is local, subscription data comes from server (with local cache)
   */
  ipcMain.handle('license:getState', async (): Promise<AppLicenseState> => {
    let trialData = await licenseStorage.readTrialData();
    const subscriptionData = await getSubscriptionData(licenseStorage, apiClient);

    // Auto-start trial if user hasn't started one yet
    if (canStartTrial(trialData, subscriptionData)) {
      trialData = startTrial();
      await licenseStorage.writeTrialData(trialData);
      getLicenseLogger().info('Trial started automatically');
    }

    return computeLicenseState(trialData, subscriptionData);
  });

  /**
   * Force-refresh subscription status from API (ignores cache)
   */
  ipcMain.handle('license:refreshSubscription', async (): Promise<AppLicenseState> => {
    const trialData = await licenseStorage.readTrialData();
    const subscriptionData = await getSubscriptionData(licenseStorage, apiClient, true);
    return computeLicenseState(trialData, subscriptionData);
  });

  /**
   * Start trial manually (if not auto-started)
   */
  ipcMain.handle('license:startTrial', async (): Promise<{ success: boolean; error?: string }> => {
    const trialData = await licenseStorage.readTrialData();
    const subscriptionData = await licenseStorage.readSubscriptionData();

    if (!canStartTrial(trialData, subscriptionData)) {
      return { success: false, error: 'Trial already started or subscription active' };
    }

    const newTrialData = startTrial();
    await licenseStorage.writeTrialData(newTrialData);
    getLicenseLogger().info('Trial started manually');
    return { success: true };
  });

  /**
   * Open subscription checkout page
   * Creates a Stripe checkout session via API and opens it in the browser
   */
  ipcMain.handle(
    'license:openSubscribe',
    async (
      _event,
      options?: { plan?: 'monthly' | 'annual' }
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        // Get current user to verify authentication
        const user = await apiClient.getCurrentUser();

        if (!user || !user.email) {
          getLicenseLogger().error('Cannot open subscription: user not authenticated');
          return { success: false, error: 'Please sign in to subscribe' };
        }

        getLicenseLogger().info(
          { email: user.email, plan: options?.plan || 'monthly' },
          'Creating checkout session via API'
        );

        // Create checkout session via API (server handles Stripe SDK)
        const { url } = await apiClient.createCheckoutSession({
          plan: options?.plan || 'monthly',
          successUrl: 'https://readied.app/subscription/success',
          cancelUrl: 'https://readied.app/subscription/cancel',
        });

        if (!url) {
          return { success: false, error: 'No checkout URL returned' };
        }

        // Open checkout URL in browser
        await shell.openExternal(url);

        getLicenseLogger().info({ email: user.email }, 'Checkout session opened in browser');
        return { success: true };
      } catch (error) {
        getLicenseLogger().error({ error }, 'Failed to open subscription checkout');
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create checkout session',
        };
      }
    }
  );
}
