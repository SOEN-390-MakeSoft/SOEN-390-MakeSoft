const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const detoxAndroidDir = path.join(projectRoot, 'node_modules', 'detox', 'android');
const settingsPath = path.join(detoxAndroidDir, 'settings.gradle');
const localPropsPath = path.join(detoxAndroidDir, 'local.properties');

if (!fs.existsSync(detoxAndroidDir)) {
  console.error('Detox android directory not found. Run npm install first.');
  process.exit(1);
}

const settings = fs.readFileSync(settingsPath, 'utf8');
const patched = settings
  .replaceAll('../node_modules/@react-native/gradle-plugin', '../../@react-native/gradle-plugin')
  .replaceAll('../node_modules/react-native-gradle-plugin', '../../react-native-gradle-plugin');

if (patched !== settings) {
  fs.writeFileSync(settingsPath, patched);
}

const sdkDir =
  process.env.ANDROID_SDK_ROOT ||
  process.env.ANDROID_HOME ||
  path.join(process.env.HOME || '', 'Library/Android/sdk');

fs.writeFileSync(localPropsPath, `sdk.dir=${sdkDir}\n`);

const detoxPkg = require('detox/package.json');
const version = detoxPkg.version || '20.47.0';

const result = spawnSync('./gradlew', ['publish', `-Dversion=${version}`], {
  cwd: detoxAndroidDir,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
