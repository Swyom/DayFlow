import React, { ReactNode, useState } from 'react';
import { ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { Edge, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAX_CONTENT_WIDTH, SCREEN_GUTTER, spacing, useTheme } from '../../theme';

type ScreenProps = {
  children: ReactNode;
  /** Scrollable body (default). Set false for fixed layouts like the game. */
  scroll?: boolean;
  /** Pinned under the content (e.g. a form's Save button); rides above the keyboard. */
  footer?: ReactNode;
  /** Safe-area edges to pad. Tab screens use ['top'] since the tab bar owns the bottom. */
  edges?: Edge[];
  /**
   * Form mode: the focused input is always scrolled clear of the keyboard and the
   * footer sticks to the keyboard's top edge. Implemented with
   * react-native-keyboard-controller so it behaves the same on every Android
   * skin (edge-to-edge breaks `adjustResize`/KeyboardAvoidingView on many OEMs).
   */
  keyboard?: boolean;
  /** Header rendered above the scroll area so it stays put. */
  header?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

const FOOTER_GAP = spacing.md;

/**
 * Standard screen scaffold: safe areas (status bar, cutouts, navigation bar),
 * themed background, centred max-width column for tablets/foldables, keyboard
 * handling and an optional pinned footer.
 */
export function Screen({
  children,
  scroll = true,
  footer,
  edges = ['top'],
  keyboard = false,
  header,
  contentStyle,
}: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [footerHeight, setFooterHeight] = useState(0);
  const padBottom = edges.includes('bottom');
  const bottomInset = padBottom ? insets.bottom : 0;
  const safeEdges = edges.filter((e) => e !== 'bottom');
  const footerPadBottom = Math.max(bottomInset, spacing.lg);

  const contentPadding = { paddingBottom: footer ? spacing.lg : spacing.huge + bottomInset };
  const scrollProps = {
    style: styles.flex,
    contentContainerStyle: [styles.content, contentPadding, contentStyle],
    keyboardShouldPersistTaps: 'handled' as const,
    showsVerticalScrollIndicator: false,
  };

  const body = !scroll ? (
    <View style={[styles.flex, styles.content, { paddingBottom: footer ? 0 : bottomInset }, contentStyle]}>{children}</View>
  ) : keyboard ? (
    <KeyboardAwareScrollView {...scrollProps} bottomOffset={footerHeight + FOOTER_GAP} keyboardDismissMode="interactive">
      {children}
    </KeyboardAwareScrollView>
  ) : (
    <ScrollView {...scrollProps}>{children}</ScrollView>
  );

  const footerView = footer ? (
    <View
      onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
      style={[styles.footer, { paddingBottom: footerPadBottom, backgroundColor: colors.background }]}
    >
      {footer}
    </View>
  ) : null;

  return (
    <SafeAreaView edges={safeEdges} style={[styles.flex, { backgroundColor: colors.background }]}>
      {header ? <View style={styles.headerWrap}>{header}</View> : null}
      {body}
      {footerView && keyboard ? (
        // While the keyboard is open the nav-bar inset sits under it, so drop that padding.
        <KeyboardStickyView offset={{ closed: 0, opened: footerPadBottom - FOOTER_GAP }}>{footerView}</KeyboardStickyView>
      ) : (
        footerView
      )}
    </SafeAreaView>
  );
}

const column: ViewStyle = { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' };

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { ...column, paddingHorizontal: SCREEN_GUTTER, paddingTop: spacing.sm },
  headerWrap: { ...column, paddingHorizontal: SCREEN_GUTTER, paddingTop: spacing.sm },
  footer: { ...column, paddingHorizontal: SCREEN_GUTTER, paddingTop: spacing.md },
});
