import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MsalProvider } from '@azure/msal-react'
import { EventType } from '@azure/msal-browser'
import './index.css'
import App from './App.jsx'
import AuthGate from './auth/AuthGate.jsx'
import { msalInstance } from './auth/msalConfig'
import { recordLogin } from './services/api'

// Initialize MSAL and process any in-flight redirect response (login callback)
// before rendering. Without this, useIsAuthenticated() can briefly return false
// after the redirect and trigger a second login.
msalInstance.initialize().then(() => {
  msalInstance.handleRedirectPromise().then((response) => {
    if (response?.account) {
      msalInstance.setActiveAccount(response.account);
      // First-time login from the redirect callback — log to backend.
      recordLogin().catch(() => {});
    } else if (!msalInstance.getActiveAccount()) {
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) msalInstance.setActiveAccount(accounts[0]);
    }

    msalInstance.addEventCallback((event) => {
      if (event.eventType === EventType.LOGIN_SUCCESS && event.payload?.account) {
        msalInstance.setActiveAccount(event.payload.account);
        // Covers the popup/silent paths in case redirect didn't fire.
        recordLogin().catch(() => {});
      }
    });

    createRoot(document.getElementById('root')).render(
      <StrictMode>
        <MsalProvider instance={msalInstance}>
          <AuthGate>
            <App />
          </AuthGate>
        </MsalProvider>
      </StrictMode>,
    );
  });
});
