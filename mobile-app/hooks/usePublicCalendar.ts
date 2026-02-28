import { useEffect, useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const CALENDAR_ID_KEY = 'public_calendar_id';
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

type UsePublicCalendarReturn = {
  /** Connect a calendar by URL or ID */
  connectCalendar: (input: string) => Promise<void>;
  /** Disconnect the saved calendar */
  disconnect: () => Promise<void>;
  /** Re-fetch events */
  refreshEvents: () => Promise<void>;
  /** Whether a calendar is connected */
  isConnected: boolean;
  /** The stored calendar ID */
  calendarId: string | null;
  /** Upcoming events from the public calendar */
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
 * Extract a Google Calendar ID from a public calendar URL.
 * Supported formats:
 *  - https://calendar.google.com/calendar/embed?src=CALENDAR_ID
 *  - https://calendar.google.com/calendar/ical/CALENDAR_ID/public/basic.ics
 *  - https://calendar.google.com/calendar/u/0?cid=CALENDAR_ID
 *
 * Raw email addresses / calendar IDs are NOT accepted — the user must paste a URL.
 */
export function extractCalendarId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);

    // Only allow Google Calendar URLs
    if (!url.hostname.endsWith('calendar.google.com') && !url.hostname.endsWith('google.com')) {
      return null;
    }

    // Try "src" query param (embed URL)
    const src = url.searchParams.get('src');
    if (src) return decodeURIComponent(src);

    // Try ical URL format: /calendar/ical/{ID}/public/basic.ics
    const icalMatch = url.pathname.match(/\/calendar\/ical\/([^/]+)\//);
    if (icalMatch) return decodeURIComponent(icalMatch[1]);

    // Try "cid" query param
    const cid = url.searchParams.get('cid');
    if (cid) return decodeURIComponent(cid);

    return null;
  } catch {
    // Not a valid URL
    return null;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function usePublicCalendar(): UsePublicCalendarReturn {
  const [calendarId, setCalendarId] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --------------------------------------------------
  // Fetch upcoming events from a public calendar
  // --------------------------------------------------
  const fetchEvents = useCallback(async (id: string) => {
    if (!API_KEY) {
      setError('Google API key is not configured.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const now = new Date().toISOString();
      const encodedId = encodeURIComponent(id);
      const url =
        `https://www.googleapis.com/calendar/v3/calendars/${encodedId}/events` +
        `?key=${API_KEY}` +
        `&timeMin=${now}` +
        `&maxResults=20` +
        `&singleEvents=true` +
        `&orderBy=startTime`;

      const { data } = await axios.get<{ items?: CalendarEvent[] }>(url);
      setEvents(data.items ?? []);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404) {
        setError('Calendar not found. Make sure it exists and is shared publicly.');
      } else if (status === 403) {
        setError(
          'Cannot access this calendar. Make sure it is set to "Make available to public" in Google Calendar settings.',
        );
      } else {
        setError('Failed to fetch events. Please check the calendar link and try again.');
      }
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const connectCalendar = useCallback(
    async (input: string) => {
      const id = extractCalendarId(input);
      if (!id) {
        setError('Please paste a valid Google Calendar URL (not an email address).');
        return;
      }

      // Save the ID
      await SecureStore.setItemAsync(CALENDAR_ID_KEY, id);
      setCalendarId(id);
      await fetchEvents(id);
    },
    [fetchEvents],
  );

  // --------------------------------------------------
  // Disconnect
  // --------------------------------------------------
  const disconnect = useCallback(async () => {
    await SecureStore.deleteItemAsync(CALENDAR_ID_KEY);
    setCalendarId(null);
    setEvents([]);
    setError(null);
  }, []);

  // --------------------------------------------------
  // Refresh
  // --------------------------------------------------
  const refreshEvents = useCallback(async () => {
    if (!calendarId) return;
    await fetchEvents(calendarId);
  }, [calendarId, fetchEvents]);

  // --------------------------------------------------
  // Restore saved calendar on mount
  // --------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const savedId = await SecureStore.getItemAsync(CALENDAR_ID_KEY);
      if (cancelled || !savedId) return;
      setCalendarId(savedId);
      await fetchEvents(savedId);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return {
    connectCalendar,
    disconnect,
    refreshEvents,
    isConnected: !!calendarId,
    calendarId,
    events,
    loading,
    error,
  };
}
