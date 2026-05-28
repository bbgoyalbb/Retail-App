import axios from "axios";
import { CACHE_TTL, PAGINATION } from "@/lib/constants";
import { isSessionValid, clearSession } from "@/lib/security";

// Backend URL configuration (Fix 4.4)
// Priority: 1. Env var REACT_APP_BACKEND_URL, 2. Same origin (production), 3. Default dev port
const envBackendUrl = process.env.REACT_APP_BACKEND_URL;
export const BACKEND_URL = envBackendUrl || window.location.origin;

const api = axios.create({ baseURL: `${BACKEND_URL}/api` });

api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (err) => Promise.reject(err)
);

// Normalize error messages from backend detail field
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const silent = !!err.config?.silent || err.config?.headers?.["X-Silent-Errors"] === "1";
    
    // Handle 401 unauthorized - check session validity
    if (err.response?.status === 401) {
      const hadToken = !!sessionStorage.getItem("token");
      // Check if session is expired due to timeout
      if (!isSessionValid()) {
        clearSession();
        window.dispatchEvent(new CustomEvent("auth:expired"));
      } else if (hadToken) {
        clearSession();
        window.dispatchEvent(new CustomEvent("auth:expired"));
      }
    }
    
    // Handle rate limiting (429)
    if (err.response?.status === 429) {
      const retryAfter = err.response.headers['retry-after'] || 60;
      err.message = `Rate limit exceeded. Please wait ${retryAfter} seconds before trying again.`;
      window.dispatchEvent(new CustomEvent("api:error", { detail: err.message }));
      return Promise.reject(err);
    }
    
    let message = err.message;
    if (err.response?.data?.detail) {
      message = err.response.data.detail;
      err.message = message;
    } else if (err.code === "ERR_NETWORK") {
      message = "Network error: Could not connect to the server. Please check your connection.";
      err.message = message;
    }

    // Dispatch global error event for automatic toast notifications
    if (!silent && err.response?.status !== 401) {
      window.dispatchEvent(new CustomEvent("api:error", { detail: message }));
    }

    return Promise.reject(err);
  }
);

let _dashboardCache = null;
let _dashboardCacheTime = 0;
let _dashboardPromise = null;
export const getDashboard = (force = false) => {
  const now = Date.now();
  if (!force && _dashboardCache && now - _dashboardCacheTime < CACHE_TTL.DASHBOARD) {
    return Promise.resolve(_dashboardCache);
  }
  if (_dashboardPromise) return _dashboardPromise;
  _dashboardPromise = api.get("/dashboard").then(res => {
    _dashboardCache = res;
    _dashboardCacheTime = Date.now();
    _dashboardPromise = null;
    return res;
  }).catch(err => { _dashboardPromise = null; throw err; });
  return _dashboardPromise;
};
export const invalidateDashboardCache = () => { _dashboardCache = null; };
let _customersCache = null;
let _customersCacheTime = 0;
export const getCustomers = () => {
  const now = Date.now();
  if (_customersCache && now - _customersCacheTime < CACHE_TTL.CUSTOMERS) {
    return Promise.resolve(_customersCache);
  }
  return api.get("/customers").then(res => {
    _customersCache = res;
    _customersCacheTime = Date.now();
    return res;
  });
};
export const invalidateCustomersCache = () => { _customersCache = null; };
let _itemsCache = null;
let _itemsCacheTime = 0;
let _itemsCacheKey = "";
export const getItems = (params) => {
  const key = JSON.stringify(params || {});
  const now = Date.now();
  if (_itemsCache && key === _itemsCacheKey && now - _itemsCacheTime < CACHE_TTL.ITEMS) {
    return Promise.resolve(_itemsCache);
  }
  return api.get("/items", { params }).then(res => {
    _itemsCache = res;
    _itemsCacheKey = key;
    _itemsCacheTime = Date.now();
    return res;
  });
};
export const invalidateItemsCache = () => { _itemsCache = null; _itemsCacheKey = ""; _itemsCacheTime = 0; };
export const getItem = (id) => api.get(`/items/${id}`);
export const getRefs = (name) => api.get("/refs", { params: { name } });
export const getOrders = () => api.get("/orders");
const _orderStatusCache = new Map();
export const getOrderStatus = (params) => {
  const key = JSON.stringify(params || {});
  const now = Date.now();
  const hit = _orderStatusCache.get(key);
  if (hit && now - hit.ts < CACHE_TTL.ORDER_STATUS) return Promise.resolve(hit.res);
  return api.get("/orders/status", { params }).then(res => {
    _orderStatusCache.set(key, { res, ts: Date.now() });
    return res;
  });
};
export const invalidateOrderStatusCache = () => _orderStatusCache.clear();
export const markOrderDelivered = (order_no) => { _orderStatusCache.clear(); return api.post("/orders/deliver", { order_no }); };

export const createBill = (data) => api.post("/bills", data);
export const getNextBillRef = (date) => api.get("/bills/next-ref", { params: { date } });

export const assignTailoring = (data) => api.post("/tailoring/assign", data);
export const splitTailoring = (data) => api.post("/tailoring/split", data);

export const addAddons = (data) => api.post("/addons", data);

const _jobworkCache = new Map();
export const getJobwork = (params) => {
  const key = JSON.stringify(params || {});
  const now = Date.now();
  const hit = _jobworkCache.get(key);
  if (hit && now - hit.ts < CACHE_TTL.JOBWORK) return Promise.resolve(hit.res);
  return api.get("/jobwork", { params }).then(res => {
    _jobworkCache.set(key, { res, ts: Date.now() });
    return res;
  });
};
export const invalidateJobworkCache = () => _jobworkCache.clear();
export const moveJobwork = (data) => { _jobworkCache.clear(); return api.post("/jobwork/move", data); };
export const moveJobworkBack = (data) => { _jobworkCache.clear(); return api.post("/jobwork/move-back", data); };
export const moveJobworkEmb = (data) => { _jobworkCache.clear(); return api.post("/jobwork/move-emb", data); };
export const editJobworkEmb = (data) => { _jobworkCache.clear(); return api.post("/jobwork/edit-emb", data); };
let _jobworkFiltersCache = null;
let _jobworkFiltersCacheTime = 0;
export const getJobworkFilters = () => {
  const now = Date.now();
  if (_jobworkFiltersCache && now - _jobworkFiltersCacheTime < CACHE_TTL.JOBWORK_FILTERS) return Promise.resolve(_jobworkFiltersCache);
  return api.get("/jobwork/filters").then(res => { _jobworkFiltersCache = res; _jobworkFiltersCacheTime = Date.now(); return res; });
};

export const getBalances = (params) => api.get("/settlements/balances", { params });
export const processSettlement = (data) => api.post("/settlements/pay", data);

export const getDaybook = (params) => api.get("/daybook", { params });
let _daybookDatesCache = null;
let _daybookDatesCacheTime = 0;
export const getDaybookDates = () => {
  const now = Date.now();
  if (_daybookDatesCache && now - _daybookDatesCacheTime < CACHE_TTL.DAYBOOK_DATES) {
    return Promise.resolve(_daybookDatesCache);
  }
  return api.get("/daybook/dates").then(res => {
    _daybookDatesCache = res;
    _daybookDatesCacheTime = Date.now();
    return res;
  });
};
export const invalidateDaybookDatesCache = () => { _daybookDatesCache = null; };
let _daybookPendingCache = null;
let _daybookPendingCacheTime = 0;
export const getDaybookPendingCount = () => {
  const now = Date.now();
  if (_daybookPendingCache && now - _daybookPendingCacheTime < CACHE_TTL.DAYBOOK_PENDING) {
    return Promise.resolve(_daybookPendingCache);
  }
  return api.get("/daybook/pending-count", { silent: true }).then(res => {
    _daybookPendingCache = res;
    _daybookPendingCacheTime = Date.now();
    return res;
  });
};
export const invalidateDaybookPendingCache = () => { _daybookPendingCache = null; };
export const tallyEntries = (data) => api.post("/daybook/tally", data);

export const getLabourItems = (params) => api.get("/labour", { params });
let _karigarsCache = null;
let _karigarsCacheTime = 0;
export const getKarigars = () => {
  const now = Date.now();
  if (_karigarsCache && now - _karigarsCacheTime < CACHE_TTL.KARIGARS) return Promise.resolve(_karigarsCache);
  return api.get("/labour/karigars").then(res => { _karigarsCache = res; _karigarsCacheTime = Date.now(); return res; });
};
export const invalidateKarigarsCache = () => { _karigarsCache = null; };
export const payLabour = (data) => api.post("/labour/pay", data);
export const deleteLabourPayment = (data) => api.post("/labour/delete-payment", data);

let _advancesCache = null;
let _advancesCacheTime = 0;
export const getAdvances = (params) => {
  // Normalise refs array → comma string for the backend
  let normalized = params ? { ...params } : {};
  if (Array.isArray(normalized.refs)) {
    normalized.refs = normalized.refs.join(",");
  }
  const isUnscoped = !normalized || Object.keys(normalized).length === 0;
  if (isUnscoped) {
    const now = Date.now();
    if (_advancesCache && now - _advancesCacheTime < CACHE_TTL.ADVANCES) {
      return Promise.resolve(_advancesCache);
    }
    return api.get("/advances").then(res => {
      _advancesCache = res;
      _advancesCacheTime = Date.now();
      return res;
    });
  }
  return api.get("/advances", { params: normalized });
};
export const invalidateAdvancesCache = () => { _advancesCache = null; _advancesCacheTime = 0; };
export const createAdvance = (data) => api.post("/advances", data);
export const updateAdvance = (id, data) => api.put(`/advances/${id}`, data);
export const deleteAdvance = (id) => api.delete(`/advances/${id}`);

// Edit & Delete
export const updateItem = (id, data) => api.put(`/items/${id}`, data);
export const deleteItem = (id) => api.delete(`/items/${id}`);
export const bulkDeleteItems = (ids) => api.delete("/items/bulk/delete", { data: ids });
export const createItem = (data) => api.post("/items", data);

// Search
export const searchItems = (params) => api.get("/search", { params });

// Short-lived download token (Fix 1.3) — replaces JWT-in-URL pattern
export const createDownloadToken = () => api.post("/auth/download-token");

// Invoice (HTML only) — use short-lived download token instead of JWT in URL
export const getInvoiceUrl = async (ref, format = "standard", refs = null) => {
  const { data } = await createDownloadToken();
  const t = data.download_token;
  if (refs && refs.length > 0) {
    const refsParam = refs.map(r => encodeURIComponent(r)).join("&refs=");
    return `${BACKEND_URL}/api/invoice?refs=${refsParam}&format=${encodeURIComponent(format)}&token=${encodeURIComponent(t)}`;
  }
  return `${BACKEND_URL}/api/invoice?ref=${encodeURIComponent(ref)}&format=${encodeURIComponent(format)}&token=${encodeURIComponent(t)}`;
};

// Reports — 30 s in-process cache per param set
const _reportsCache = new Map();
const _cachedReport = (key, fetcher) => {
  const now = Date.now();
  const hit = _reportsCache.get(key);
  if (hit && now - hit.ts < CACHE_TTL.REPORTS) return Promise.resolve(hit.res);
  return fetcher().then(res => {
    if (_reportsCache.size >= PAGINATION.REPORTS_CACHE_MAX) {
      _reportsCache.delete(_reportsCache.keys().next().value);
    }
    _reportsCache.set(key, { res, ts: Date.now() });
    return res;
  });
};
export const getRevenueReport  = (params) => _cachedReport(`rev:${JSON.stringify(params)}`,  () => api.get("/reports/revenue",   { params }));
export const getCustomerReport = (params) => _cachedReport(`cust:${JSON.stringify(params)}`, () => api.get("/reports/customers", { params }));
export const getSummaryReport  = (params) => _cachedReport(`sum:${JSON.stringify(params)}`,  () => api.get("/reports/summary",   { params }));
export const invalidateReportsCache = () => _reportsCache.clear();

// Import / Export / Backup
export const importExcel = (formData, mode) => api.post(`/import/excel?mode=${mode}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const exportExcelUrl = async () => { const { data } = await createDownloadToken(); return `${BACKEND_URL}/api/export/excel?token=${encodeURIComponent(data.download_token)}`; };
export const backupUrl = async () => { const { data } = await createDownloadToken(); return `${BACKEND_URL}/api/backup?token=${encodeURIComponent(data.download_token)}`; };
export const restoreBackup = (formData) => api.post("/restore", formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const getDbStats = () => api.get("/db/stats");
export const getDbAudit = (params) => api.get("/db/audit", { params });
export const normalizeDbData = (params) => api.post("/db/normalize", null, { params });
export const repairDbData = (params) => api.post("/db/repair", null, { params });

// Settings
let _publicSettingsCache = null;
let _publicSettingsCacheTime = 0;
let _publicSettingsPromise = null;
export const getPublicSettings = () => {
  const now = Date.now();
  if (_publicSettingsCache && now - _publicSettingsCacheTime < CACHE_TTL.PUBLIC_SETTINGS) {
    return Promise.resolve(_publicSettingsCache);
  }
  if (_publicSettingsPromise) return _publicSettingsPromise;

  _publicSettingsPromise = api.get("/settings/public", { silent: true }).then(r => {
    _publicSettingsCache = r.data;
    _publicSettingsCacheTime = Date.now();
    _publicSettingsPromise = null;
    return r.data;
  }).catch(err => {
    _publicSettingsPromise = null;
    throw err;
  });
  return _publicSettingsPromise;
};
export const invalidatePublicSettingsCache = () => { _publicSettingsCache = null; };

let _settingsCache = null;
let _settingsCacheTime = 0;
export const getSettings = () => {
  const now = Date.now();
  if (_settingsCache && now - _settingsCacheTime < CACHE_TTL.SETTINGS) {
    return Promise.resolve(_settingsCache);
  }
  return api.get("/settings").then(res => {
    _settingsCache = res;
    _settingsCacheTime = Date.now();
    return res;
  });
};
export const invalidateSettingsCache = () => { _settingsCache = null; };
export const updateSettings = (data) => api.put("/settings", data);
export const uploadLogo = (formData) => api.post("/upload/logo", formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});

export const invalidateAllCaches = () => {
  invalidateDashboardCache();
  invalidateCustomersCache();
  invalidateItemsCache();
  invalidateAdvancesCache();
  invalidateDaybookDatesCache();
  invalidateDaybookPendingCache();
  invalidateJobworkCache();
  invalidateOrderStatusCache();
  invalidateReportsCache();
  invalidatePublicSettingsCache();
  invalidateSettingsCache();
  invalidateKarigarsCache();
};

// Auth
export const login = (username, password) => api.post("/auth/login", { username, password }).then(r => r.data);
export const logoutApi = () => api.post("/auth/logout");
export const getMe = () => api.get("/auth/me").then(r => r.data);
export const registerUser = (data) => api.post("/auth/register", data);
export const listUsers = () => api.get("/auth/users").then(r => r.data);
export const updateUser = (username, data) => api.put(`/auth/users/${username}`, data);
export const deleteUser = (username) => api.delete(`/auth/users/${username}`);
export const listAuditLogs = (params) => api.get("/audit-logs", { params });

// Group Management
export const createGroup = (itemIds, groupName) => api.post("/items/group", { item_ids: itemIds, group_name: groupName }).then(r => r.data);
export const updateGroup = (groupId, itemIds, groupName) => api.put(`/items/group/${groupId}`, { item_ids: itemIds, group_name: groupName }).then(r => r.data);
export const deleteGroup = (groupId) => api.delete(`/items/group/${groupId}`).then(r => r.data);
export const getGroup = (groupId) => api.get(`/items/group/${groupId}`).then(r => r.data);

// Bug Reporting
export const submitBugReport = (data) => api.post("/bug-report", data);

export default api;
