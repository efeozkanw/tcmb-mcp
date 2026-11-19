import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod';
import type { TcmbClient } from '../tcmb/client.js';
import type { CurrencyRate } from '../tcmb/types.js';
import {
  bulletinFields,
  bulletinMetadata,
  currencyCode,
  findCurrency,
  isoDate,
  jsonResult,
  READ_ONLY,
  rateNumber,
} from './shared.js';

const rate = z.number().nullable();

const outputSchema = z.object({
  ...bulletinFields,
  rates: z.array(
    z.object({
      code: z.string(),
      forex_buying: rate,
      forex_selling: rate,
      name: z.string().optional(),
      name_tr: z.string().optional(),
      quoted_unit: z.number().optional(),
      banknote_buying: rate.optional(),
      banknote_selling: rate.optional(),
    }),
  ),
});

export function registerGetRates(server: McpServer, client: TcmbClient): void {
  server.registerTool(
    'tcmb_get_rates',
    {
      title: 'TCMB exchange rates',
      description:
        'Official indicative exchange rates announced by the Central Bank of the Republic of Türkiye ' +
        '(TCMB) at 15:30 Istanbul time on business days. Values are Turkish lira per one unit of the ' +
        'currency (JPY and others quoted per 100 are already divided). On weekends, holidays or before ' +
        'publication the previous bulletin is returned and fallback_reason explains why.',
      inputSchema: z.object({
        date: isoDate
          .optional()
          .describe('Bulletin date as YYYY-MM-DD. Omit for the most recent bulletin.'),
        currencies: z
          .array(currencyCode)
          .max(40)
          .optional()
          .describe('ISO 4217 codes such as ["USD", "EUR"]. Omit for every currency.'),
        response_format: z
          .enum(['concise', 'detailed'])
          .default('concise')
          .describe('concise returns forex rates only; detailed adds names and banknote rates.'),
      }),
      outputSchema,
      annotations: READ_ONLY,
    },
    async ({ date, currencies, response_format }) => {
      const resolved = await client.resolve(date);
      const selected = currencies
        ? currencies.map((code) => findCurrency(resolved.bulletin, code))
        : [...resolved.bulletin.currencies.values()];
      const detailed = response_format === 'detailed';
      return jsonResult({
        ...bulletinMetadata(client, resolved),
        rates: selected.map((currency) => formatRate(currency, detailed)),
      });
    },
  );
}

function formatRate(currency: CurrencyRate, detailed: boolean) {
  const concise = {
    code: currency.code,
    forex_buying: rateNumber(currency.rates.forex_buying),
    forex_selling: rateNumber(currency.rates.forex_selling),
  };
  if (!detailed) {
    return concise;
  }
  return {
    ...concise,
    name: currency.name,
    name_tr: currency.nameTr,
    quoted_unit: currency.unit,
    banknote_buying: rateNumber(currency.rates.banknote_buying),
    banknote_selling: rateNumber(currency.rates.banknote_selling),
  };
}
