/**
 * Application Constants
 * Centralized magic numbers and configuration values
 */

// Cache TTL values (in milliseconds)
export const CACHE_TTL = {
  DASHBOARD: 60000,           // 1 minute
  CUSTOMERS: 60000,          // 1 minute
  ITEMS: 30000,              // 30 seconds
  ORDER_STATUS: 20000,       // 20 seconds
  JOBWORK: 15000,            // 15 seconds
  JOBWORK_FILTERS: 120000,  // 2 minutes
  DAYBOOK_DATES: 60000,      // 1 minute
  DAYBOOK_PENDING: 60000,    // 1 minute
  ADVANCES: 60000,           // 1 minute
  REPORTS: 30000,            // 30 seconds
  PUBLIC_SETTINGS: 120000,   // 2 minutes
  SETTINGS: 120000,          // 2 minutes
  KARIGARS: 300000,          // 5 minutes
};

// Animation durations (in milliseconds)
export const ANIMATION_DURATION = {
  PAGE_IN: 180,
  PAGE_OUT: 120,
  TOAST_REMOVE: 4000,
  ACCORDION: 200,
  TRANSITION_FAST: 150,
  TRANSITION_NORMAL: 200,
  TRANSITION_SLOW: 300,
};

// Toast configuration
export const TOAST_CONFIG = {
  LIMIT: 1,
  REMOVE_DELAY: 4000,
};

// Pagination and limits
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 200,
  REPORTS_CACHE_MAX: 50,
};

// Breakpoints (in pixels)
export const BREAKPOINTS = {
  XS: 475,
  SM: 640,
  MD: 768,
  LG: 1024,
  XL: 1280,
  XXL: 1536,
};

// Session configuration
export const SESSION = {
  TOKEN_KEY: 'token',
  SIDEBAR_OPEN_KEY: 'sidebar_open',
  THEME_KEY: 'theme',
  SHORTCUTS_KEY: 'shortcuts',
  WARNING_BEFORE_EXPIRY: 300000, // 5 minutes before expiry
};

// Input constraints
export const INPUT_CONSTRAINTS = {
  BARCODE_MAX_LENGTH: 60,
  DISCOUNT_MAX: 100,
  DISCOUNT_MIN: 0,
  QUANTITY_MIN: 0,
  PRICE_MIN: 0,
};

// API endpoints
export const API_ENDPOINTS = {
  BACKEND_PORT: 8001,
  API_BASE: '/api',
};

// File size limits (in bytes)
export const FILE_SIZE_LIMITS = {
  LOGO: 2 * 1024 * 1024,      // 2MB
  EXCEL_IMPORT: 10 * 1024 * 1024, // 10MB
  BACKUP: 50 * 1024 * 1024,    // 50MB
};

// Date format presets
export const DATE_PRESETS = {
  TODAY: 'Today',
  THIS_WEEK: 'This Week',
  THIS_MONTH: 'This Month',
  LAST_MONTH: 'Last Month',
  LAST_90_DAYS: 'Last 90 Days',
};

// Role-based access
export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  STAFF: 'staff',
};

// Settlement tabs
export const SETTLE_TABS = [
  { k: 'unsettled', l: 'Pending' },
  { k: 'awaiting', l: 'Awaiting' },
  { k: 'settled', l: 'Settled' },
  { k: 'all', l: 'All' },
];

// Tailoring status options
export const TAILORING_STATUS = [
  'All',
  'N/A',
  'Awaiting Order',
  'Pending',
  'Stitched',
  'Delivered',
];

// Payment status options
export const PAYMENT_STATUS = [
  'All',
  'Pending',
  'Settled',
];

// Invoice formats
export const INVOICE_FORMATS = [
  'standard',
  'detailed',
  'minimal',
];

// Keyboard shortcuts
export const SHORTCUTS = {
  HELP: '?',
  ESCAPE: 'Escape',
  SIDEBAR: 'b',
  NEW_BILL: 'n',
  SEARCH: '/',
};

// Debounce delays (in milliseconds)
export const DEBOUNCE_DELAY = {
  SEARCH: 300,
  INPUT: 200,
  RESIZE: 250,
};

// Accessibility
export const A11Y = {
  FOCUS_VISIBLE_OFFSET: 2,
  MIN_TAP_TARGET: 40, // pixels
};
