const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const logCheck = (label, done) => {
  console.log(`${done ? '☑' : '☐'} ${label}`);
};

describe('US-3.2 Select calendar', () => {
  it('connects a calendar, persists connection, and shows empty state', async () => {
    console.log('\nUS-3.2 E2E — Select calendar');

    logCheck('Calendar connection is saved and reused in future sessions', false);
    logCheck('If no events are available, the app displays a clear and informative message', false);

    try {
      await waitFor(element(by.id('get-started')))
        .toBeVisible()
        .withTimeout(8000);
      await element(by.id('get-started')).tap();
    } catch (error) {
      // Already past the welcome screen.
    }

    await waitFor(element(by.id('classes-calendar-required')))
      .toBeVisible()
      .withTimeout(10000);

    await pause(1200);
    await element(by.id('calendar-required-connect')).tap();

    await waitFor(element(by.id('calendar-modal')))
      .toBeVisible()
      .withTimeout(8000);

    await pause(1200);
    await element(by.id('calendar-link-input')).replaceText(
      'https://calendar.google.com/calendar/ical/mock/basic.ics',
    );
    await pause(1200);
    await element(by.id('calendar-connect-button')).tap();

    await waitFor(element(by.id('calendar-events-list')))
      .toBeVisible()
      .withTimeout(10000);

    await waitFor(element(by.id('calendar-event-row')))
      .toBeVisible()
      .withTimeout(8000);

    await element(by.label('Close')).tap();

    await device.launchApp({ newInstance: true });

    try {
      await waitFor(element(by.id('get-started')))
        .toBeVisible()
        .withTimeout(8000);
      await element(by.id('get-started')).tap();
    } catch (error) {
      // Already past the welcome screen.
    }

    await waitFor(element(by.id('map-screen')))
      .toBeVisible()
      .withTimeout(10000);

    await pause(2000);
    await element(by.label('Google Calendar')).tap();

    await waitFor(element(by.id('calendar-modal')))
      .toBeVisible()
      .withTimeout(8000);

    await waitFor(element(by.id('calendar-disconnect-button')))
      .toBeVisible()
      .withTimeout(8000);

    await waitFor(element(by.id('calendar-events-list')))
      .toBeVisible()
      .withTimeout(8000);

    logCheck('Calendar connection is saved and reused in future sessions', true);

    await element(by.id('calendar-disconnect-button')).tap();
    await waitFor(element(by.id('calendar-connect-button')))
      .toBeVisible()
      .withTimeout(8000);

    await pause(1200);
    await element(by.id('calendar-link-input')).replaceText(
      'https://calendar.google.com/calendar/ical/no-calendars/basic.ics',
    );
    await pause(1200);
    await element(by.id('calendar-connect-button')).tap();

    await waitFor(element(by.id('calendar-empty-state')))
      .toBeVisible()
      .withTimeout(8000);

    logCheck('If no events are available, the app displays a clear and informative message', true);

    await pause(2000);
  });
});
