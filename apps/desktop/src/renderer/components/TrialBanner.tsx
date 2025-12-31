import { useLicense } from '../contexts/LicenseContext';

export function TrialBanner() {
  const { state, isLoading, openDialog } = useLicense();

  if (isLoading || !state) {
    return null;
  }

  // Don't show banner for licensed users with active updates
  if (state.status === 'licensed' && state.hasUpdates) {
    return null;
  }

  const getBannerContent = () => {
    switch (state.status) {
      case 'trial':
        return {
          message: `Trial: ${state.trialDaysRemaining} day${state.trialDaysRemaining === 1 ? '' : 's'} remaining`,
          type: 'trial' as const,
          action: 'Buy License',
        };
      case 'trial_expired':
        return {
          message: 'Trial expired',
          type: 'expired' as const,
          action: 'Buy License',
        };
      case 'licensed':
        // License active but updates expired
        return {
          message: 'Updates expired - App works, but no new features',
          type: 'updates-expired' as const,
          action: 'Renew Updates',
        };
      case 'updates_expired':
        return {
          message: 'Updates expired - App works, but no new features',
          type: 'updates-expired' as const,
          action: 'Renew Updates',
        };
      default:
        return null;
    }
  };

  const content = getBannerContent();
  if (!content) return null;

  return (
    <div className={`trial-banner trial-banner--${content.type}`}>
      <span className="trial-banner__message">{content.message}</span>
      <button className="trial-banner__action" onClick={openDialog}>
        {content.action}
      </button>
    </div>
  );
}
