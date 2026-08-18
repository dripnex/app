/**
 * Enable Sync Modal
 *
 * Guides the user through enabling cloud sync with license-aware step routing.
 * Computes smart initial step based on auth + license state:
 *   - Auth'd + pro/trial → success (already syncing)
 *   - Auth'd + free/expired → pricing (needs subscription)
 *   - Not auth'd + trial/pro → email (just needs to sign in)
 *   - Not auth'd + free/expired → value-prop (full flow)
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { X } from 'lucide-react';
import { seedGeneratedPassphrase } from './PassphraseCreateForm';
import { scorePassphrase } from '../../utils/passphrase';
import { getProductConfig } from '@dripnex/product-config';
import {
  useAuthStore,
  selectIsAuthenticated,
  selectError,
  selectEmail,
  startCloudSyncIfReady,
} from '../../stores/authStore';
import { useLicense } from '../../contexts/LicenseContext';
import {
  CheckingStep,
  EmailStep,
  PassphraseStep,
  PricingStep,
  RecoveryKeyStep,
  RecoveryUnlockStep,
  SentStep,
  SuccessStep,
  UnlockStep,
  ValuePropStep,
  WaitingPaymentStep,
} from './EnableSyncSteps';
import styles from './LoginModal.module.css';

interface EnableSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step =
  | 'value-prop'
  | 'pricing'
  | 'waiting-payment'
  | 'email'
  | 'checking'
  | 'sent'
  | 'passphrase'
  | 'unlock'
  | 'recovery'
  | 'recovery-unlock'
  | 'success';

const RESEND_COOLDOWN = 60; // seconds

const SYNC_CAPABLE_STATUSES = ['trial', 'pro_active', 'pro_grace'];

function hasSyncCapability(status: string | undefined): boolean {
  return status != null && SYNC_CAPABLE_STATUSES.includes(status);
}

export function EnableSyncModal({ isOpen, onClose }: EnableSyncModalProps) {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<Step>('value-prop');
  const [passphrase, setPassphrase] = useState('');
  const [passphraseConfirm, setPassphraseConfirm] = useState('');
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [recoveryInput, setRecoveryInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const requestMagicLink = useAuthStore(state => state.requestMagicLink);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const authError = useAuthStore(selectError);
  const accountEmail = useAuthStore(selectEmail);
  const { state: licenseState, openSubscribe } = useLicense();
  const config = useMemo(() => getProductConfig(), []);
  const proPricing = config.plans.pro.pricing!;

  const canSync = hasSyncCapability(licenseState?.status);

  // Compute smart initial step based on current auth + license state
  // Note: checkout requires auth, so unauthenticated users always go through email first
  const computeInitialStep = useCallback((): Step => {
    if (isAuthenticated && !canSync) return 'pricing';
    if (isAuthenticated && canSync) return 'passphrase';
    return 'value-prop';
  }, [isAuthenticated, canSync]);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    const generated = seedGeneratedPassphrase();
    setPassphrase(generated);
    setPassphraseConfirm(generated);
    setRecoveryInput('');
    setStep(computeInitialStep());
  }, [isOpen, computeInitialStep]);

  useEffect(() => {
    if (!isOpen || !isAuthenticated || !canSync) return;
    let cancelled = false;
    void (async () => {
      const [ready, status] = await Promise.all([
        window.dripnex.encryption.isReady(),
        window.dripnex.encryption.getKeyStatus(),
      ]);
      if (cancelled) return;
      if (ready.ready) {
        setStep('success');
        return;
      }
      setStep(status.hasServerKeys ? 'unlock' : 'passphrase');
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, isAuthenticated, canSync]);

  // Watch for auth success (deep link verified in background)
  // If user has sync capability → success. If not → they need to pay first.
  useEffect(() => {
    if (isAuthenticated && (step === 'sent' || step === 'checking')) {
      if (canSync) {
        setStep('passphrase');
      } else {
        setStep('pricing');
      }
    }
  }, [isAuthenticated, canSync, step]);

  // Watch for verification errors from the deep link path
  useEffect(() => {
    if (authError && step === 'sent') {
      setError(authError);
    }
  }, [authError, step]);

  // Watch for license state changes while waiting for payment
  useEffect(() => {
    if (step === 'waiting-payment' && hasSyncCapability(licenseState?.status)) {
      if (isAuthenticated) {
        setStep('passphrase');
      } else {
        setStep('email');
      }
    }
  }, [licenseState?.status, step, isAuthenticated]);

  // Resend countdown timer
  useEffect(() => {
    if (resendTimer > 0) {
      timerRef.current = setInterval(() => {
        setResendTimer(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [resendTimer]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep(computeInitialStep());
      setEmail('');
      setError(null);
      setResendTimer(0);
    }
  }, [isOpen, computeInitialStep]);

  const handleSubmitEmail = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setStep('checking');

      try {
        await requestMagicLink(email);
        setStep('sent');
        setResendTimer(RESEND_COOLDOWN);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to send magic link');
        setStep('email');
      }
    },
    [email, requestMagicLink]
  );

  const handleResend = useCallback(async () => {
    if (resendTimer > 0 || isResending) return;
    setError(null);
    setIsResending(true);

    try {
      await requestMagicLink(email);
      setResendTimer(RESEND_COOLDOWN);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend');
    } finally {
      setIsResending(false);
    }
  }, [email, resendTimer, isResending, requestMagicLink]);

  const handleSelectPlan = useCallback(
    async (plan: 'monthly' | 'annual') => {
      setError(null);
      setStep('waiting-payment');
      const result = await openSubscribe({ plan });
      if (!result.success) {
        setError(result.error || 'Failed to open checkout');
        setStep('pricing');
      }
    },
    [openSubscribe]
  );

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Where "Enable Sync" on value-prop should go
  // Always go to email first — checkout requires authentication
  const handleEnableSync = useCallback(() => {
    setStep('email');
  }, []);

  const handleSetupPassphrase = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setError(null);
      if (passphrase !== passphraseConfirm) {
        setError('Passphrases do not match.');
        return;
      }
      if (!scorePassphrase(passphrase).ok) {
        setError('Choose a stronger passphrase — six random words, or 16+ mixed characters.');
        return;
      }
      const result = await window.dripnex.encryption.setupKeys(passphrase);
      if (!result.success) {
        setError(result.error || 'Failed to set up encryption');
        return;
      }
      setRecoveryKey(result.recoveryKey ?? null);
      await startCloudSyncIfReady();
      setStep(result.recoveryKey ? 'recovery' : 'success');
    },
    [passphrase, passphraseConfirm]
  );

  const handleUnlock = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setError(null);
      const result = await window.dripnex.encryption.unlockWithPassphrase(passphrase);
      if (!result.success) {
        setError(result.wrongPassphrase ? 'Incorrect passphrase' : (result.error ?? 'Unlock failed'));
        return;
      }
      await startCloudSyncIfReady();
      setStep('success');
    },
    [passphrase]
  );

  const handleUnlockRecovery = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setError(null);
      const key = recoveryInput.trim();
      if (!key) {
        setError('Paste your recovery key.');
        return;
      }
      const result = await window.dripnex.encryption.unlockWithRecoveryKey(key);
      if (!result.success) {
        setError(result.error ?? 'Recovery failed');
        return;
      }
      await startCloudSyncIfReady();
      setStep('success');
    },
    [recoveryInput]
  );

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sync-modal-title"
        className={styles.modal}
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          className={styles.closeButton}
          onClick={handleClose}
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div className={styles.content}>
          {step === 'value-prop' && <ValuePropStep onStart={handleEnableSync} />}
          {step === 'pricing' && (
            <PricingStep
              trialDescription={
                licenseState?.trial && !licenseState.trial.isExpired
                  ? config.trialDescription
                  : undefined
              }
              proPricing={proPricing}
              error={error}
              onSelectPlan={plan => void handleSelectPlan(plan)}
              onBack={() => {
                setError(null);
                setStep('value-prop');
              }}
            />
          )}
          {step === 'waiting-payment' && (
            <WaitingPaymentStep onCancel={() => setStep('pricing')} />
          )}
          {step === 'email' && (
            <EmailStep
              email={email}
              error={error}
              onEmailChange={setEmail}
              onSubmit={e => void handleSubmitEmail(e)}
              onBack={() => setStep('value-prop')}
            />
          )}
          {step === 'checking' && <CheckingStep />}
          {step === 'sent' && (
            <SentStep
              email={email}
              error={error}
              resendTimer={resendTimer}
              onResend={() => void handleResend()}
              onChangeEmail={() => {
                setStep('email');
                setError(null);
              }}
            />
          )}
          {step === 'passphrase' && (
            <PassphraseStep
              passphrase={passphrase}
              passphraseConfirm={passphraseConfirm}
              error={error}
              email={accountEmail ?? email}
              onPassphraseChange={setPassphrase}
              onConfirmChange={setPassphraseConfirm}
              onSubmit={event => void handleSetupPassphrase(event)}
            />
          )}
          {step === 'unlock' && (
            <UnlockStep
              email={accountEmail ?? email}
              passphrase={passphrase}
              error={error}
              onPassphraseChange={setPassphrase}
              onSubmit={e => void handleUnlock(e)}
              onUseRecovery={() => {
                setError(null);
                setStep('recovery-unlock');
              }}
            />
          )}
          {step === 'recovery-unlock' && (
            <RecoveryUnlockStep
              recoveryInput={recoveryInput}
              error={error}
              onRecoveryChange={setRecoveryInput}
              onSubmit={e => void handleUnlockRecovery(e)}
              onUsePassphrase={() => {
                setError(null);
                setStep('unlock');
              }}
            />
          )}
          {step === 'recovery' && (
            <RecoveryKeyStep
              email={accountEmail ?? email}
              passphrase={passphrase}
              recoveryKey={recoveryKey}
              onDone={() => setStep('success')}
            />
          )}
          {step === 'success' && <SuccessStep onClose={handleClose} />}
        </div>

        <div className={styles.footer}>
          <p>
            By signing in, you agree to our{' '}
            <a href="https://dripnex.app/terms" target="_blank" rel="noopener">
              Terms
            </a>{' '}
            and{' '}
            <a href="https://dripnex.app/privacy" target="_blank" rel="noopener">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
