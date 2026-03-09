import {
  getNextEvent,
  getNextClassForToday,
  extractCalendarInfo,
  CalendarEvent,
} from '../hooks/usePublicCalendar';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal timed CalendarEvent. start/end are ISO strings. */
function makeEvent(
  id: string,
  summary: string,
  startIso: string,
  endIso: string,
  overrides: Partial<CalendarEvent> = {},
): CalendarEvent {
  return {
    id,
    summary,
    start: { dateTime: startIso },
    end: { dateTime: endIso },
    ...overrides,
  };
}

/** Build an all-day CalendarEvent (only start.date / end.date, no dateTime). */
function makeAllDayEvent(id: string, summary: string, date: string): CalendarEvent {
  return {
    id,
    summary,
    start: { date },
    end: { date },
  };
}

/**
 * Return an ISO string that is `offsetMs` milliseconds from now.
 * Positive  = future, negative = past.
 */
function fromNow(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

const MIN = 60_000;
const HOUR = 60 * MIN;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getNextEvent', () => {
  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------
  describe('edge cases', () => {
    it('returns null for an empty array', () => {
      expect(getNextEvent([])).toBeNull();
    });

    it('returns null when all events are in the past', () => {
      const events = [
        makeEvent('1', 'Past Class', fromNow(-2 * HOUR), fromNow(-1 * HOUR)),
        makeEvent('2', 'Older Past Class', fromNow(-4 * HOUR), fromNow(-3 * HOUR)),
      ];
      expect(getNextEvent(events)).toBeNull();
    });

    it('returns null when the only events are all-day events', () => {
      const events = [
        makeAllDayEvent('1', 'All Day Event', '2026-03-03'),
        makeAllDayEvent('2', 'Another All Day', '2026-03-04'),
      ];
      expect(getNextEvent(events)).toBeNull();
    });

    it('returns null when all timed events are in the past', () => {
      const events = [
        makeEvent('1', 'Past Class', fromNow(-2 * HOUR), fromNow(-1 * HOUR)),
        makeAllDayEvent('2', 'All Day Event', '2026-03-03'),
      ];
      expect(getNextEvent(events)).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // All-day event filtering
  // -------------------------------------------------------------------------
  describe('all-day event filtering', () => {
    it('skips all-day events and returns the next timed event instead', () => {
      const timed = makeEvent('timed', 'SOEN 343 LEC', fromNow(1 * HOUR), fromNow(2 * HOUR));
      const allDay = makeAllDayEvent('allday', 'Reading Week', '2026-03-03');
      expect(getNextEvent([allDay, timed])).toEqual(timed);
    });

    it('skips all-day events even when they appear before the timed event in the array', () => {
      const timed = makeEvent('t1', 'COMP 346 LEC', fromNow(30 * MIN), fromNow(90 * MIN));
      const events = [
        makeAllDayEvent('a1', 'Holiday', '2026-03-03'),
        makeAllDayEvent('a2', 'Another Holiday', '2026-03-04'),
        timed,
      ];
      expect(getNextEvent(events)).toEqual(timed);
    });
  });

  // -------------------------------------------------------------------------
  // In-progress events
  // -------------------------------------------------------------------------
  describe('in-progress events', () => {
    it('returns a single in-progress event', () => {
      const inProgress = makeEvent('1', 'SOEN 343 LEC', fromNow(-30 * MIN), fromNow(30 * MIN));
      expect(getNextEvent([inProgress])).toEqual(inProgress);
    });

    it('prefers an in-progress event over an upcoming one', () => {
      const inProgress = makeEvent('1', 'SOEN 343 LEC', fromNow(-30 * MIN), fromNow(30 * MIN));
      const upcoming = makeEvent('2', 'COMP 346 LEC', fromNow(2 * HOUR), fromNow(3 * HOUR));
      expect(getNextEvent([upcoming, inProgress])).toEqual(inProgress);
    });

    it('returns the most recently started when multiple events are in progress', () => {
      const startedFirst = makeEvent('1', 'Lecture A', fromNow(-90 * MIN), fromNow(30 * MIN));
      const startedLast = makeEvent('2', 'Lecture B', fromNow(-15 * MIN), fromNow(45 * MIN));
      expect(getNextEvent([startedFirst, startedLast])).toEqual(startedLast);
    });

    it('ignores in-progress all-day events', () => {
      // An all-day event whose date is today counts as "in progress" by date math
      // but should still be excluded because it has no dateTime
      const allDay = makeAllDayEvent('a1', 'All Day', '2026-03-03');
      const upcoming = makeEvent('t1', 'Next Class', fromNow(1 * HOUR), fromNow(2 * HOUR));
      expect(getNextEvent([allDay, upcoming])).toEqual(upcoming);
    });
  });

  // -------------------------------------------------------------------------
  // Upcoming events
  // -------------------------------------------------------------------------
  describe('upcoming events', () => {
    it('returns the single upcoming event', () => {
      const upcoming = makeEvent('1', 'SOEN 343 LEC', fromNow(1 * HOUR), fromNow(2 * HOUR));
      expect(getNextEvent([upcoming])).toEqual(upcoming);
    });

    it('returns the earliest upcoming event when multiple exist', () => {
      const later = makeEvent('2', 'COMP 346 LEC', fromNow(3 * HOUR), fromNow(4 * HOUR));
      const sooner = makeEvent('1', 'SOEN 343 LEC', fromNow(1 * HOUR), fromNow(2 * HOUR));
      expect(getNextEvent([later, sooner])).toEqual(sooner);
    });

    it('returns the earliest upcoming event from a larger mixed list', () => {
      const events = [
        makeEvent('past', 'Old Class', fromNow(-3 * HOUR), fromNow(-2 * HOUR)),
        makeEvent('far', 'Far Future', fromNow(5 * HOUR), fromNow(6 * HOUR)),
        makeEvent('next', 'Next Class', fromNow(1 * HOUR), fromNow(2 * HOUR)),
        makeEvent('mid', 'Mid Future', fromNow(3 * HOUR), fromNow(4 * HOUR)),
      ];
      expect(getNextEvent(events)?.id).toBe('next');
    });
  });

  // -------------------------------------------------------------------------
  // Full event details are preserved
  // -------------------------------------------------------------------------
  describe('event details are preserved', () => {
    it('returns all fields of the matched event intact', () => {
      const event = makeEvent('abc123', 'SOEN 343 LEC', fromNow(1 * HOUR), fromNow(2 * HOUR), {
        description: 'Software Architecture',
        location: 'Hall Building Rm 535',
        htmlLink: 'https://calendar.google.com/event?eid=abc123',
      });
      const result = getNextEvent([event]);
      expect(result).toEqual(event);
      expect(result?.description).toBe('Software Architecture');
      expect(result?.location).toBe('Hall Building Rm 535');
      expect(result?.htmlLink).toBe('https://calendar.google.com/event?eid=abc123');
    });
  });
});

describe('getNextClassForToday', () => {
  const baseNow = new Date('2026-03-07T15:00:00.000Z');

  const makeTodayAt = (hour: number, minute: number) => {
    const d = new Date(baseNow);
    d.setUTCHours(hour, minute, 0, 0);
    return d.toISOString();
  };

  it('returns no_classes_today when there are no events today', () => {
    const tomorrowStart = new Date(baseNow);
    tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);
    tomorrowStart.setUTCHours(13, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrowStart.getTime() + HOUR);

    const result = getNextClassForToday(
      [makeEvent('tmw', 'Tomorrow Class', tomorrowStart.toISOString(), tomorrowEnd.toISOString())],
      baseNow,
    );

    expect(result).toEqual({ status: 'no_classes_today' });
  });

  it('returns next_class when a class later today exists', () => {
    const result = getNextClassForToday(
      [makeEvent('later', 'Later Class', makeTodayAt(18, 0), makeTodayAt(19, 0))],
      baseNow,
    );

    expect(result.status).toBe('next_class');
    if (result.status === 'next_class') {
      expect(result.event.id).toBe('later');
    }
  });

  it('returns classes_over_today when all today classes have ended', () => {
    const result = getNextClassForToday(
      [makeEvent('done', 'Morning Class', makeTodayAt(8, 0), makeTodayAt(10, 0))],
      baseNow,
    );

    expect(result).toEqual({ status: 'classes_over_today' });
  });

  it('returns no_classes_today for an empty events array', () => {
    expect(getNextClassForToday([], baseNow)).toEqual({ status: 'no_classes_today' });
  });

  it('skips all-day events and returns no_classes_today when only all-day events exist today', () => {
    const allDay = makeAllDayEvent('a1', 'Holiday', '2026-03-07');
    expect(getNextClassForToday([allDay], baseNow)).toEqual({ status: 'no_classes_today' });
  });

  it('returns the in-progress class when one is currently running', () => {
    // baseNow = 15:00 UTC; event runs 14:00–16:00
    const inProgress = makeEvent('ip', 'Running Class', makeTodayAt(14, 0), makeTodayAt(16, 0));
    const result = getNextClassForToday([inProgress], baseNow);
    expect(result.status).toBe('next_class');
    if (result.status === 'next_class') expect(result.event.id).toBe('ip');
  });

  it('prefers an in-progress class over an upcoming one today', () => {
    const inProgress = makeEvent('ip', 'Running Class', makeTodayAt(14, 0), makeTodayAt(16, 0));
    const upcoming = makeEvent('up', 'Later Class', makeTodayAt(17, 0), makeTodayAt(18, 0));
    const result = getNextClassForToday([upcoming, inProgress], baseNow);
    expect(result.status).toBe('next_class');
    if (result.status === 'next_class') expect(result.event.id).toBe('ip');
  });

  it('returns the earliest upcoming class when multiple classes are later today', () => {
    const sooner = makeEvent('s', 'Sooner Class', makeTodayAt(16, 0), makeTodayAt(17, 0));
    const later = makeEvent('l', 'Later Class', makeTodayAt(18, 0), makeTodayAt(19, 0));
    const result = getNextClassForToday([later, sooner], baseNow);
    expect(result.status).toBe('next_class');
    if (result.status === 'next_class') expect(result.event.id).toBe('s');
  });

  it('returns classes_over_today when multiple classes existed today but all ended', () => {
    const events = [
      makeEvent('a', 'Class A', makeTodayAt(8, 0), makeTodayAt(9, 30)),
      makeEvent('b', 'Class B', makeTodayAt(10, 0), makeTodayAt(11, 30)),
    ];
    expect(getNextClassForToday(events, baseNow)).toEqual({ status: 'classes_over_today' });
  });
});

// ---------------------------------------------------------------------------
// extractCalendarInfo
// ---------------------------------------------------------------------------

describe('extractCalendarInfo', () => {
  // Invalid / empty inputs

  it('returns null for an empty string', () => {
    expect(extractCalendarInfo('')).toBeNull();
  });

  it('returns null for a whitespace-only string', () => {
    expect(extractCalendarInfo('   ')).toBeNull();
  });

  it('returns null for a plain email address', () => {
    expect(extractCalendarInfo('user@example.com')).toBeNull();
  });

  it('returns null for a non-Google URL', () => {
    expect(extractCalendarInfo('https://outlook.com/calendar/abc')).toBeNull();
  });

  it('returns null for a Google URL with no recognisable calendar info', () => {
    expect(extractCalendarInfo('https://calendar.google.com/')).toBeNull();
  });

  //Secret iCal URL

  it('detects a secret iCal URL and returns type ical', () => {
    const url =
      'https://calendar.google.com/calendar/ical/user%40gmail.com/private-abc123/basic.ics';
    const result = extractCalendarInfo(url);
    expect(result).toEqual({ type: 'ical', icalUrl: url });
  });

  it('trims whitespace before parsing a secret iCal URL', () => {
    const url =
      '  https://calendar.google.com/calendar/ical/user%40gmail.com/private-abc123/basic.ics  ';
    const result = extractCalendarInfo(url);
    expect(result?.type).toBe('ical');
  });

  // Public iCal URL

  it('detects a public iCal URL and returns type public with decoded calendarId', () => {
    const url = 'https://calendar.google.com/calendar/ical/user%40gmail.com/public/basic.ics';
    const result = extractCalendarInfo(url);
    expect(result).toEqual({ type: 'public', calendarId: 'user@gmail.com' });
  });

  //  Embed URL (src param)

  it('detects an embed URL via src param and returns type public', () => {
    const url =
      'https://calendar.google.com/calendar/embed?src=user%40gmail.com&ctz=America%2FMontreal';
    const result = extractCalendarInfo(url);
    expect(result).toEqual({ type: 'public', calendarId: 'user@gmail.com' });
  });

  //cid URL

  it('detects a cid URL and returns type public', () => {
    const url = 'https://calendar.google.com/calendar/u/0?cid=user%40gmail.com';
    const result = extractCalendarInfo(url);
    expect(result).toEqual({ type: 'public', calendarId: 'user@gmail.com' });
  });
});
