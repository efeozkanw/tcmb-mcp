import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod';
import type { TcmbClient } from '../tcmb/client.js';
import { decimalFromNumber, divide, multiply, toNumber } from '../tcmb/decimal.js';
import {
  bulletinFields,
  bulletinMetadata,
  currencyCode,
  isoDate,
  jsonResult,
  RATE_PLACES,
  READ_ONLY,
  rateInTry,
  rateType,
} from './shared.js';

export function registerConvert(server: McpServer, client: TcmbClient): void {
  server.registerTool(
    'tcmb_convert',
    {
      title: 'Convert with TCMB rates',
      description:
        'Convert an amount between Turkish lira (TRY) and any currency in the TCMB bulletin, or between ' +
        'two foreign currencies through their TRY rates. The same rate type is used for both sides.',
      inputSchema: z.object({
        amount: z.number().positive().max(1e12),
        from: currencyCode.describe('Source currency, for example USD or TRY.'),
        to: currencyCode.describe('Target currency, for example TRY or EUR.'),
        date: isoDate
          .optional()
          .describe('Bulletin date as YYYY-MM-DD. Omit for the most recent bulletin.'),
        rate_type: rateType.default('forex_buying'),
      }),
      outputSchema: z.object({
        ...bulletinFields,
        amount: z.number(),
        from: z.string(),
        to: z.string(),
        rate_type: z.string(),
        rate: z.number().describe('Units of the target currency for one unit of the source.'),
        result: z.number(),
      }),
      annotations: READ_ONLY,
    },
    async ({ amount, from, to, date, rate_type }) => {
      const resolved = await client.resolve(date);
      const fromRate = rateInTry(resolved.bulletin, from, rate_type);
      const toRate = rateInTry(resolved.bulletin, to, rate_type);
      const rate = divide(fromRate, toRate);
      const result = divide(multiply(decimalFromNumber(amount), fromRate), toRate);
      return jsonResult({
        ...bulletinMetadata(client, resolved),
        amount,
        from: from.toUpperCase(),
        to: to.toUpperCase(),
        rate_type,
        rate: toNumber(rate, RATE_PLACES),
        result: toNumber(result, 4),
      });
    },
  );
}
