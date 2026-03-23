describe('US-4.1 Indoor rooms', () => {
  it('shows rooms and lets the user navigate to a room', async () => {
    const e2eCalendarUrl = process.env.EXPO_PUBLIC_E2E_CALENDAR_MODE;
    const pause = (ms = 600) => new Promise((resolve) => setTimeout(resolve, ms));
    const step = (label) => {
      // Simple ASCII checkbox markers for terminal output.
      // eslint-disable-next-line no-console
      console.log(`[ ] ${label}`);
      return () => {
        // eslint-disable-next-line no-console
        console.log(`[x] ${label}`);
      };
    };

    const doneLaunch = step('Launch app and open map');
    await waitFor(element(by.id('get-started')))
      .toBeVisible()
      .withTimeout(15000);
    await element(by.id('get-started')).tap();
    await pause();

    await waitFor(element(by.id('map-screen')))
      .toBeVisible()
      .withTimeout(20000);
    doneLaunch();
    await pause();

    const doneCalendar = step('Ensure Classes calendar is connected');
    try {
      await waitFor(element(by.id('classes-calendar-required')))
        .toBeVisible()
        .withTimeout(2000);
      if (!e2eCalendarUrl) {
        throw new Error('EXPO_PUBLIC_E2E_CALENDAR_MODE is not set for e2e calendar connect.');
      }
      await element(by.id('calendar-required-connect')).tap();
      await pause();
      await waitFor(element(by.id('calendar-link-input')))
        .toBeVisible()
        .withTimeout(10000);
      await element(by.id('calendar-link-input')).replaceText(e2eCalendarUrl);
      await pause();
      await element(by.id('calendar-connect-button')).tap();
      await pause();
      await waitFor(element(by.label('Close')))
        .toBeVisible()
        .withTimeout(10000);
      await element(by.label('Close')).tap();
      await pause();
    } catch {}
    doneCalendar();
    await pause();

    const doneMapReady = step('Wait for map to be visible');
    await waitFor(element(by.id('campus-map')))
      .toBeVisible()
      .withTimeout(20000);
    doneMapReady();
    await pause();

    const doneSearch = step('Search for room H-822 and select result');
    await element(by.id('map-search-input')).tap();
    await pause();
    await element(by.id('map-search-input')).replaceText('H-822');
    await pause();

    await waitFor(element(by.id('map-search-results')))
      .toBeVisible()
      .withTimeout(15000);
    await waitFor(element(by.id('search-result-0')))
      .toBeVisible()
      .withTimeout(15000);
    await element(by.id('search-result-0')).tap();
    doneSearch();
    await pause();

    const doneIndoorUi = step('Navigation to room available');
    await waitFor(element(by.id('floor-selector')))
      .toBeVisible()
      .withTimeout(15000);
    await expect(element(by.id('room-info-bubble'))).toBeVisible();
    await expect(element(by.text('Navigate here'))).toBeVisible();
    doneIndoorUi();
    await pause(2000);
    await device.sendToHome();
  });
});
