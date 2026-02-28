import { useEffect, useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import ICAL from 'ical.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STORE_KEY = 'calendar_connection';
const LEGACY_KEY = 'public_calendar_id';
const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type CalendarEvent = {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  htmlLink?: string;
};

/** Discriminated union returned by {@link extractCalendarInfo}. */
export type CalendarInfo =
  | { type: 'public'; calendarId: string }
  | { type: 'ical'; icalUrl: string };

type UsePublicCalendarReturn = {
  /** Connect a calendar by URL */
  connectCalendar: (input: string) => Promise<void>;
  /** Disconnect the saved calendar */
  disconnect: () => Promise<void>;
  /** Re-fetch events */
  refreshEvents: () => Promise<void>;
  /** Whether a calendar is connected */
  isConnected: boolean;
  /** The stored calendar ID (public) or iCal URL */
  calendarId: string | null;
  /** Upcoming events */
  events: CalendarEvent[];
  /** Whether a fetch is in progress */
  loading: boolean;
  /** Last error message, if any */
  error: string | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Detect the type of Google Calendar URL and extract the relevant info.
 *
 * Supported formats:
 *  - Public embed:  https://calendar.google.com/calendar/embed?src=CALENDAR_ID
 *  - Public iCal:   https://calendar.google.com/calendar/ical/CALENDAR_ID/public/basic.ics
 *  - cid link:      https://calendar.google.com/calendar/u/0?cid=CALENDAR_ID
 *  - **Secret iCal**: https://calendar.google.com/calendar/ical/CALENDAR_ID/private-SECRET/basic.ics
 *
 * Raw email addresses / calendar IDs are NOT accepted — the user must paste a URL.
 */
export function extractCalendarInfo(input: string): CalendarInfo | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);

    // Only allow Google Calendar URLs
    if (!url.hostname.endsWith('calendar.google.com') && !url.hostname.endsWith('google.com')) {
      return null;
    }

    // Secret iCal URL: /calendar/ical/{ID}/private-{secret}/basic.ics
    const secretIcalMatch = url.pathname.match(/\/calendar\/ical\/[^/]+\/private-[^/]+\//);
    if (secretIcalMatch) {
      return { type: 'ical', icalUrl: trimmed };
    }

    // Public iCal URL: /calendar/ical/{ID}/public/basic.ics
    const publicIcalMatch = url.pathname.match(/\/calendar\/ical\/([^/]+)\/public\//);
    if (publicIcalMatch) {
      return { type: 'public', calendarId: decodeURIComponent(publicIcalMatch[1]) };
    }

    // Try "src" query param (embed URL)
    const src = url.searchParams.get('src');
    if (src) return { type: 'public', calendarId: decodeURIComponent(src) };

    // Try "cid" query param
    const cid = url.searchParams.get('cid');
    if (cid) return { type: 'public', calendarId: decodeURIComponent(cid) };

    return null;
  } catch {
    // Not a valid URL
    return null;
  }
}

/**
 * @deprecated Use {@link extractCalendarInfo} instead.
 * Kept for backward compatibility — returns just the calendar ID string.
 */
export function extractCalendarId(input: string): string | null {
  const info = extractCalendarInfo(input);
  if (!info) return null;
  return info.type === 'public' ? info.calendarId : info.icalUrl;
}

// ---------------------------------------------------------------------------
// iCal feed parser
// ---------------------------------------------------------------------------

/**
 * Fetch a `.ics` feed (e.g. the secret iCal address) and convert it to
 * an array of {@link CalendarEvent} objects, filtered to upcoming events.
 */
export async function fetchICalEvents(icalUrl: string): Promise<CalendarEvent[]> {
  const { data: icsText } = await axios.get<string>(icalUrl, {
    responseType: 'text' as const,
  });

  const jcalData = ICAL.parse(icsText);
  const comp = new ICAL.Component(jcalData);
  const vevents = comp.getAllSubcomponents('vevent');

  const now = new Date();
  const events: CalendarEvent[] = [];

  for (const vevent of vevents) {
    const event = new ICAL.Event(vevent);

    const dtstart = event.startDate;
    const dtend = event.endDate;
    if (!dtstart) continue;

    const jsStart = dtstart.toJSDate();
    const jsEnd = dtend ? dtend.toJSDate() : jsStart;

    // Only include upcoming events (end is in the future)
    if (jsEnd < now) continue;

    const isAllDay = dtstart.isDate;

    events.push({
      id: event.uid ?? `${jsStart.getTime()}`,
      summary: event.summary ?? '(No title)',
      description: event.description ?? undefined,
      location: event.location ?? undefined,
      start: isAllDay ? { date: dtstart.toString() } : { dateTime: jsStart.toISOString() },
      end: isAllDay
        ? { date: dtend ? dtend.toString() : dtstart.toString() }
        : { dateTime: jsEnd.toISOString() },
    });
  }

  // Sort by start time ascending and return all upcoming events (generous limit for dev)
  events.sort((a, b) => {
    const aTime = new Date(a.start.dateTime ?? a.start.date ?? '').getTime();
    const bTime = new Date(b.start.dateTime ?? b.start.date ?? '').getTime();
    return aTime - bTime;
  });

  return events.slice(0, 250);
}

// ---------------------------------------------------------------------------
// SecureStore helpers — persist connection info as JSON
// ---------------------------------------------------------------------------
type StoredConnection = { type: 'public'; calendarId: string } | { type: 'ical'; icalUrl: string };

async function saveConnection(conn: StoredConnection): Promise<void> {
  await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(conn));
}

async function loadConnection(): Promise<StoredConnection | null> {
  const raw = await SecureStore.getItemAsync(STORE_KEY);
  if (!raw) {
    // Migrate legacy key (plain calendar ID string)
    const legacy = await SecureStore.getItemAsync(LEGACY_KEY);
    if (legacy) {
      const conn: StoredConnection = { type: 'public', calendarId: legacy };
      await saveConnection(conn);
      await SecureStore.deleteItemAsync(LEGACY_KEY);
      return conn;
    }
    return null;
  }
  try {
    return JSON.parse(raw) as StoredConnection;
  } catch {
    return null;
  }
}

async function clearConnection(): Promise<void> {
  await SecureStore.deleteItemAsync(STORE_KEY);
  await SecureStore.deleteItemAsync(LEGACY_KEY);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function usePublicCalendar(): UsePublicCalendarReturn {
  const [calendarId, setCalendarId] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<StoredConnection | null>(null);

  // --------------------------------------------------
  // Fetch events using the Google REST API (public)
  // --------------------------------------------------
  const fetchPublicEvents = useCallback(async (id: string) => {
    if (!API_KEY) {
      setError('Google API key is not configured.');
      return;
    }

    const now = new Date().toISOString();
    const encodedId = encodeURIComponent(id);
    const url =
      `https://www.googleapis.com/calendar/v3/calendars/${encodedId}/events` +
      `?key=${API_KEY}` +
      `&timeMin=${now}` +
      `&maxResults=250` +
      `&singleEvents=true` +
      `&orderBy=startTime`;

    const { data } = await axios.get<{ items?: CalendarEvent[] }>(url);
    setEvents(data.items ?? []);
  }, []);

  // --------------------------------------------------
  // Fetch events from an iCal (.ics) feed (secret URL)
  // --------------------------------------------------
  const fetchICalEventsFromUrl = useCallback(async (icalUrl: string) => {
    const parsed = await fetchICalEvents(icalUrl);
    setEvents(parsed);
  }, []);

  // --------------------------------------------------
  // Unified fetch dispatcher
  // --------------------------------------------------
  const fetchForConnection = useCallback(
    async (conn: StoredConnection) => {
      setLoading(true);
      setError(null);
      try {
        if (conn.type === 'public') {
          await fetchPublicEvents(conn.calendarId);
        } else {
          await fetchICalEventsFromUrl(conn.icalUrl);
        }
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 404) {
          setError(
            conn.type === 'ical'
              ? 'Could not fetch calendar. The secret link may have been reset — try copying a new one.'
              : 'Calendar not found. Make sure it exists and is shared.',
          );
        } else if (status === 403) {
          setError(
            'Cannot access this calendar. Try using the "Secret address in iCal format" from Google Calendar settings.',
          );
        } else {
          setError('Failed to fetch events. Please check the calendar link and try again.');
        }
        setEvents([]);
      } finally {
        setLoading(false);
      }
    },
    [fetchPublicEvents, fetchICalEventsFromUrl],
  );

  // --------------------------------------------------
  // Connect a calendar (save + fetch events)
  // --------------------------------------------------
  const connectCalendar = useCallback(
    async (input: string) => {
      const info = extractCalendarInfo(input);
      if (!info) {
        setError('Please paste a valid Google Calendar URL or secret iCal address.');
        return;
      }

      const conn: StoredConnection =
        info.type === 'ical'
          ? { type: 'ical', icalUrl: info.icalUrl }
          : { type: 'public', calendarId: info.calendarId };

      await saveConnection(conn);
      setConnection(conn);
      setCalendarId(info.type === 'public' ? info.calendarId : info.icalUrl);
      await fetchForConnection(conn);
    },
    [fetchForConnection],
  );

  // --------------------------------------------------
  // Disconnect
  // --------------------------------------------------
  const disconnect = useCallback(async () => {
    await clearConnection();
    setConnection(null);
    setCalendarId(null);
    setEvents([]);
    setError(null);
  }, []);

  // --------------------------------------------------
  // Refresh
  // --------------------------------------------------
  const refreshEvents = useCallback(async () => {
    if (!connection) return;
    await fetchForConnection(connection);
  }, [connection, fetchForConnection]);

  // --------------------------------------------------
  // Restore saved calendar on mount
  // --------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const conn = await loadConnection();
      if (cancelled || !conn) return;
      setConnection(conn);
      setCalendarId(conn.type === 'public' ? conn.calendarId : conn.icalUrl);
      await fetchForConnection(conn);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    connectCalendar,
    disconnect,
    refreshEvents,
    isConnected: !!connection,
    calendarId,
    events,
    loading,
    error,
  };
}
