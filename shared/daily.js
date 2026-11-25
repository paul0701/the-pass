// The Daily Service calendar. Pure functions, no imports, so the server and the tests can load it.
// index.html keeps an inline copy of DAYS and LAUNCH (it is a single file with no build step);
// tests/daily.test.js checks the two never drift apart.

// Day #1 of the Daily Service. Change this to the real launch date before going live.
export const LAUNCH = "2026-11-25";

// Difficulty follows the day of the week, using the existing modes as the dial:
//   int  = spawn interval multiplier (lower is busier), same meaning as MODES[].int
//   rush = extra rush chance from The Slam onwards, same as MODES[].rush
//   pan  = how quickly the pan slows when loaded, same as MODES[].pan
//   menu = "main" or "roast" (Sunday)
// Index is the UTC day of the week, 0 = Sunday.
export const DAYS = [
  { short: "Sun", name: "Sunday",    title: "Sunday Roast",   int: 0.95, rush: 0,    pan: 1,    menu: "roast" },
  { short: "Mon", name: "Monday",    title: "Quiet Monday",   int: 1.15, rush: 0,    pan: 0.9,  menu: "main" },
  { short: "Tue", name: "Tuesday",   title: "Tuesday",        int: 1.07, rush: 0,    pan: 1,    menu: "main" },
  { short: "Wed", name: "Wednesday", title: "Midweek",        int: 1,    rush: 0,    pan: 1,    menu: "main" },
  { short: "Thu", name: "Thursday",  title: "Thursday Push",  int: 0.92, rush: 0.03, pan: 1.08, menu: "main" },
  { short: "Fri", name: "Friday",    title: "Friday Night",   int: 0.84, rush: 0.06, pan: 1.15, menu: "main" },
  { short: "Sat", name: "Saturday",  title: "Saturday Slam",  int: 0.76, rush: 0.12, pan: 1.2,  menu: "main" }
];

// Real seconds for a daily service (18:00 to 22:00). Practice keeps the full 330.
export const DAILY_DURATION = 240;

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const todayUtc = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
export const dayIndex = (date) => new Date(date + "T00:00:00Z").getUTCDay();
export const dailyNumber = (date) => Math.round((Date.parse(date + "T00:00:00Z") - Date.parse(LAUNCH + "T00:00:00Z")) / 864e5) + 1;

export function dailyInfo(date) {
  const d = DAYS[dayIndex(date)];
  return { date, number: dailyNumber(date), dow: dayIndex(date), short: d.short, name: d.name, title: d.title };
}

// The day before a YYYY-MM-DD date, for streaks.
export const prevDate = (date) => new Date(Date.parse(date + "T00:00:00Z") - 864e5).toISOString().slice(0, 10);
