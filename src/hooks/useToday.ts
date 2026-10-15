import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { msUntilMidnight, todayKey } from '../utils/date';

/** Today's date key; rolls over at local midnight and when the app returns to the foreground. */
export function useToday() {
  const [today, setToday] = useState(todayKey);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        setToday(todayKey());
        schedule();
      }, msUntilMidnight() + 1000);
    };
    schedule();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setToday(todayKey());
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, []);

  return today;
}
