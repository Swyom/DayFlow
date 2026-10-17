/**
 * Dynamic layer over app.json: adds config plugins whose values come from the
 * environment (.env locally, EAS environment variables in the cloud).
 * Only public identifiers belong here — never secrets.
 */

// Google's published sample AdMob app IDs: they only ever serve test ads.
const SAMPLE_ADMOB_APP_ID = {
  android: 'ca-app-pub-3940256099942544~3347511713',
  ios: 'ca-app-pub-3940256099942544~1458002511',
};

module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    [
      'expo-location',
      {
        locationWhenInUsePermission: 'DayFlow uses your location once to fill in the city on your profile.',
        isAndroidBackgroundLocationEnabled: false,
        isIosBackgroundLocationEnabled: false,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'DayFlow lets you choose a photo from your library for your profile picture.',
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
    [
      'expo-sensors',
      {
        motionPermission: 'DayFlow counts your steps with the motion sensor to track your daily step goal.',
      },
    ],
    [
      'react-native-google-mobile-ads',
      {
        androidAppId: process.env.ADMOB_APP_ID_ANDROID || SAMPLE_ADMOB_APP_ID.android,
        iosAppId: process.env.ADMOB_APP_ID_IOS || SAMPLE_ADMOB_APP_ID.ios,
        // Ads SDK waits for the consent flow before measuring anything.
        delayAppMeasurementInit: true,
      },
    ],
    './plugins/withoutUnusedServices',
  ],
});
