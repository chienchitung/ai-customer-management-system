import { addDays } from './dates';

// Calendar hand-off for a next action: a Google Calendar template link and an
// .ics file (Outlook / Apple Calendar). Neither needs extra OAuth permissions.

export interface CalendarEvent {
  title: string;
  details: string;
  /** All-day event date, 'YYYY-MM-DD'. */
  date: string;
}

const compact = (iso: string) => iso.replace(/-/g, '');

export const googleCalendarUrl = (e: CalendarEvent) => {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    details: e.details,
    dates: `${compact(e.date)}/${compact(addDays(e.date, 1))}`, // all-day: end date is exclusive
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

/** RFC 5545 text escaping. */
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

export const icsFile = (e: CalendarEvent, uid: string, now = new Date()) => {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pulse CRM//Next action//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}@pulse-crm`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compact(e.date)}`,
    `DTEND;VALUE=DATE:${compact(addDays(e.date, 1))}`,
    `SUMMARY:${esc(e.title)}`,
    `DESCRIPTION:${esc(e.details)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
};
