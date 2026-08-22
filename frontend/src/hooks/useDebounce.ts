import { useState, useEffect } from 'react';

/**
 * Generic debounce hook.
 * Returns a debounced copy of `value` that only updates after
 * the component has not received a new value for `delay` ms.
 *
 * @param value  - The value to debounce
 * @param delay  - Debounce delay in milliseconds (default: 400)
 */
export function useDebounce<T>(value: T, delay = 400): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
