const { withAndroidManifest } = require('expo/config-plugins');

const USAGE = 'android.permission.PACKAGE_USAGE_STATS';
const PERMISSIONS = [
  USAGE,
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
  'android.permission.POST_NOTIFICATIONS',
];

function hasPermission(manifest, name) {
  const list = manifest['uses-permission'] || [];
  return list.some((entry) => entry?.$?.['android:name'] === name);
}

function addPermission(manifest, name) {
  if (!manifest['uses-permission']) manifest['uses-permission'] = [];
  if (hasPermission(manifest, name)) {
    if (name === USAGE) {
      const entry = manifest['uses-permission'].find((item) => item?.$?.['android:name'] === name);
      if (entry?.$) entry.$['tools:ignore'] = 'ProtectedPermissions';
    }
    return;
  }
  const extras = name === USAGE ? { 'tools:ignore': 'ProtectedPermissions' } : {};
  manifest['uses-permission'].push({
    $: { 'android:name': name, ...extras },
  });
}

function ensureLauncherQueries(manifest) {
  if (!manifest.queries) manifest.queries = [];
  const already = manifest.queries.some((block) => {
    const intents = block.intent || [];
    return intents.some((intent) => {
      const action = intent.action?.[0]?.$?.['android:name'];
      const category = intent.category?.[0]?.$?.['android:name'];
      return (
        action === 'android.intent.action.MAIN' &&
        category === 'android.intent.category.LAUNCHER'
      );
    });
  });
  if (already) return;
  manifest.queries.push({
    intent: [
      {
        action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
        category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
      },
    ],
  });
}

function withFocusShields(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    if (!manifest.$) manifest.$ = {};
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    for (const name of PERMISSIONS) addPermission(manifest, name);
    ensureLauncherQueries(manifest);
    return config;
  });
}

module.exports = withFocusShields;
