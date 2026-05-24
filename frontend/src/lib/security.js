import DOMPurify from 'dompurify';

/**
 * Security utilities for input sanitization and CSRF protection
 */

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param {string} html - Raw HTML string
 * @returns {string} Sanitized HTML
 */
export function sanitizeHtml(html) {
  if (typeof html !== 'string') return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'span'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });
}

/**
 * Sanitize user input text
 * @param {string} text - Raw text input
 * @returns {string} Sanitized text
 */
export function sanitizeText(text) {
  if (typeof text !== 'string') return '';
  // Remove potentially dangerous characters
  return text
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, 1000); // Limit length
}

/**
 * Validate and sanitize numeric input
 * @param {string|number} value - Input value
 * @param {Object} options - Validation options
 * @returns {number} Validated number or 0
 */
export function sanitizeNumber(value, options = {}) {
  const { min = 0, max = Infinity, decimals = 2 } = options;
  const num = parseFloat(value);
  if (isNaN(num)) return 0;
  const clamped = Math.max(min, Math.min(max, num));
  return parseFloat(clamped.toFixed(decimals));
}

/**
 * Generate CSRF token for requests
 * @returns {string} CSRF token
 */
export function getCsrfToken() {
  let token = sessionStorage.getItem('csrf_token');
  if (!token) {
    token = generateRandomToken();
    sessionStorage.setItem('csrf_token', token);
  }
  return token;
}

/**
 * Generate a random token
 * @returns {string} Random token
 */
function generateRandomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Validate session and check for expiry
 * @param {number} maxAge - Maximum session age in milliseconds
 * @returns {boolean} Whether session is valid
 */
export function isSessionValid(maxAge = 3600000) {
  const loginTime = sessionStorage.getItem('login_time');
  if (!loginTime) return false;
  const elapsed = Date.now() - parseInt(loginTime, 10);
  return elapsed < maxAge;
}

/**
 * Set session login time
 */
export function setSessionLoginTime() {
  sessionStorage.setItem('login_time', Date.now().toString());
}

/**
 * Clear session data
 */
export function clearSession() {
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('csrf_token');
  sessionStorage.removeItem('login_time');
}
