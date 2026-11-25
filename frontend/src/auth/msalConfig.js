// Microsoft Entra ID (Azure AD) SSO configuration.
import { PublicClientApplication } from "@azure/msal-browser";

// Wheels India tenant + Stock Chatbot SPA app registration.
const TENANT_ID = "6f3490a2-b3a6-4ce5-ad92-168d3089f968";
const CLIENT_ID = "e0f1d804-c8de-47e0-b0a8-5af76df1d1dd";

export const msalConfig = {
  auth: {
    clientId: CLIENT_ID,
    authority: `https://login.microsoftonline.com/${TENANT_ID}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
};

// Scopes requested at login. User.Read gives us the basic profile
// (used to render the user's name in the top-right corner).
export const loginRequest = {
  scopes: ["User.Read", "openid", "profile", "email"],
};

// Scope used when calling our own backend.
// Backend validates the ID token (audience = CLIENT_ID) by default, so we
// re-use loginRequest's scopes — MSAL returns an ID token alongside the access token.
export const apiRequest = {
  scopes: ["User.Read"],
};

export const msalInstance = new PublicClientApplication(msalConfig);
