/**
 * License IPC Handlers
 *
 * Handles license state, trial management, and subscription checkout.
 * Fetches subscription status from API with local caching.
 */

import { shell } from 'electron';
import { z } from 'zod';
import type {
  LicenseStorage,
  AppLicenseState,
  StoredSubscriptionData,
  SubscriptionInfo,
} from '@dripnex/licensing';
import {
  computeLicenseState,
  startTrial,
  canStartTrial,
  isCachedSubscriptionValid,
} from '@dripnex/licensing';
import { defineIpcHandler } from '../ipc/registry.js';
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

  defineIpcHandler({
    channel: 'license:getState',
    args: z.tuple([]),
    handler: async (): Promise<AppLicenseState> => {
      let trialData = await licenseStorage.readTrialData();
      const subscriptionData = await getSubscriptionData(licenseStorage, apiClient);

      if (canStartTrial(trialData, subscriptionData)) {
        trialData = startTrial();
        await licenseStorage.writeTrialData(trialData);
        getLicenseLogger().info('Trial started automatically');
      }

      return computeLicenseState(trialData, subscriptionData);
    },
  });

  defineIpcHandler({
    channel: 'license:refreshSubscription',
    args: z.tuple([]),
    handler: async (): Promise<AppLicenseState> => {
      const trialData = await licenseStorage.readTrialData();
      const subscriptionData = await getSubscriptionData(licenseStorage, apiClient, true);
      return computeLicenseState(trialData, subscriptionData);
    },
  });

  defineIpcHandler({
    channel: 'license:startTrial',
    args: z.tuple([]),
    handler: async (): Promise<{ success: boolean; error?: string }> => {
      const trialData = await licenseStorage.readTrialData();
      const subscriptionData = await licenseStorage.readSubscriptionData();

      if (!canStartTrial(trialData, subscriptionData)) {
        return { success: false, error: 'Trial already started or subscription active' };
      }

      const newTrialData = startTrial();
      await licenseStorage.writeTrialData(newTrialData);
      getLicenseLogger().info('Trial started manually');
      return { success: true };
    },
  });

  defineIpcHandler({
    channel: 'license:openSubscribe',
    args: z.tuple([
      z
        .object({
          plan: z.enum(['monthly', 'annual']).optional(),
        })
        .optional(),
    ]),
    handler: async (options): Promise<{ success: boolean; error?: string }> => {
      try {
        const user = await apiClient.getCurrentUser();

        if (!user || !user.email) {
          getLicenseLogger().error('Cannot open subscription: user not authenticated');
          return { success: false, error: 'Please sign in to subscribe' };
        }

        getLicenseLogger().info(
          { email: user.email, plan: options?.plan || 'monthly' },
          'Creating checkout session via API'
        );

        const { url } = await apiClient.createCheckoutSession({
          plan: options?.plan || 'monthly',
          successUrl: 'https://dripnex.app/subscription/success',
          cancelUrl: 'https://dripnex.app/subscription/cancel',
        });

        if (!url) {
          return { success: false, error: 'No checkout URL returned' };
        }

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
    },
  });
}
