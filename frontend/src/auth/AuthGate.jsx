import { useEffect, useRef } from "react";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { loginRequest } from "./msalConfig";

export default function AuthGate({ children }) {
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const redirectFired = useRef(false);

  // Auto-redirect to Microsoft login as soon as the app loads unauthenticated.
  useEffect(() => {
    if (
      !isAuthenticated &&
      inProgress === InteractionStatus.None &&
      !redirectFired.current
    ) {
      redirectFired.current = true;
      instance.loginRedirect(loginRequest).catch((e) => {
        redirectFired.current = false;
        console.error("loginRedirect failed", e);
      });
    }
  }, [isAuthenticated, inProgress, instance]);

  const handleLogout = () => {
    instance.logoutRedirect({ postLogoutRedirectUri: window.location.origin });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <img src="/Wheels.png" alt="Wheels India" className="h-12 mx-auto mb-4" />
          <p className="text-sm text-slate-500">Redirecting to Microsoft sign-in…</p>
        </div>
      </div>
    );
  }

  const user = accounts[0];
  return (
    <div>
      <div className="fixed top-3 right-4 z-50 flex items-center gap-3 bg-white/90 backdrop-blur px-3 py-1.5 rounded-full shadow text-sm">
        <span className="text-slate-700">{user?.name || user?.username}</span>
        <button onClick={handleLogout} className="text-red-600 hover:text-red-800 font-medium">
          Sign out
        </button>
      </div>
      {children}
    </div>
  );
}
