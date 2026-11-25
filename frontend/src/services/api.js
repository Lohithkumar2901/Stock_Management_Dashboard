import axios from "axios";
import { msalInstance, apiRequest, loginRequest } from "../auth/msalConfig";

const API = axios.create({
  baseURL: window.location.origin,
  timeout: 15000,
});

// Acquire a fresh ID token (silent → interactive fallback) and attach it as
// `Authorization: Bearer <token>` on every outgoing request.
async function getAuthToken() {
  const account =
    msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0];
  if (!account) {
    await msalInstance.loginRedirect(loginRequest);
    return null;
  }

  try {
    const result = await msalInstance.acquireTokenSilent({
      ...apiRequest,
      account,
    });
    // Backend validates the ID token (audience = client_id). idToken is
    // present on the silent-acquire response alongside the Graph access token.
    return result.idToken || result.accessToken;
  } catch (err) {
    // Silent acquire failed (e.g. session expired) → force interactive login.
    await msalInstance.acquireTokenRedirect(apiRequest);
    return null;
  }
}

API.interceptors.request.use(async (config) => {
  const token = await getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

API.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      // Token rejected by backend — re-trigger login.
      msalInstance.loginRedirect(loginRequest);
    }
    return Promise.reject(error);
  }
);


// ── Auth events ──
export const recordLogin = () => API.post("/api/login");


// ── Chat ──
export const sendChat = (data) => API.post("/chat", data);


// ── Dashboard data ──
export const fetchCurrentMonth = () => API.get("/api/current-month").then((r) => r.data.month);
export const fetchMonths = () => API.get("/api/months").then((r) => r.data);
export const fetchSummary = (month) => API.get("/api/summary", { params: { month } }).then((r) => r.data);
export const fetchBusinesses = (month, busType = "ALL") =>
  API.get("/api/businesses", { params: { month, bus_type: busType } }).then((r) => r.data);
export const fetchRegions = (month) => API.get("/api/regions", { params: { month } }).then((r) => r.data);
export const fetchTrend = (busType = "ALL") =>
  API.get("/api/trend", { params: { bus_type: busType } }).then((r) => r.data);
export const fetchDrilldown = (month, business) =>
  API.get("/api/drilldown", { params: { month, business } }).then((r) => r.data);
export const fetchCategoryDrilldown = (month, business, plnt) =>
  API.get("/api/category-drilldown", { params: { month, business, plnt } }).then((r) => r.data);
export const fetchMaterialDrilldown = (month, business, plnt, mat_cat) =>
  API.get("/api/material-drilldown", { params: { month, business, plnt, mat_cat } }).then((r) => r.data);
export const fetchMaterialCategories = (month) =>
  API.get("/api/material-categories", { params: { month } }).then((r) => r.data);
export const fetchBusinessCategories = (month, business) =>
  API.get("/api/business-categories", { params: { month, business } }).then((r) => r.data);
export const fetchBusinessMaterialDrilldown = (month, business, mat_cat) =>
  API.get("/api/business-material-drilldown", { params: { month, business, mat_cat } }).then((r) => r.data);
export const fetchBusTypeCategories = (month, bus_type) =>
  API.get("/api/bus-type-categories", { params: { month, bus_type } }).then((r) => r.data);
export const fetchBusTypeMaterialDrilldown = (month, bus_type, mat_cat) =>
  API.get("/api/bus-type-material-drilldown", { params: { month, bus_type, mat_cat } }).then((r) => r.data);
export const fetchCategoryMaterialDrilldown = (month, mat_cat) =>
  API.get("/api/category-material-drilldown", { params: { month, mat_cat } }).then((r) => r.data);
export const fetchPlantTrend = (top = 10) =>
  API.get("/api/plant-trend", { params: { top } }).then((r) => r.data);
