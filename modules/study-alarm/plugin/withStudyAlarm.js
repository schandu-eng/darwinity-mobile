const { withAndroidManifest } = require('expo/config-plugins');

const PERMISSIONS = [
  'android.permission.SCHEDULE_EXACT_ALARM',
  'android.permission.USE_EXACT_ALARM',
  'android.permission.USE_FULL_SCREEN_INTENT',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.VIBRATE',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
  'android.permission.POST_NOTIFICATIONS',
];

function hasPermission(manifest, name) {
  const list = manifest['uses-permission'] || [];
  return list.some((entry) => entry?.$?.['android:name'] === name);
}

function withStudyAlarm(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    if (!manifest['uses-permission']) manifest['uses-permission'] = [];
    for (const name of PERMISSIONS) {
      if (!hasPermission(manifest, name)) {
        manifest['uses-permission'].push({ $: { 'android:name': name } });
      }
    }
    return config;
  });
}

module.exports = withStudyAlarm;
