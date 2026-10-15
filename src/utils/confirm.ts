import { Alert, Platform } from 'react-native';

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

/** Promise-based confirmation using the platform's native dialog. */
export function confirm({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
}: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === 'web') {
    // react-native-web has no Alert implementation.
    return Promise.resolve(globalThis.confirm?.([title, message].filter(Boolean).join('\n\n')) ?? false);
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') {
    globalThis.alert?.([title, message].filter(Boolean).join('\n\n'));
    return;
  }
  Alert.alert(title, message);
}
