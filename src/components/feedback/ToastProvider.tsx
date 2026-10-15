import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAX_CONTENT_WIDTH, radius, SCREEN_GUTTER, spacing, useTheme } from '../../theme';
import { AppText } from '../ui/AppText';
import { Icon, IconName } from '../ui/Icon';

export type ToastOptions = {
  message: string;
  tone?: 'default' | 'success' | 'error';
  actionLabel?: string;
  onAction?: () => void;
  /** ms; actions get longer by default so there is time to tap Undo. */
  duration?: number;
};

type ToastState = ToastOptions & { id: number };
type ToastApi = { show: (options: ToastOptions) => void; hide: () => void };

const ToastContext = createContext<ToastApi | null>(null);

/** Clearance above the docked tab bar so toasts never cover navigation. */
const TAB_BAR_CLEARANCE = 84;

const TONE_ICON: Record<NonNullable<ToastOptions['tone']>, IconName> = {
  default: 'information-circle',
  success: 'checkmark-circle',
  error: 'alert-circle',
};

/** App-wide snackbar: one message at a time, slides up from the bottom. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setToast(null);
    });
  }, [anim]);

  const show = useCallback(
    (options: ToastOptions) => {
      if (timer.current) clearTimeout(timer.current);
      seq.current += 1;
      setToast({ ...options, id: seq.current });
      anim.setValue(0);
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 220, mass: 0.8 }).start();
      AccessibilityInfo.announceForAccessibility(options.message);
      timer.current = setTimeout(hide, options.duration ?? (options.actionLabel ? 7000 : 3500));
    },
    [anim, hide],
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const api = useMemo(() => ({ show, hide }), [show, hide]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast ? <ToastView toast={toast} anim={anim} onDismiss={hide} /> : null}
    </ToastContext.Provider>
  );
}

function ToastView({ toast, anim, onDismiss }: { toast: ToastState; anim: Animated.Value; onDismiss: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const tone = toast.tone ?? 'default';

  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.host]}>
      <Animated.View
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={[
          styles.toast,
          {
            backgroundColor: colors.toast,
            marginBottom: insets.bottom + TAB_BAR_CLEARANCE,
            opacity: anim,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
          },
        ]}
      >
        <Icon name={TONE_ICON[tone]} size={20} color={colors.onToast} />
        <AppText variant="callout" color={colors.onToast} style={styles.message} numberOfLines={3}>
          {toast.message}
        </AppText>
        {toast.actionLabel && toast.onAction ? (
          <Pressable
            onPress={() => {
              toast.onAction?.();
              onDismiss();
            }}
            hitSlop={8}
            accessibilityRole="button"
            style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}
          >
            <AppText variant="label" color={colors.toastAction} style={styles.actionText}>
              {toast.actionLabel}
            </AppText>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  host: { justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: SCREEN_GUTTER },
  toast: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
    paddingVertical: spacing.md,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    borderRadius: radius.md,
    boxShadow: '0px 8px 24px rgba(0,0,0,0.25)',
  },
  message: { flex: 1 },
  action: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: 44, justifyContent: 'center' },
  actionText: { textTransform: 'uppercase', letterSpacing: 0.6 },
});
