describe('US-4.3 Accessible indoor routes', () => {
  it('shows accessible route option for indoor navigation', async () => {
    const e2eCalendarUrl = process.env.EXPO_PUBLIC_E2E_CALENDAR_MODE;
    const pause = (ms = 600) => new Promise((resolve) => setTimeout(resolve, ms));
    const fastPause = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));
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
    try {
      await waitFor(element(by.id('get-started')))
        .toBeVisible()
        .withTimeout(15000);
      await element(by.id('get-started')).tap();
    } catch {}
    await fastPause();
    await waitFor(element(by.id('map-screen')))
      .toBeVisible()
      .withTimeout(20000);
    doneLaunch();
    await fastPause();

    const doneCalendar = step('Ensure Classes calendar is connected');
    try {
      await waitFor(element(by.id('classes-calendar-required')))
        .toBeVisible()
        .withTimeout(2000);
      if (!e2eCalendarUrl) {
        throw new Error('EXPO_PUBLIC_E2E_CALENDAR_MODE is not set for e2e calendar connect.');
      }
      await element(by.id('calendar-required-connect')).tap();
      await fastPause();
      await waitFor(element(by.id('calendar-link-input')))
        .toBeVisible()
        .withTimeout(10000);
      await element(by.id('calendar-link-input')).replaceText(e2eCalendarUrl);
      await fastPause();
      await element(by.id('calendar-connect-button')).tap();
      await fastPause();
      await waitFor(element(by.label('Close')))
        .toBeVisible()
        .withTimeout(10000);
      await element(by.label('Close')).tap();
      await fastPause();
    } catch {}
    doneCalendar();
    await fastPause();

    const doneMapReady = step('Wait for map to be visible');
    await waitFor(element(by.id('campus-map')))
      .toBeVisible()
      .withTimeout(20000);
    doneMapReady();
    await fastPause();

    const doneLocation = step('Set location near Webster Library');
    await device.setLocation(45.495, -73.58);
    await pause(800);
    doneLocation();
    await fastPause();

    const doneSearch = step('Search for room H-838');
    await element(by.id('map-search-input')).tap();
    await fastPause();
    await element(by.id('map-search-input')).replaceText('H-838');
    await fastPause();
    await waitFor(element(by.id('map-search-results')))
      .toBeVisible()
      .withTimeout(15000);
    await waitFor(element(by.id('search-result-0')))
      .toBeVisible()
      .withTimeout(15000);
    await element(by.id('search-result-0')).tap();
    doneSearch();
    await fastPause();

    const doneNavigate = step('Open indoor navigation');
    await waitFor(element(by.id('room-info-bubble')))
      .toBeVisible()
      .withTimeout(15000);
    await expect(element(by.text('Navigate here'))).toBeVisible();
    await element(by.text('Navigate here')).tap();
    await pause(1200);
    doneNavigate();
    await pause();

    const doneFloor = step('Select floor if prompted');
    try {
      await waitFor(element(by.id('floor-select-modal')))
        .toBeVisible()
        .withTimeout(4000);
      const floorCandidates = ['8', '1', '2', 'G', '0', '-1'];
      let selected = false;
      for (const level of floorCandidates) {
        try {
          await element(by.id(`floor-select-${level}`)).tap();
          selected = true;
          break;
        } catch {}
      }
      if (!selected) {
        await element(by.text('Floor 1')).tap();
      }
      await pause(800);
    } catch {}
    doneFloor();
    await pause();

    const doneRoomDetected = step('Confirm start room if prompted');
    try {
      await waitFor(element(by.text('Yes')))
        .toBeVisible()
        .withTimeout(4000);
      await element(by.text('Yes')).tap();
      await pause(800);
    } catch {}
    doneRoomDetected();
    await pause();

    const doneScroll = step('Scroll navigation steps');
    await waitFor(element(by.id('navigation-steps-scroll')))
      .toBeVisible()
      .withTimeout(15000);
    await element(by.id('navigation-steps-scroll')).scroll(250, 'down');
    await pause(600);
    doneScroll();
    await pause();

    const doneAccessible = step('Enable accessible route');
    await waitFor(element(by.id('accessible-route-toggle')))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.id('accessible-route-toggle')).tap();
    await pause(800);
    doneAccessible();

    await pause(2000);
    await device.sendToHome();
  });
});
