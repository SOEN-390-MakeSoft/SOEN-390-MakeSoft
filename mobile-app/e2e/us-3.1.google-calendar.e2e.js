const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const logCheck = (label, done) => {
  console.log(`${done ? '☑' : '☐'} ${label}`);
};
const deniedErrorMatcher =
  /Cannot access this calendar|Failed to fetch events|Calendar not found|Google API key is not configured|Could not fetch calendar|Please paste a valid Google Calendar URL/i;

describe('US-3.1 Connect Google Calendar', () => {
  it('connects, reads events, disconnects, and handles permission denied', async () => {
    console.log('\nUS-3.1 E2E — Connect Google Calendar');

    logCheck('User can connect Google Calendar using an authentication flow', false);
    logCheck('App receives permission to read calendar events', false);
    logCheck('User can disconnect their Google Calendar at any time', false);
    logCheck('If permission is denied, the app explains limitations', false);

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
      'https://calendar.google.com/calendar/ical/8e4bd319d14b618d72f25e7bc49c1cb67bf8b41f33e59e6bd97dd8ad64dceb42%40group.calendar.google.com/private-f407e9ad39169e5c2888b32df4726b8a/basic.ics',
    );
    await pause(1200);
    await element(by.id('calendar-connect-button')).tap();

    await waitFor(element(by.id('calendar-disconnect-button')))
      .toBeVisible()
      .withTimeout(10000);

    await waitFor(element(by.text('SOEN 390')))
      .toBeVisible()
      .withTimeout(10000);

    logCheck('User can connect Google Calendar using an authentication flow', true);
    logCheck('App receives permission to read calendar events', true);

    await pause(1200);
    await element(by.id('calendar-disconnect-button')).tap();

    await waitFor(element(by.id('calendar-connect-button')))
      .toBeVisible()
      .withTimeout(8000);

    logCheck('User can disconnect their Google Calendar at any time', true);

    await pause(1200);
    await element(by.id('calendar-link-input')).replaceText(
      'https://calendar.google.com/calendar/ical/denied/public/basic.ics',
    );
    await pause(1200);
    await element(by.id('calendar-connect-button')).tap();

    await waitFor(element(by.id('calendar-error-text')))
      .toBeVisible()
      .withTimeout(8000);
    try {
      const attributes = await element(by.id('calendar-error-text')).getAttributes();
      const errorText = attributes?.text ?? attributes?.label ?? '';
      expect(errorText).toMatch(deniedErrorMatcher);
    } catch (error) {
      const possibleMessages = [
        'Cannot access this calendar. Try using the "Secret address in iCal format" from Google Calendar settings.',
        'Failed to fetch events. Please check the calendar link and try again.',
        'Calendar not found. Make sure it exists and is shared.',
        'Google API key is not configured.',
        'Could not fetch calendar. The secret link may have been reset — try copying a new one.',
        'Please paste a valid Google Calendar URL or secret iCal address.',
      ];
      let matched = false;
      for (const message of possibleMessages) {
        try {
          await waitFor(element(by.text(message)))
            .toBeVisible()
            .withTimeout(1000);
          matched = true;
          break;
        } catch (innerError) {
          // Try next message.
        }
      }
      if (!matched) {
        throw error;
      }
    }

    logCheck('If permission is denied, the app explains limitations', true);

    // Slow down at the end for visibility in recordings.
    await pause(2000);
  });
});
