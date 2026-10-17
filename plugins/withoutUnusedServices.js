const { withAndroidManifest } = require('expo/config-plugins');

/**
 * expo-location's library manifest always declares a background-location foreground service
 * (LocationTaskService, foregroundServiceType="location"). DayFlow only reads the location
 * once, in the foreground, so the service is removed from the merged manifest. This keeps
 * the app out of Google Play's foreground-service declarations and makes it clear that no
 * background location is possible.
 */
const UNUSED_SERVICES = ['expo.modules.location.services.LocationTaskService'];

module.exports = function withoutUnusedServices(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$ = { ...manifest.$, 'xmlns:tools': 'http://schemas.android.com/tools' };
    const app = manifest.application?.[0];
    if (!app) return cfg;
    const services = (app.service ?? []).filter((s) => !UNUSED_SERVICES.includes(s.$?.['android:name']));
    for (const name of UNUSED_SERVICES) {
      services.push({ $: { 'android:name': name, 'tools:node': 'remove' } });
    }
    app.service = services;
    return cfg;
  });
};
