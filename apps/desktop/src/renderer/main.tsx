import React, { Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LicenseProvider } from './contexts/LicenseContext';

// Initialize Sentry before App
import { initSentry } from './sentry';
initSentry();

import './styles/global.css';

// Detect which view to render based on query param
const params = new URLSearchParams(window.location.search);
const view = params.get('view') || 'main';

// Lazy load components
const App = lazy(() => import('./App').then(m => ({ default: m.App })));
const SettingsApp = lazy(() =>
  import('./pages/settings/SettingsApp').then(m => ({ default: m.SettingsApp }))
);

// Settings view needs LicenseProvider (used by AccountSection)
const SettingsView = () => (
  <LicenseProvider>
    <SettingsApp />
  </LicenseProvider>
);

// QueryClient shared across views
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
    },
  },
});

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found');
}

// Simple loading fallback
const LoadingFallback = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: '#0a0b0d',
      color: '#888',
    }}
  >
    Loading...
  </div>
);

// Render the appropriate view
const RootComponent = view === 'settings' ? SettingsView : App;

createRoot(container).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<LoadingFallback />}>
        <RootComponent />
      </Suspense>
    </QueryClientProvider>
  </React.StrictMode>
);
