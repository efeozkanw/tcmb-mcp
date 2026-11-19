import { TcmbError } from './errors.js';

export const FIRST_BULLETIN_DATE = '1996-04-16';
export const REDENOMINATION_DATE = '2005-01-01';
export const PUBLICATION_MINUTE = 15 * 60 + 30;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TCMB_DATE = /^(\d{2})\.(\d{2})\.(\d{4})$/;
const DAY_MS = 86_400_000;

const istanbulClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Istanbul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

export function addDays(date: string, days: number): string {
  return new Date(toTime(date) + days * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toTime(to) - toTime(from)) / DAY_MS);
}

export function isWeekend(date: string): boolean {
  const day = new Date(toTime(date)).getUTCDay();
  return day === 0 || day === 6;
}

export function weekStart(date: string): string {
  const day = new Date(toTime(date)).getUTCDay();
  return addDays(date, -((day + 6) % 7));
}

export function monthStart(date: string): string {
  return `${date.slice(0, 8)}01`;
}

export function istanbulNow(now: Date): { date: string; minute: number } {
  const parts = Object.fromEntries(
    istanbulClock.formatToParts(now).map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minute: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

export function fromTcmbDate(value: string): string {
  const match = TCMB_DATE.exec(value.trim());
  if (!match) {
    throw new TcmbError(`Unexpected bulletin date "${value}"`);
  }
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

export function archivePath(date: string): string {
  const [year, month, day] = date.split('-');
  return `${year}${month}/${day}${month}${year}.xml`;
}

function toTime(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}
