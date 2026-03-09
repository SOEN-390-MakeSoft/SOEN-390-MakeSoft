const ICAL_URL =
  'https://calendar.google.com/calendar/ical/8e4bd319d14b618d72f25e7bc49c1cb67bf8b41f33e59e6bd97dd8ad64dceb42%40group.calendar.google.com/private-f407e9ad39169e5c2888b32df4726b8a/basic.ics';
const FAST_MAP_TIMEOUT_MS = 3000;
const FAST_GET_STARTED_TIMEOUT_MS = 2000;
const STEP_PAUSE_MS = 800;

function pause(ms = STEP_PAUSE_MS) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('US-3.3 Identify Next Class Location', () => {
  it('identifies the next upcoming event', async () => {
    try {
      await waitFor(element(by.id('map-screen')))
        .toBeVisible()
        .withTimeout(FAST_MAP_TIMEOUT_MS);
    } catch (err) {
      await waitFor(element(by.id('get-started')))
        .toBeVisible()
        .withTimeout(FAST_GET_STARTED_TIMEOUT_MS);
      await element(by.id('get-started')).tap();
      await waitFor(element(by.id('map-screen')))
        .toBeVisible()
        .withTimeout(20000);
    }

    await pause();
    try {
      await waitFor(element(by.id('classes-calendar-required')))
        .toBeVisible()
        .withTimeout(4000);
    } catch (err) {
      await element(by.id('calendar-open-button')).tap();
      await waitFor(element(by.id('calendar-modal')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.id('calendar-disconnect-button')).tap();
      await element(by.label('Close')).tap();
      await waitFor(element(by.id('classes-calendar-required')))
        .toBeVisible()
        .withTimeout(8000);
    }

    await pause();
    await element(by.id('calendar-required-connect')).tap();
    await waitFor(element(by.id('calendar-modal')))
      .toBeVisible()
      .withTimeout(5000);

    await pause();
    await element(by.id('calendar-link-input')).replaceText(ICAL_URL);
    await pause();
    await element(by.id('calendar-connect-button')).tap();

    await waitFor(element(by.id('calendar-events-list')))
      .toBeVisible()
      .withTimeout(20000);
    await waitFor(element(by.id('calendar-event-name')).atIndex(0))
      .toBeVisible()
      .withTimeout(10000);
    const firstEventAttrs = await element(by.id('calendar-event-name')).atIndex(0).getAttributes();
    const firstEventName =
      (firstEventAttrs && (firstEventAttrs.text || firstEventAttrs.label)) || null;
    await pause();
    await element(by.label('Close')).tap();

    await waitFor(element(by.id('classes-calendar-required')))
      .toBeNotVisible()
      .withTimeout(8000);
    await waitFor(element(by.id('next-class-info-button')))
      .toBeVisible()
      .withTimeout(15000);
    await pause();
    await element(by.id('next-class-info-button')).tap();

    await waitFor(element(by.text('Next Class')))
      .toBeVisible()
      .withTimeout(10000);
    if (firstEventName) {
      await waitFor(element(by.text(firstEventName)))
        .toBeVisible()
        .withTimeout(10000);
    }
  });
});
