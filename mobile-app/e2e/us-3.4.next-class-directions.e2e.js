const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const logCheck = (label, done) => {
  console.log(`${done ? '☑' : '☐'} ${label}`);
};

describe('US-3.4 Generate directions to next class', () => {
  it('generates directions, detects arrival, and updates routes when the next class changes', async () => {
    console.log('\nUS-3.4 E2E — Next class directions');

    logCheck('Directions are generated from current location', false);
    logCheck('Arrival is detected when near destination', false);
    logCheck('Routes update if the next class changes', false);

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

    await waitFor(element(by.text('Hingston Hall (HB)')))
      .toBeVisible()
      .withTimeout(12000);

    await element(by.text('Go')).tap();

    await waitFor(element(by.id('nav-step-0')))
      .toBeVisible()
      .withTimeout(12000);

    await waitFor(element(by.id('navigation-start-input')))
      .toHaveText('Your location')
      .withTimeout(12000);

    await waitFor(element(by.id('navigation-destination-input')))
      .toHaveText('Hingston Hall (HB)')
      .withTimeout(12000);

    logCheck('Directions are generated from current location', true);

    await waitFor(element(by.id('arrival-banner')))
      .toExist()
      .withTimeout(12000);

    logCheck('Arrival is detected when near destination', true);

    await element(by.id('navigation-close-button')).tap();

    await pause(1600);
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
      'https://calendar.google.com/calendar/ical/mock-next/basic.ics',
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

    await waitFor(element(by.text('SOEN 391')))
      .toBeVisible()
      .withTimeout(12000);

    await waitFor(element(by.text('Concordia Vanier Library (VL)')))
      .toBeVisible()
      .withTimeout(12000);

    await element(by.text('Go')).tap();

    await waitFor(element(by.id('nav-step-0')))
      .toBeVisible()
      .withTimeout(12000);

    await waitFor(element(by.id('navigation-destination-input')))
      .toHaveText('Concordia Vanier Library (VL)')
      .withTimeout(12000);

    logCheck('Routes update if the next class changes', true);

    await pause(1500);
  });
});
