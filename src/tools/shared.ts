import type { ToolAnnotations } from '@modelcontextprotocol/server';
import * as z from 'zod';
import type { TcmbClient } from '../tcmb/client.js';
import { type Decimal, ONE, toNumber } from '../tcmb/decimal.js';
import { TcmbError } from '../tcmb/errors.js';
import {
  type Bulletin,
  type CurrencyRate,
  RATE_TYPES,
  type RateType,
  type ResolvedBulletin,
} from '../tcmb/types.js';

export const RATE_PLACES = 6;

export const READ_ONLY: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the YYYY-MM-DD format');

export const currencyCode = z
  .string()
  .regex(/^[A-Za-z]{3}$/, 'Use a three-letter ISO 4217 code such as USD');

export const rateType = z
  .enum(RATE_TYPES)
  .describe(
    'forex_buying (döviz alış), forex_selling (döviz satış), banknote_buying (efektif alış) ' +
      'or banknote_selling (efektif satış).',
  );

export const fallbackReason = z.enum(['weekend', 'holiday', 'not_published_yet']).nullable();

export const bulletinFields = {
  requested_date: z.string().nullable(),
  bulletin_date: z.string(),
  bulletin_number: z.string().nullable(),
  fallback_reason: fallbackReason,
  source_url: z.string(),
};

export function bulletinMetadata(client: TcmbClient, resolved: ResolvedBulletin) {
  return {
    requested_date: resolved.requestedDate,
    bulletin_date: resolved.bulletin.date,
    bulletin_number: resolved.bulletin.number,
    fallback_reason: resolved.fallbackReason,
    source_url: client.sourceUrl(resolved.bulletin.date),
  };
}

export function findCurrency(bulletin: Bulletin, code: string): CurrencyRate {
  const currency = bulletin.currencies.get(code.toUpperCase());
  if (!currency) {
    const available = [...bulletin.currencies.keys()].join(', ');
    throw new TcmbError(
      `${code.toUpperCase()} is not in the TCMB bulletin of ${bulletin.date}. Available: ${available}.`,
    );
  }
  return currency;
}

export function rateInTry(bulletin: Bulletin, code: string, type: RateType): Decimal {
  if (code.toUpperCase() === 'TRY') {
    return ONE;
  }
  const currency = findCurrency(bulletin, code);
  const rate = currency.rates[type];
  if (rate === null) {
    const offered = RATE_TYPES.filter((candidate) => currency.rates[candidate] !== null);
    throw new TcmbError(
      `TCMB does not publish a ${type} rate for ${currency.code} on ${bulletin.date}. ` +
        `Rates available for ${currency.code}: ${offered.join(', ')}.`,
    );
  }
  return rate;
}

export function rateNumber(value: Decimal | null): number | null {
  return value === null ? null : toNumber(value, RATE_PLACES);
}

export function jsonResult<T extends Record<string, unknown>>(output: T) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(output) }],
    structuredContent: output,
  };
}
