import { describe, it, expect } from 'vitest';
import { googleCalendarUrl, icsFile } from '../lib/calendar';

const ev = { title: '寄報價, 王小明', details: '公司：範例\n第二行', date: '2026-12-31' };

describe('calendar hand-off', () => {
  it('builds an all-day Google Calendar template link', () => {
    const url = new URL(googleCalendarUrl(ev));
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('text')).toBe('寄報價, 王小明');
    expect(url.searchParams.get('dates')).toBe('20261231/20270101');
  });

  it('builds a valid all-day ICS event with escaped text', () => {
    const ics = icsFile(ev, 'abc', new Date('2026-10-01T08:00:00Z'));
    expect(ics).toContain('DTSTART;VALUE=DATE:20261231\r\n');
    expect(ics).toContain('DTEND;VALUE=DATE:20270101\r\n');
    expect(ics).toContain('SUMMARY:寄報價\\, 王小明\r\n');
    expect(ics).toContain('DESCRIPTION:公司：範例\\n第二行\r\n');
    expect(ics).toContain('DTSTAMP:20261001T080000Z');
  });
});
