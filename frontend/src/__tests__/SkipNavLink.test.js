import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SkipNavLink from '../components/SkipNavLink';

describe('SkipNavLink', () => {
  test('should be hidden by default', () => {
    const { container } = render(<SkipNavLink />);
    const link = container.querySelector('a');
    expect(link).toBeInTheDocument();
    expect(link).toHaveClass('sr-only');
  });

  test('should have correct href', () => {
    const { container } = render(<SkipNavLink />);
    const link = container.querySelector('a');
    expect(link).toHaveAttribute('href', '#main-content');
  });

  test('should have aria-label', () => {
    const { container } = render(<SkipNavLink />);
    const link = container.querySelector('a');
    expect(link).toHaveAttribute('aria-label', 'Skip to main content');
  });
});
