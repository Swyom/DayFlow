import { useCallback, useEffect, useState } from 'react';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { confirm } from '../utils/confirm';

/**
 * Asks before leaving a form with unsaved edits (back button, swipe, close).
 * Returns `exit(fn)`: lifts the guard first, then runs `fn` (e.g. goBack after saving).
 */
export function useDiscardGuard(dirty: boolean) {
  const navigation = useNavigation();
  const [pendingExit, setPendingExit] = useState<(() => void) | null>(null);

  usePreventRemove(dirty && !pendingExit, ({ data }) => {
    confirm({
      title: 'Discard changes?',
      message: 'You have unsaved changes that will be lost.',
      confirmLabel: 'Discard',
      cancelLabel: 'Keep editing',
      destructive: true,
    }).then((ok) => {
      if (ok) navigation.dispatch(data.action);
    });
  });

  // Runs after the commit that disabled the guard, so navigation isn't intercepted.
  useEffect(() => {
    pendingExit?.();
  }, [pendingExit]);

  return useCallback((action: () => void) => setPendingExit(() => action), []);
}
