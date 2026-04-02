try {
  // Load local env for e2e runs (calendar auto-connect, API keys, etc.).
  // Ignore if dotenv isn't available in the environment.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require('path');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.local') });
} catch {}

globalThis.beforeEach(async () => {
  await device.launchApp({ newInstance: true });
});
