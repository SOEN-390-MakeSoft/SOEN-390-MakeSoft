const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const logCheck = (label, done) => {
  console.log(`${done ? '☑' : '☐'} ${label}`);
};

describe('US-3.3 Identify next class location', () => {
  it('identifies the next event, maps known buildings, and provides fallback', async () => {
    console.log('\nUS-3.3 E2E — Next class location');

    logCheck('The next upcoming event is identified', false);
    logCheck('Locations are mapped to known buildings when possible', false);
    logCheck('Manual fallback is provided when needed', false);

    try {
      await waitFor(element(by.id('get-started')))
        .toBeVisible()
        .withTimeout(12000);
      await element(by.id('get-started')).tap();
    } catch (error) {
      // Already past the welcome screen.
    }

    await waitFor(element(by.id('classes-calendar-required')))
      .toBeVisible()
      .withTimeout(12000);

    await pause(1600);
    await element(by.id('calendar-required-connect')).tap();

    await waitFor(element(by.id('calendar-modal')))
      .toBeVisible()
      .withTimeout(12000);

    await pause(1600);
    await element(by.id('calendar-link-input')).replaceText(
      'https://calendar.google.com/calendar/ical/mock/basic.ics',
    );
    await pause(1600);
    await element(by.id('calendar-connect-button')).tap();

    await waitFor(element(by.id('calendar-event-row')))
      .toBeVisible()
      .withTimeout(12000);

    await element(by.label('Close')).tap();

    await pause(1600);
    await element(by.id('directions-to-next-class-button')).tap();

    await waitFor(element(by.id('next-class-card')))
      .toBeVisible()
      .withTimeout(12000);

    await waitFor(element(by.text('SOEN 390')))
      .toBeVisible()
      .withTimeout(12000);

    logCheck('The next upcoming event is identified', true);

    await waitFor(element(by.text('Hingston Hall (HB)')))
      .toBeVisible()
      .withTimeout(12000);

    logCheck('Locations are mapped to known buildings when possible', true);

    await element(by.label('Google Calendar')).tap();

    await waitFor(element(by.id('calendar-modal')))
      .toBeVisible()
      .withTimeout(12000);

    await element(by.id('calendar-disconnect-button')).tap();

    await waitFor(element(by.id('calendar-connect-button')))
      .toBeVisible()
      .withTimeout(12000);

    await pause(1600);
    await element(by.id('calendar-link-input')).replaceText(
      'https://calendar.google.com/calendar/ical/mock-unknown/basic.ics',
    );
    await pause(1600);
    await element(by.id('calendar-connect-button')).tap();

    await waitFor(element(by.id('calendar-event-row')))
      .toBeVisible()
      .withTimeout(12000);

    await element(by.label('Close')).tap();

    await pause(1600);
    await element(by.id('directions-to-next-class-button')).tap();

    await waitFor(element(by.id('next-class-card')))
      .toBeVisible()
      .withTimeout(12000);

    await waitFor(element(by.text('Unknown Building 123')))
      .toBeVisible()
      .withTimeout(12000);

    await element(by.text('Go')).tap();

    await waitFor(element(by.text('Unable to open directions')))
      .toBeVisible()
      .withTimeout(12000);

    logCheck('Manual fallback is provided when needed', true);

    try {
      await element(by.text('OK')).tap();
    } catch (error) {
      // Alert button may auto-dismiss in some environments.
    }

    await pause(1500);
  });
});
