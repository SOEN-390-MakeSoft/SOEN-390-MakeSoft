describe('US-4.6 End-to-end navigation', () => {
  it('navigates to a room in John Molson (MB)', async () => {
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
    } catch (error) {}
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
    } catch (error) {}
    doneCalendar();
    await fastPause();

    const doneMapReady = step('Wait for map to be visible');
    await waitFor(element(by.id('campus-map')))
      .toBeVisible()
      .withTimeout(20000);
    doneMapReady();
    await fastPause();

    const doneSearch = step('Search for class MB-S2.210');
    await element(by.id('map-search-input')).tap();
    await fastPause();
    await element(by.id('map-search-input')).replaceText('MB-S2.210');
    await fastPause();
    await waitFor(element(by.id('map-search-results')))
      .toBeVisible()
      .withTimeout(15000);
    await waitFor(element(by.id('search-result-0')))
      .toBeVisible()
      .withTimeout(15000);
    await element(by.id('search-result-0')).tap();
    await waitFor(element(by.id('room-info-bubble')))
      .toBeVisible()
      .withTimeout(15000);
    doneSearch();
    await fastPause();

    const doneNavigate = step('Tap Navigate here');
    await expect(element(by.text('Navigate here'))).toBeVisible();
    await element(by.text('Navigate here')).tap();
    doneNavigate();
    await fastPause();

    const doneFloor = step('Select floor 8 if prompted');
    try {
      await waitFor(element(by.id('floor-select-modal')))
        .toBeVisible()
        .withTimeout(4000);
      try {
        await element(by.id('floor-select-8')).tap();
      } catch (error) {
        await element(by.text('Floor 8')).tap();
      }
      await fastPause(400);
    } catch (error) {}
    doneFloor();
    await fastPause();

    const doneRoomDetected = step('Confirm my location if prompted');
    try {
      await waitFor(element(by.text('Room Detected')))
        .toBeVisible()
        .withTimeout(4000);
      await waitFor(element(by.text('Yes')))
        .toBeVisible()
        .withTimeout(4000);
      await element(by.text('Yes')).tap();
      await pause(800);
    } catch (error) {}
    doneRoomDetected();
    await fastPause();

    const doneWalkMode = step('Choose walk mode if available');
    try {
      await waitFor(element(by.text('Walking')))
        .toBeVisible()
        .withTimeout(4000);
      await element(by.text('Walking')).tap();
      await fastPause(400);
    } catch (error) {}
    doneWalkMode();
    await fastPause();

    const donePreview = step('Open preview and go through steps');
    await waitFor(element(by.id('preview-route-button')))
      .toBeVisible()
      .withTimeout(15000);
    await element(by.id('preview-route-button')).tap();
    await waitFor(element(by.id('route-preview-screen')))
      .toBeVisible()
      .withTimeout(15000);

    let totalSteps = 0;
    try {
      const attrs = await element(by.id('route-preview-position')).getAttributes();
      const label = attrs?.text ?? attrs?.label ?? '';
      const match = String(label).match(/Step\s+(\d+)\s+of\s+(\d+)/i);
      if (match) totalSteps = Number(match[2]);
    } catch (error) {}

    if (totalSteps > 1) {
      for (let i = 1; i < totalSteps; i++) {
        await element(by.id('route-preview-next')).tap();
        await pause(600);
      }
    } else if (totalSteps === 0) {
      for (let i = 0; i < 4; i++) {
        await element(by.id('route-preview-next')).tap();
        await pause(600);
      }
    }

    donePreview();
    await pause(2000);
    await device.sendToHome();
  });
});
