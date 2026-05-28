import React from 'react';

/**
 * Skip Navigation Link - Accessibility feature
 * Allows keyboard users to skip repetitive navigation and jump to main content
 * Hidden until focused, then appears at top of page
 */
export default function SkipNavLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 
                 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-white 
                 focus:rounded-md focus:font-medium focus:shadow-lg focus:outline-none 
                 focus:ring-2 focus:ring-white"
      aria-label="Skip to main content"
    >
      Skip to main content
    </a>
  );
}
