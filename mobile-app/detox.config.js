/** @type {import('detox').DetoxConfig} */
module.exports = {
  testRunner: 'jest',
  runnerConfig: 'e2e/jest.config.js',
  apps: {
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      testBinaryPath: 'android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk',
      build: 'cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug',
    },
  },
  devices: {
    emulator: {
      type: 'android.emulator',
      device: {
        avdName: process.env.DETOX_AVD_NAME || 'Pixel_3a_API_34',
      },
    },
  },
  configurations: {
    'android.emu.debug': {
      device: 'emulator',
      app: 'android.debug',
    },
  },
};
