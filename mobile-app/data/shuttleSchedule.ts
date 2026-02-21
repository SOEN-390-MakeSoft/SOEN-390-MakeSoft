// Concordia University Shuttle Bus Schedule
// Source: https://www.concordia.ca/about/shuttle.html
// Shuttle stops:
//   SGW  – 1455 De Maisonneuve Blvd W (near Hall Building main entrance)
//   Loyola – 7141 Sherbrooke St W (near the central Loyola campus stop)
// Ride duration: ~30 minutes between campuses

export type ShuttleStop = "SGW" | "Loyola";

export type ShuttleDeparture = {
    /** "HH:MM" in 24-hour format */
    time: string;
    from: ShuttleStop;
};

// Monday – Friday schedule
const WEEKDAY_DEPARTURES: ShuttleDeparture[] = [
    { time: "08:30", from: "SGW" },
    { time: "09:00", from: "Loyola" },
    { time: "09:30", from: "SGW" },
    { time: "10:00", from: "Loyola" },
    { time: "10:30", from: "SGW" },
    { time: "11:00", from: "Loyola" },
    { time: "11:30", from: "SGW" },
    { time: "12:00", from: "Loyola" },
    { time: "12:30", from: "SGW" },
    { time: "13:00", from: "Loyola" },
    { time: "13:30", from: "SGW" },
    { time: "14:00", from: "Loyola" },
    { time: "14:30", from: "SGW" },
    { time: "15:00", from: "Loyola" },
    { time: "15:30", from: "SGW" },
    { time: "16:00", from: "Loyola" },
    { time: "16:30", from: "SGW" },
    { time: "17:00", from: "Loyola" },
    { time: "17:30", from: "SGW" },
    { time: "18:00", from: "Loyola" },
    { time: "18:30", from: "SGW" },
    { time: "19:00", from: "Loyola" },
    { time: "19:30", from: "SGW" },
    { time: "20:00", from: "Loyola" },
    { time: "20:30", from: "SGW" },
    { time: "21:00", from: "Loyola" },
    { time: "21:30", from: "SGW" },
    { time: "22:00", from: "Loyola" },
    { time: "22:30", from: "SGW" },
    { time: "23:00", from: "Loyola" },
];

// Saturday schedule (reduced)
const SATURDAY_DEPARTURES: ShuttleDeparture[] = [
    { time: "09:30", from: "SGW" },
    { time: "10:00", from: "Loyola" },
    { time: "11:00", from: "SGW" },
    { time: "12:00", from: "Loyola" },
    { time: "13:00", from: "SGW" },
    { time: "14:00", from: "Loyola" },
    { time: "15:00", from: "SGW" },
    { time: "16:00", from: "Loyola" },
    { time: "17:00", from: "SGW" },
    { time: "18:00", from: "Loyola" },
];

// No service on Sundays
const SUNDAY_DEPARTURES: ShuttleDeparture[] = [];

/** Returns today's shuttle schedule based on the day of week. */
export function getTodaySchedule(): ShuttleDeparture[] {
    const day = new Date().getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    if (day === 0) return SUNDAY_DEPARTURES;
    if (day === 6) return SATURDAY_DEPARTURES;
    return WEEKDAY_DEPARTURES;
}

/**
 * Converts a "HH:MM" string to total minutes since midnight.
 */
export function timeToMinutes(time: string): number {
    const [h, m] = time.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * Converts total minutes since midnight to a "HH:MM" string.
 */
export function minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Formats a "HH:MM" 24h string into a human-readable "H:MM AM/PM" string.
 */
export function formatTime(time: string): string {
    const [h, m] = time.split(":").map(Number);
    const hour = h ?? 0;
    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${displayHour}:${String(m ?? 0).padStart(2, "0")} ${period}`;
}

/** Shuttle ride duration in minutes (SGW ↔ Loyola). */
export const SHUTTLE_RIDE_MINUTES = 30;

/**
 * Finds the next shuttle departure from a given stop at or after the given
 * time (in minutes since midnight). Returns null if no more buses today.
 */
export function getNextDeparture(
    from: ShuttleStop,
    currentMinutes: number
): ShuttleDeparture | null {
    const schedule = getTodaySchedule();
    const departures = schedule.filter((d) => d.from === from);
    const next = departures.find((d) => timeToMinutes(d.time) >= currentMinutes);
    return next ?? null;
}
