import { renderHook, act } from '@testing-library/react';
import { useToast } from '../../hooks/use-toast';

describe('useToast', () => {
  test('should have toast function', () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toast).toBeDefined();
    expect(typeof result.current.toast).toBe('function');
  });

  test('should be able to call toast', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.toast({ title: 'Test' });
    });
    // Should not throw error
    expect(true).toBe(true);
  });
});
