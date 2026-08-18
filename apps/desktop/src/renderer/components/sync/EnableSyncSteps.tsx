import { Cloud, Mail, CheckCircle, RefreshCw, Sparkles } from 'lucide-react';
import { PassphraseCreateForm } from './PassphraseCreateForm';
import { SaveToOnePasswordButton } from './SaveToOnePasswordButton';
import { downloadEmergencyKit, printEmergencyKit } from '../../utils/emergencyKit';
import { downloadOnePasswordCsv } from '../../utils/onePasswordCsv';
import { formatRecoveryKey } from '../../utils/passphrase';
import styles from './LoginModal.module.css';

interface Pricing {
  annualSavings?: string;
  intervals: { annual: { label: string }; monthly: { label: string } };
}

export function ValuePropStep({ onStart }: { onStart: () => void }) {
  return (
    <>
      <div className={styles.iconWrapper}>
        <Cloud size={36} />
      </div>
      <h2 id="sync-modal-title" className={styles.title}>
        Sync across devices
      </h2>
      <p className={styles.subtitle}>
        Your notes stay on your machine. Enable sync to access them from any device, with end-to-end
        encryption.
      </p>
      <ul className={styles.benefits}>
        <li>Access notes on all your devices</li>
        <li>End-to-end encrypted — only you can read them</li>
        <li>Works offline, syncs when connected</li>
        <li>Account required — sync stays optional and encrypted</li>
      </ul>
      <button type="button" className={styles.button} onClick={onStart}>
        Get Started
      </button>
    </>
  );
}

export function PricingStep({
  trialDescription,
  proPricing,
  error,
  onSelectPlan,
  onBack,
}: {
  trialDescription?: string;
  proPricing: Pricing;
  error: string | null;
  onSelectPlan: (plan: 'monthly' | 'annual') => void;
  onBack: () => void;
}) {
  return (
    <>
      <div className={styles.iconWrapper}>
        <Sparkles size={36} />
      </div>
      <h2 id="sync-modal-title" className={styles.title}>
        Upgrade to Pro
      </h2>
      <p className={styles.subtitle}>{trialDescription ?? 'Get cloud sync and all Pro features'}</p>
      <div className={styles.planButtons}>
        <button
          type="button"
          className={styles.planButtonRecommended}
          onClick={() => onSelectPlan('annual')}
        >
          <span className={styles.planLabel}>Annual — {proPricing.intervals.annual.label}</span>
          {proPricing.annualSavings && (
            <span className={styles.savingsBadge}>Save {proPricing.annualSavings}</span>
          )}
        </button>
        <button type="button" className={styles.planButton} onClick={() => onSelectPlan('monthly')}>
          <span className={styles.planLabel}>Monthly — {proPricing.intervals.monthly.label}</span>
        </button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <button type="button" className={styles.linkButton} onClick={onBack}>
        Back
      </button>
    </>
  );
}

export function WaitingPaymentStep({ onCancel }: { onCancel: () => void }) {
  return (
    <div className={styles.checking}>
      <div className={styles.spinner} />
      <p>Complete checkout in your browser...</p>
      <p className={styles.waitingHint}>This window will update automatically</p>
      <button type="button" className={styles.linkButton} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

export function EmailStep({
  email,
  error,
  onEmailChange,
  onSubmit,
  onBack,
}: {
  email: string;
  error: string | null;
  onEmailChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
}) {
  return (
    <>
      <div className={styles.iconWrapper}>
        <Mail size={36} />
      </div>
      <h2 className={styles.title}>Sign in or create account</h2>
      <p className={styles.subtitle}>
        Enter your email and we'll send you a sign-in link. No password needed — if you're new, your
        account is created automatically.
      </p>
      <form onSubmit={onSubmit} className={styles.form}>
        <input
          type="email"
          value={email}
          onChange={e => onEmailChange(e.target.value)}
          className={styles.input}
          aria-label="Email address"
          placeholder="you@example.com"
          required
          autoFocus
        />
        {error && <p className={styles.error}>{error}</p>}
        <button type="submit" className={styles.button}>
          Continue with Email
        </button>
      </form>
      <button type="button" className={styles.linkButton} onClick={onBack}>
        Back
      </button>
    </>
  );
}

export function CheckingStep() {
  return (
    <div className={styles.checking}>
      <div className={styles.spinner} />
      <p>Sending magic link...</p>
    </div>
  );
}

export function SentStep({
  email,
  error,
  resendTimer,
  onResend,
  onChangeEmail,
}: {
  email: string;
  error: string | null;
  resendTimer: number;
  onResend: () => void;
  onChangeEmail: () => void;
}) {
  return (
    <div className={styles.sent}>
      <CheckCircle size={48} className={styles.checkIcon} />
      <h3>Check your email</h3>
      <p>
        We sent a magic link to <strong>{email}</strong>
      </p>
      <p className={styles.hint}>
        Click the link in the email to sign in. This window will update automatically.
      </p>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.resendRow}>
        {resendTimer > 0 ? (
          <span className={styles.resendTimer}>Resend in {resendTimer}s</span>
        ) : (
          <button type="button" className={styles.linkButton} onClick={onResend}>
            <RefreshCw size={12} />
            Resend magic link
          </button>
        )}
      </div>
      <button type="button" className={styles.linkButton} onClick={onChangeEmail}>
        Use a different email
      </button>
    </div>
  );
}

export function PassphraseStep({
  passphrase,
  passphraseConfirm,
  error,
  email,
  onPassphraseChange,
  onConfirmChange,
  onSubmit,
}: {
  passphrase: string;
  passphraseConfirm: string;
  error: string | null;
  email: string;
  onPassphraseChange: (value: string) => void;
  onConfirmChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <>
      <h2 id="sync-modal-title" className={styles.title}>
        Create a sync passphrase
      </h2>
      <p className={styles.subtitle}>
        Notes are encrypted on this device before they leave it. The passphrase is not stored. You
        will need it on every new device.
      </p>
      <PassphraseCreateForm
        passphrase={passphrase}
        passphraseConfirm={passphraseConfirm}
        onPassphraseChange={onPassphraseChange}
        onConfirmChange={onConfirmChange}
        onSubmit={onSubmit}
        error={error}
        email={email}
      />
    </>
  );
}

export function UnlockStep({
  email,
  passphrase,
  error,
  onPassphraseChange,
  onSubmit,
  onUseRecovery,
}: {
  email: string;
  passphrase: string;
  error: string | null;
  onPassphraseChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onUseRecovery: () => void;
}) {
  return (
    <>
      <h2 id="sync-modal-title" className={styles.title}>
        Unlock sync
      </h2>
      <p className={styles.subtitle}>Enter the passphrase you created on your first device.</p>
      <form onSubmit={onSubmit} className={styles.form}>
        <input
          type="email"
          name="username"
          autoComplete="username"
          value={email}
          readOnly
          tabIndex={-1}
          aria-hidden="true"
          className={styles.srOnly}
        />
        <input
          type="password"
          name="password"
          className={styles.input}
          autoComplete="current-password"
          placeholder="Passphrase"
          value={passphrase}
          onChange={e => onPassphraseChange(e.target.value)}
          autoFocus
        />
        {error ? <p className={styles.error}>{error}</p> : null}
        <button type="submit" className={styles.button}>
          Unlock
        </button>
      </form>
      <button type="button" className={styles.linkButton} onClick={onUseRecovery}>
        Use recovery key
      </button>
    </>
  );
}

export function RecoveryUnlockStep({
  recoveryInput,
  error,
  onRecoveryChange,
  onSubmit,
  onUsePassphrase,
}: {
  recoveryInput: string;
  error: string | null;
  onRecoveryChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onUsePassphrase: () => void;
}) {
  return (
    <>
      <h2 id="sync-modal-title" className={styles.title}>
        Unlock with recovery key
      </h2>
      <p className={styles.subtitle}>Paste the key you saved when you set up encryption.</p>
      <form onSubmit={onSubmit} className={styles.form}>
        <input
          type="text"
          className={styles.input}
          autoComplete="off"
          placeholder="Recovery key (dashes ok)"
          value={recoveryInput}
          onChange={e => onRecoveryChange(e.target.value)}
          autoFocus
        />
        {error ? <p className={styles.error}>{error}</p> : null}
        <button type="submit" className={styles.button}>
          Unlock
        </button>
      </form>
      <button type="button" className={styles.linkButton} onClick={onUsePassphrase}>
        Use passphrase
      </button>
    </>
  );
}

export function RecoveryKeyStep({
  email,
  passphrase,
  recoveryKey,
  onDone,
}: {
  email: string;
  passphrase: string;
  recoveryKey: string | null;
  onDone: () => void;
}) {
  return (
    <>
      <h2 id="sync-modal-title" className={styles.title}>
        Save your recovery key
      </h2>
      <p className={styles.subtitle}>
        This is shown once. Store it somewhere you will find it if you forget the passphrase.
      </p>
      <p className={styles.recoveryKey}>{recoveryKey ? formatRecoveryKey(recoveryKey) : ''}</p>
      <div className={styles.form}>
        <button
          type="button"
          className={styles.button}
          onClick={() => {
            printEmergencyKit({ email, passphrase, recoveryKey });
          }}
        >
          Print / Save as PDF
        </button>
        <SaveToOnePasswordButton
          variant="link"
          email={email}
          passphrase={passphrase}
          recoveryKey={recoveryKey}
        />
        <button
          type="button"
          className={styles.linkButton}
          onClick={() => {
            downloadOnePasswordCsv({ email, passphrase, recoveryKey });
          }}
        >
          Import CSV
        </button>
        <button
          type="button"
          className={styles.linkButton}
          onClick={() => {
            downloadEmergencyKit({ email, passphrase, recoveryKey });
          }}
        >
          Download Emergency Kit
        </button>
        <button
          type="button"
          className={styles.linkButton}
          onClick={() => {
            if (!recoveryKey) return;
            void navigator.clipboard.writeText(formatRecoveryKey(recoveryKey));
          }}
        >
          Copy recovery key
        </button>
      </div>
      <button type="button" className={styles.button} onClick={onDone}>
        I saved it
      </button>
    </>
  );
}

export function SuccessStep({ onClose }: { onClose: () => void }) {
  return (
    <div className={styles.sent}>
      <CheckCircle size={48} className={styles.successIcon} />
      <h3>You're syncing!</h3>
      <p>Your notes will now sync across all your devices.</p>
      <button type="button" className={styles.button} onClick={onClose}>
        Done
      </button>
    </div>
  );
}
