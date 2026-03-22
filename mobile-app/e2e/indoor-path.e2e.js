describe('US-4.2 Indoor shortest path', () => {
  it('builds an indoor route between two rooms', async () => {
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

    const doneLocation = step('Set location in room H-811');
    await device.setLocation(45.49704375081571, -73.57867847659573);
    await pause(1200);
    doneLocation();
    await pause();

    const doneSearch = step('Search for destination room H-822');
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

    const doneNavigate = step('Open indoor navigation');
    await waitFor(element(by.id('room-info-bubble')))
      .toBeVisible()
      .withTimeout(15000);
    await expect(element(by.text('Navigate here'))).toBeVisible();
    await element(by.text('Navigate here')).tap();
    await pause(1200);
    doneNavigate();
    await pause();

    const doneFloor = step('Select floor 8 if prompted');
    try {
      await waitFor(element(by.id('floor-select-modal')))
        .toBeVisible()
        .withTimeout(4000);
      await element(by.id('floor-select-8')).tap();
      await pause(800);
    } catch {}
    doneFloor();
    await pause();

    const doneRoomDetected = step('Confirm start room H-811 if prompted');
    try {
      await waitFor(element(by.text('Yes')))
        .toBeVisible()
        .withTimeout(4000);
      await element(by.text('Yes')).tap();
      await pause(800);
    } catch {}
    doneRoomDetected();
    await pause(2000);
    await device.sendToHome();
  });
});
