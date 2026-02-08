module.exports = {
  testEnvironment: 'detox/runners/jest/testEnvironment',
  testRunner: 'jest-circus/runner',
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  testTimeout: 120000,
  testMatch: ['**/*.e2e.js'],
  setupFilesAfterEnv: ['<rootDir>/init.js'],
};
