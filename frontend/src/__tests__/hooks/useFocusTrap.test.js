import { renderHook } from '@testing-library/react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

describe('useFocusTrap', () => {
  test('should return ref', () => {
    const { result } = renderHook(() => useFocusTrap(true));
    expect(result.current).toBeDefined();
  });

  test('should handle false value', () => {
    const { result } = renderHook(() => useFocusTrap(false));
    expect(result.current).toBeDefined();
  });
});
