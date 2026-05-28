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
  LIMIT: 3,
  REMOVE_DELAY: 4000,
};

// CSS Token Constants (Fix 4.7)
// Centralized CSS variable references for consistency
export const CSS_TOKENS = {
  // Colors
  BG: 'var(--bg)',
  SURFACE: 'var(--surface)',
  TEXT_PRIMARY: 'var(--text-primary)',
  TEXT_SECONDARY: 'var(--text-secondary)',
  BRAND: 'var(--brand)',
  BRAND_HOVER: 'var(--brand-hover)',
  BRAND_FG: 'var(--brand-fg)',
  SUCCESS: 'var(--success)',
  WARNING: 'var(--warning)',
  INFO: 'var(--info)',
  ERROR: 'var(--error)',
  BORDER_SUBTLE: 'var(--border-subtle)',
  BORDER_STRONG: 'var(--border-strong)',
  // Aliases for commonly used tokens
  MUTED: 'var(--text-secondary)',
  MUTED_FOREGROUND: 'var(--text-secondary)',
  FOREGROUND: 'var(--text-primary)',
  BACKGROUND: 'var(--bg)',
  CARD: 'var(--surface)',
  BORDER: 'var(--border-subtle)',
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

// Unified navigation configuration (Fix 6.2)
export const NAV_CONFIG = [
  { key: "dashboard", label: "Dashboard", icon: "House", path: "/" },
  { key: "new-bill", label: "New Bill", icon: "Receipt", path: "/new-bill" },
  { key: "daybook", label: "Daybook", icon: "BookOpen", path: "/daybook", managerOnly: true },
  { key: "labour", label: "Labour Payments", icon: "UsersThree", path: "/labour", managerOnly: true },
  { key: "items", label: "Manage Orders", icon: "Table", path: "/items", managerOnly: true },
  { key: "jobwork", label: "Job Work", icon: "Kanban", path: "/jobwork" },
  { key: "order-status", label: "Order Status", icon: "ClipboardText", path: "/order-status" },
  { key: "reports", label: "Reports", icon: "ChartBar", path: "/reports", managerOnly: true },
  { key: "data", label: "Data Manager", icon: "Database", path: "/data", adminOnly: true },
  { key: "settings", label: "Settings", icon: "Gear", path: "/settings", adminOnly: true },
  { key: "users", label: "Users", icon: "UsersFour", path: "/users", adminOnly: true },
  { key: "audit", label: "Audit Log", icon: "ClockCounterClockwise", path: "/audit", adminOnly: true },
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
