import { fmt, fmtCurrency, fmtDate } from '../fmt';

describe('fmt utility functions', () => {
  describe('fmt', () => {
    it('should format positive numbers with Indian locale', () => {
      expect(fmt(1234)).toBe('1,234');
      expect(fmt(100000)).toBe('1,00,000');
      expect(fmt(9999999)).toBe('99,99,999');
    });

    it('should format negative numbers correctly', () => {
      expect(fmt(-1234)).toBe('-1,234');
      expect(fmt(-100000)).toBe('-1,00,000');
    });

    it('should handle zero', () => {
      expect(fmt(0)).toBe('0');
    });

    it('should handle null/undefined', () => {
      expect(fmt(null)).toBe('0');
      expect(fmt(undefined)).toBe('0');
    });

    it('should round numbers', () => {
      expect(fmt(1234.5)).toBe('1,235');
      expect(fmt(1234.4)).toBe('1,234');
    });
  });

  describe('fmtCurrency', () => {
    it('should add rupee symbol', () => {
      expect(fmtCurrency(1234)).toBe('₹1,234');
      expect(fmtCurrency(0)).toBe('₹0');
    });

    it('should handle negative numbers', () => {
      expect(fmtCurrency(-1234)).toBe('₹-1,234');
    });
  });

  describe('fmtDate', () => {
    it('should format valid dates', () => {
      const date = '2024-01-15';
      const result = fmtDate(date);
      expect(result).toMatch(/Jan/);
      expect(result).toMatch(/2024/);
    });

    it('should handle null/undefined', () => {
      expect(fmtDate(null)).toBe('-');
      expect(fmtDate(undefined)).toBe('-');
    });

    it('should handle invalid dates gracefully', () => {
      expect(fmtDate('invalid')).toBe('Invalid Date');
    });
  });
});
