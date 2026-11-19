import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod';
import type { TcmbClient } from '../tcmb/client.js';
import { toNumber } from '../tcmb/decimal.js';
import { collectHistory, INTERVALS } from '../tcmb/history.js';
import {
  currencyCode,
  isoDate,
  jsonResult,
  RATE_PLACES,
  READ_ONLY,
  rateInTry,
  rateType,
} from './shared.js';

export function registerGetHistory(server: McpServer, client: TcmbClient): void {
  server.registerTool(
    'tcmb_get_history',
    {
      title: 'TCMB rate history',
      description:
        'Rate of one currency against TRY over a date range, one point per bulletin. daily covers up to ' +
        '92 days, weekly up to 105 weeks and monthly up to 120 months; weekly and monthly use the last ' +
        'bulletin of each period. Includes first, last, min, max and percentage change.',
      inputSchema: z.object({
        currency: currencyCode.describe('ISO 4217 code, for example USD.'),
        start_date: isoDate.describe('First day of the range, YYYY-MM-DD.'),
        end_date: isoDate.describe('Last day of the range, YYYY-MM-DD.'),
        interval: z.enum(INTERVALS).default('daily'),
        rate_type: rateType.default('forex_buying'),
      }),
      outputSchema: z.object({
        currency: z.string(),
        rate_type: z.string(),
        interval: z.string(),
        points: z.array(z.object({ date: z.string(), rate: z.number() })),
        summary: z
          .object({
            first: z.number(),
            last: z.number(),
            min: z.number(),
            max: z.number(),
            change_percent: z.number(),
          })
          .nullable(),
      }),
      annotations: READ_ONLY,
    },
    async ({ currency, start_date, end_date, interval, rate_type }) => {
      const bulletins = await collectHistory(client, start_date, end_date, interval);
      const points = bulletins
        .filter((bulletin) => bulletin.currencies.has(currency.toUpperCase()))
        .map((bulletin) => ({
          date: bulletin.date,
          rate: toNumber(rateInTry(bulletin, currency, rate_type), RATE_PLACES),
        }));
      return jsonResult({
        currency: currency.toUpperCase(),
        rate_type,
        interval,
        points,
        summary: summarize(points.map((point) => point.rate)),
      });
    },
  );
}

function summarize(values: number[]) {
  const first = values[0];
  const last = values.at(-1);
  if (first === undefined || last === undefined) {
    return null;
  }
  return {
    first,
    last,
    min: Math.min(...values),
    max: Math.max(...values),
    change_percent: Math.round(((last - first) / first) * 10_000) / 100,
  };
}
