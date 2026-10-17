import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import * as Location from 'expo-location';
import { formatPlace } from '../../domain/profile';
import { LIMITS } from '../../constants/limits';
import { radius, spacing, useTheme } from '../../theme';
import type { ProfileLocation } from '../../types/models';
import { AppText, Button, Icon, TextField } from '../ui';

type Mode = 'detecting' | 'detected' | 'manual';

type Props = {
  value: ProfileLocation | null;
  onChange: (location: ProfileLocation | null) => void;
  error?: string | null;
  /** Ask for permission and detect as soon as the field appears (profile setup). */
  autoDetect?: boolean;
};

const TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}

/**
 * Location input: detects the city with the device's location (after the user grants
 * permission) and falls back to typing it in when permission is denied or detection fails.
 */
export function LocationField({ value, onChange, error, autoDetect = false }: Props) {
  const { colors, shadows } = useTheme();
  const [mode, setMode] = useState<Mode>(value?.source === 'gps' ? 'detected' : value ? 'manual' : autoDetect ? 'detecting' : 'manual');
  const [note, setNote] = useState<string | null>(null);
  const [manualText, setManualText] = useState(value?.source === 'manual' ? value.label : '');
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const detect = useCallback(async () => {
    setMode('detecting');
    setNote(null);
    const fallBack = (message: string) => {
      if (!mounted.current) return;
      setMode('manual');
      setNote(message);
      onChange(manualText.trim() ? { label: manualText.trim(), source: 'manual' } : null);
    };
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return fallBack('Location permission was not given. Please type your city instead.');
      if (!(await Location.hasServicesEnabledAsync())) return fallBack('Location is turned off on this phone. Type your city, or turn location on and try again.');
      const pos = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), TIMEOUT_MS).catch(() =>
        Location.getLastKnownPositionAsync(),
      );
      if (!pos) return fallBack('Couldn’t find your location. Please type your city.');
      // Coordinates are only used here, on the device, to look up the city name. They are
      // never stored or uploaded: only the city/region label is kept.
      const { latitude, longitude } = pos.coords;
      const [place] = await Location.reverseGeocodeAsync({ latitude, longitude }).catch(() => []);
      const label = place ? formatPlace([place.city ?? place.subregion ?? place.district, place.region, place.country]) : '';
      if (!mounted.current) return;
      if (!label) return fallBack('Couldn’t find a city name for your location. Please type your city.');
      onChange({ label, source: 'gps' });
      setMode('detected');
    } catch {
      fallBack('Couldn’t detect your location. Please type your city.');
    }
  }, [manualText, onChange]);

  const started = useRef(false);
  useEffect(() => {
    if (autoDetect && !value && !started.current) {
      started.current = true;
      void detect();
    }
  }, [autoDetect, value, detect]);

  const switchToManual = () => {
    setMode('manual');
    setNote(null);
    const text = value?.label ?? manualText;
    setManualText(text);
    onChange(text.trim() ? { label: text.trim(), source: 'manual' } : null);
  };

  if (mode === 'manual') {
    return (
      <View style={styles.gap}>
        <TextField
          label="Location"
          icon="location-outline"
          placeholder="City, state, country"
          value={manualText}
          onChangeText={(v) => {
            setManualText(v);
            onChange(v.trim() ? { label: v.trim(), source: 'manual' } : null);
          }}
          error={error}
          hint={note ?? undefined}
          maxLength={LIMITS.location}
          autoCapitalize="words"
          autoComplete="postal-address-locality"
          textContentType="addressCity"
          returnKeyType="done"
        />
        <Button title="Use my current location" icon="navigate-outline" variant="ghost" size="md" onPress={() => void detect()} />
      </View>
    );
  }

  return (
    <View>
      <AppText variant="label" tone="secondary" style={styles.label}>
        Location
      </AppText>
      <View
        style={[styles.box, { backgroundColor: colors.well, borderColor: error ? colors.danger : 'transparent' }, shadows.inset]}
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={mode === 'detecting' ? 'Detecting your location' : `Location: ${value?.label}`}
      >
        {mode === 'detecting' ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Icon name="location" size={19} color={colors.primary} />
        )}
        <AppText variant="body" style={styles.flex} numberOfLines={2}>
          {mode === 'detecting' ? 'Detecting your location…' : value?.label}
        </AppText>
      </View>
      {mode === 'detected' ? (
        <View style={styles.actions}>
          <Button title="Detect again" icon="refresh" variant="ghost" size="md" onPress={() => void detect()} style={styles.flex} />
          <Button title="Type it instead" icon="create-outline" variant="ghost" size="md" onPress={switchToManual} style={styles.flex} />
        </View>
      ) : (
        <Button title="Type it instead" icon="create-outline" variant="ghost" size="md" onPress={switchToManual} />
      )}
      {error ? (
        <AppText variant="caption" tone="danger" style={styles.label}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.xs },
  label: { marginBottom: spacing.sm, marginLeft: spacing.xs },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  actions: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
