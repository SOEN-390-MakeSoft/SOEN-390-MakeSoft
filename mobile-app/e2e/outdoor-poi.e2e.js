describe('Outdoor POI – search restaurant and get directions', () => {
  it('searches for a restaurant, selects the first result, and opens directions', async () => {
    const pause = (ms = 600) => new Promise((resolve) => setTimeout(resolve, ms));
    const fastPause = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));
    const step = (label) => {
      // eslint-disable-next-line no-console
      console.log(`[ ] ${label}`);
      return () => {
        // eslint-disable-next-line no-console
        console.log(`[x] ${label}`);
      };
    };

    // ── Step 1: Launch and skip onboarding ──────────────────────────
    const doneLaunch = step('Launch app and skip onboarding');
    try {
      await waitFor(element(by.id('onboarding-skip')))
        .toBeVisible()
        .withTimeout(15000);
      await element(by.id('onboarding-skip')).tap();
    } catch (_) {
      try {
        await waitFor(element(by.id('get-started')))
          .toBeVisible()
          .withTimeout(3000);
        await element(by.id('get-started')).tap();
      } catch (_) {}
    }
    await fastPause();
    await waitFor(element(by.id('map-screen')))
      .toBeVisible()
      .withTimeout(20000);
    doneLaunch();
    await fastPause();

    // -- Step 2: Dismiss calendar prompt if it appears --
    const doneCalendar = step('Dismiss calendar prompt (if any)');
    try {
      await waitFor(element(by.id('classes-calendar-required')))
        .toBeVisible()
        .withTimeout(3000);
      const e2eCalendarUrl = process.env.EXPO_PUBLIC_E2E_CALENDAR_MODE;
      if (e2eCalendarUrl) {
        await element(by.id('calendar-required-connect')).tap();
        await fastPause();
        await waitFor(element(by.id('calendar-link-input')))
          .toBeVisible()
          .withTimeout(10000);
        await element(by.id('calendar-link-input')).replaceText(e2eCalendarUrl);
        await fastPause();
        await element(by.id('calendar-connect-button')).tap();
        await fastPause();
        await waitFor(element(by.id('calendar-modal-close')))
          .toBeVisible()
          .withTimeout(10000);
        await element(by.id('calendar-modal-close')).tap();
        await fastPause();
      } else {
        await element(by.id('continue-as-guest')).tap();
        await fastPause();
      }
    } catch (_) {}
    doneCalendar();
    await fastPause();

    // ── Step 3: Wait for the map to be ready ────────────────────────
    const doneMap = step('Wait for map to be visible');
    await waitFor(element(by.id('campus-map')))
      .toBeVisible()
      .withTimeout(20000);
    doneMap();
    await pause();

    // ── Step 4: Tap the search bar and type "restaurant" ──────────
    const doneSearch = step('Type "restaurant" in search bar');
    await waitFor(element(by.id('map-search-input')))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.id('map-search-input')).tap();
    await pause();
    await element(by.id('map-search-input')).typeText('restaurant');
    doneSearch();

    // ── Step 5: Wait for results and pick the first one ─────────
    const doneSelect = step('Select the first search result');
    await device.disableSynchronization();
    try {
      await waitFor(element(by.id('map-search-results')))
        .toExist()
        .withTimeout(30000);
      await waitFor(element(by.id('search-result-0')))
        .toExist()
        .withTimeout(15000);
      await element(by.id('search-result-0')).tap();
    } finally {
      await device.enableSynchronization();
    }
    doneSelect();
    await pause(1500);

    // ── Step 6: Verify the POI info card is shown ───────────────────
    const doneCard = step('Verify POI info card is visible');
    await waitFor(element(by.id('poi-name')))
      .toBeVisible()
      .withTimeout(10000);
    doneCard();
    await fastPause();

    // ── Step 7: Tap "Directions" ────────────────────────────────────
    const doneDirections = step('Tap Directions on the POI card');
    await waitFor(element(by.label('Get directions')))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.label('Get directions')).tap();
    doneDirections();
    await pause(2000);

    await device.sendToHome();
  });
});
