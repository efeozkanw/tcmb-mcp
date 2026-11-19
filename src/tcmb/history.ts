import type { TcmbClient } from './client.js';
import { addDays, daysBetween, isWeekend, monthStart, weekStart } from './dates.js';
import { TcmbError } from './errors.js';
import type { Bulletin } from './types.js';

export const INTERVALS = ['daily', 'weekly', 'monthly'] as const;

export type Interval = (typeof INTERVALS)[number];

const LIMITS: Record<Interval, { periods: number; label: string }> = {
  daily: { periods: 92, label: 'days' },
  weekly: { periods: 105, label: 'weeks' },
  monthly: { periods: 120, label: 'months' },
};

const CONCURRENCY = 4;

export async function collectHistory(
  client: TcmbClient,
  startDate: string,
  endDate: string,
  interval: Interval,
): Promise<Bulletin[]> {
  client.assertDate(startDate);
  client.assertDate(endDate);
  if (startDate > endDate) {
    throw new TcmbError(`start_date ${startDate} is after end_date ${endDate}`);
  }
  const periods = splitPeriods(startDate, endDate, interval);
  const limit = LIMITS[interval];
  if (periods.length > limit.periods) {
    throw new TcmbError(
      `A ${interval} history covers at most ${limit.periods} ${limit.label}; this range has ${periods.length}. ` +
        'Use a shorter range or a coarser interval.',
    );
  }
  const found = await mapConcurrently(periods, CONCURRENCY, ([from, to]) =>
    lastBulletinBetween(client, from, to),
  );
  const unique = new Map<string, Bulletin>();
  for (const bulletin of found) {
    if (bulletin) {
      unique.set(bulletin.date, bulletin);
    }
  }
  return [...unique.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function splitPeriods(start: string, end: string, interval: Interval): [string, string][] {
  const periods: [string, string][] = [];
  if (interval === 'daily') {
    for (let day = start; day <= end; day = addDays(day, 1)) {
      if (!isWeekend(day)) {
        periods.push([day, day]);
      }
    }
    return periods;
  }
  let periodStart = interval === 'weekly' ? weekStart(start) : monthStart(start);
  while (periodStart <= end) {
    const next = interval === 'weekly' ? addDays(periodStart, 7) : nextMonth(periodStart);
    const from = periodStart < start ? start : periodStart;
    const lastDay = addDays(next, -1);
    periods.push([from, lastDay > end ? end : lastDay]);
    periodStart = next;
  }
  return periods;
}

async function lastBulletinBetween(
  client: TcmbClient,
  from: string,
  to: string,
): Promise<Bulletin | null> {
  for (let day = to; daysBetween(from, day) >= 0; day = addDays(day, -1)) {
    if (isWeekend(day)) {
      continue;
    }
    const bulletin = await client.bulletinOn(day);
    if (bulletin) {
      return bulletin;
    }
  }
  return null;
}

function nextMonth(date: string): string {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  return month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
}

async function mapConcurrently<T, R>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await task(items[index] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}
