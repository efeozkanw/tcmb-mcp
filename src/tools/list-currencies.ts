import type { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod';
import type { TcmbClient } from '../tcmb/client.js';
import { bulletinFields, bulletinMetadata, isoDate, jsonResult, READ_ONLY } from './shared.js';

export function registerListCurrencies(server: McpServer, client: TcmbClient): void {
  server.registerTool(
    'tcmb_list_currencies',
    {
      title: 'Currencies in a TCMB bulletin',
      description:
        'Currencies listed in a TCMB bulletin with their English and Turkish names, the unit TCMB quotes ' +
        'them in and which rate types are published. The list changes over the years.',
      inputSchema: z.object({
        date: isoDate
          .optional()
          .describe('Bulletin date as YYYY-MM-DD. Omit for the most recent bulletin.'),
      }),
      outputSchema: z.object({
        ...bulletinFields,
        currencies: z.array(
          z.object({
            code: z.string(),
            name: z.string(),
            name_tr: z.string(),
            quoted_unit: z.number(),
            rate_types: z.array(z.string()),
          }),
        ),
      }),
      annotations: READ_ONLY,
    },
    async ({ date }) => {
      const resolved = await client.resolve(date);
      return jsonResult({
        ...bulletinMetadata(client, resolved),
        currencies: [...resolved.bulletin.currencies.values()].map((currency) => ({
          code: currency.code,
          name: currency.name,
          name_tr: currency.nameTr,
          quoted_unit: currency.unit,
          rate_types: Object.entries(currency.rates)
            .filter(([, value]) => value !== null)
            .map(([type]) => type),
        })),
      });
    },
  );
}
