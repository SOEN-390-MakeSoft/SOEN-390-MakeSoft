const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const logCheck = (label, done) => {
  console.log(`${done ? '☑' : '☐'} ${label}`);
};

describe('US-3.4 Generate directions to next class', () => {
  it('opens next class directions for SOEN 390 (Faubourg FG)', async () => {
    console.log('\nUS-3.4 E2E — Next class directions');

    logCheck('Next class directions show SOEN 390 at Faubourg (FG)', false);

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
      'https://calendar.google.com/calendar/ical/8e4bd319d14b618d72f25e7bc49c1cb67bf8b41f33e59e6bd97dd8ad64dceb42%40group.calendar.google.com/private-f407e9ad39169e5c2888b32df4726b8a/basic.ics',
    );
    await pause(1600);
    await element(by.id('calendar-connect-button')).tap();

    await element(by.label('Close')).tap();

    await pause(1600);
    await element(by.id('directions-to-next-class-button')).tap();

    await waitFor(element(by.id('next-class-card')))
      .toBeVisible()
      .withTimeout(12000);

    await waitFor(element(by.text('SOEN 390')))
      .toBeVisible()
      .withTimeout(12000);

    await element(by.id('next-class-go-button')).tap();

    await waitFor(element(by.id('preview-route-button')))
      .toBeVisible()
      .withTimeout(12000);
    await element(by.id('preview-route-button')).tap();

    logCheck('Next class directions show SOEN 390 at Faubourg (FG)', true);

    await pause(1500);
  });
});
