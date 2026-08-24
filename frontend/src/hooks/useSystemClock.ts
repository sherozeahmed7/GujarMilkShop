import { useState, useEffect } from 'react';

export const useSystemClock = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const tick = () => {
      setTime(new Date());
      // Schedule the next tick precisely at the start of the next minute
      const now = new Date();
      const delay = 60000 - (now.getSeconds() * 1000 + now.getMilliseconds());
      timeoutId = setTimeout(tick, delay);
    };

    // Calculate delay until the next minute boundary for the first tick
    const now = new Date();
    const delay = 60000 - (now.getSeconds() * 1000 + now.getMilliseconds());
    timeoutId = setTimeout(tick, delay);

    return () => clearTimeout(timeoutId);
  }, []);

  return {
    dateStr: time.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
    timeStr: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  };
};
