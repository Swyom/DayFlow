import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { isCloudConfigured } from '../../services/cloudSync';
import { useProfileContext } from '../../state/ProfileProvider';
import { spacing, useTheme } from '../../theme';
import { notify } from '../../utils/confirm';
import { AppText, Avatar, Icon } from '../ui';

const SIZE = 104;
/** Avatars are stored as 512 px JPEGs: sharp on any screen, ~50–100 KB each. */
const MAX_PX = 512;

/** Square photo picked from the library, resized and stored privately in Supabase Storage. */
async function pickSquareJpeg(): Promise<{ uri: string; base64: string } | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (picked.canceled || !picked.assets[0]) return null;
  const asset = picked.assets[0];
  const ctx = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > MAX_PX) {
    ctx.resize(asset.width >= asset.height ? { width: MAX_PX } : { height: MAX_PX });
  }
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG, base64: true });
  if (!saved.base64) throw new Error('Image encoding failed.');
  return { uri: saved.uri, base64: saved.base64 };
}

export function AvatarPicker({ name }: { name: string }) {
  const { colors, shadows } = useTheme();
  const { profile, avatarUrl, changeAvatar, removeAvatar } = useProfileContext();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const hasPhoto = !!profile?.avatarPath;

  const choose = async () => {
    try {
      const image = await pickSquareJpeg();
      if (!image) return;
      setPreview(image.uri);
      setBusy(true);
      await changeAvatar(image.base64, image.uri);
    } catch {
      setPreview(null);
      notify('Couldn’t upload your photo', 'Check your internet connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await removeAvatar();
      setPreview(null);
    } catch {
      notify('Couldn’t remove your photo', 'Check your internet connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const open = () => {
    if (busy) return;
    if (!isCloudConfigured()) {
      notify('Photos unavailable', 'Cloud storage isn’t set up in this build of DayFlow.');
      return;
    }
    if (!hasPhoto) {
      void choose();
      return;
    }
    Alert.alert('Profile photo', undefined, [
      { text: 'Change photo', onPress: () => void choose() },
      { text: 'Remove photo', style: 'destructive', onPress: () => void remove() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.root}>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={hasPhoto ? 'Profile photo. Change or remove' : 'Add a profile photo'}
        accessibilityState={{ busy }}
      >
        <Avatar name={name} size={SIZE} uri={preview ?? avatarUrl} />
        {busy ? (
          <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : null}
        <View style={[styles.badge, { backgroundColor: colors.primary }, shadows.raisedSm]}>
          <Icon name={hasPhoto ? 'pencil' : 'camera'} size={16} color={colors.onPrimary} />
        </View>
      </Pressable>
      <AppText variant="caption" tone="secondary" align="center">
        {hasPhoto ? 'Tap to change or remove your photo' : 'Tap to add a photo'}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: spacing.sm, marginVertical: spacing.lg },
  overlay: {
    position: 'absolute',
    top: 5,
    left: 5,
    width: SIZE - 10,
    height: SIZE - 10,
    borderRadius: (SIZE - 10) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
