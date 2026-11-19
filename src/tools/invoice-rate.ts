import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod';
import type { TcmbClient } from '../tcmb/client.js';
import { decimalFromNumber, multiply, toNumber } from '../tcmb/decimal.js';
import {
  currencyCode,
  isoDate,
  jsonResult,
  RATE_PLACES,
  READ_ONLY,
  rateInTry,
  rateType,
} from './shared.js';

export function registerInvoiceRate(server: McpServer, client: TcmbClient): void {
  server.registerTool(
    'tcmb_invoice_rate',
    {
      title: 'Exchange rate for an invoice date',
      description:
        'The TCMB rate to use on a foreign currency invoice in Türkiye. Under the Tax Procedure Law ' +
        '(VUK) the rate is the one published in the Official Gazette on the invoice date, which is the ' +
        'bulletin announced at 15:30 on the last business day before that date. Weekends and public ' +
        'holidays are skipped automatically. Defaults to forex_buying (döviz alış). Pass amount to get ' +
        'the TRY equivalent rounded to kuruş. This is reference data, not tax advice.',
      inputSchema: z.object({
        invoice_date: isoDate.describe('Invoice date as YYYY-MM-DD.'),
        currency: currencyCode.describe('Invoice currency, for example USD or EUR.'),
        amount: z
          .number()
          .positive()
          .max(1e12)
          .optional()
          .describe('Invoice amount in the foreign currency.'),
        rate_type: rateType.default('forex_buying'),
      }),
      outputSchema: z.object({
        invoice_date: z.string(),
        currency: z.string(),
        rate_type: z.string(),
        rate: z.number(),
        bulletin_date: z.string(),
        bulletin_number: z.string().nullable(),
        source_url: z.string(),
        amount: z.number().optional(),
        amount_try: z.number().optional(),
      }),
      annotations: READ_ONLY,
    },
    async ({ invoice_date, currency, amount, rate_type }) => {
      const bulletin = await client.resolveBefore(invoice_date);
      const rate = rateInTry(bulletin, currency, rate_type);
      const totals =
        amount === undefined
          ? {}
          : { amount, amount_try: toNumber(multiply(decimalFromNumber(amount), rate), 2) };
      return jsonResult({
        invoice_date,
        currency: currency.toUpperCase(),
        rate_type,
        rate: toNumber(rate, RATE_PLACES),
        bulletin_date: bulletin.date,
        bulletin_number: bulletin.number,
        source_url: client.sourceUrl(bulletin.date),
        ...totals,
      });
    },
  );
}
