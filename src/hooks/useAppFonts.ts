import { useFonts } from 'expo-font';
import { fonts } from '../theme/tokens';

/**
 * Loads the bundled Plus Jakarta Sans files (SIL OFL 1.1, see assets/fonts/OFL.txt).
 * Resolves to true on failure as well so the app falls back to system fonts instead of hanging.
 */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    [fonts.regular]: require('../../assets/fonts/PlusJakartaSans_400Regular.ttf'),
    [fonts.medium]: require('../../assets/fonts/PlusJakartaSans_500Medium.ttf'),
    [fonts.semibold]: require('../../assets/fonts/PlusJakartaSans_600SemiBold.ttf'),
    [fonts.bold]: require('../../assets/fonts/PlusJakartaSans_700Bold.ttf'),
    [fonts.extrabold]: require('../../assets/fonts/PlusJakartaSans_800ExtraBold.ttf'),
  });
  if (error && __DEV__) console.warn('[fonts] falling back to system fonts', error);
  return loaded || !!error;
}
