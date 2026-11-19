import type { Decimal } from './decimal.js';

export const RATE_TYPES = [
  'forex_buying',
  'forex_selling',
  'banknote_buying',
  'banknote_selling',
] as const;

export type RateType = (typeof RATE_TYPES)[number];

export interface CurrencyRate {
  code: string;
  name: string;
  nameTr: string;
  unit: number;
  rates: Record<RateType, Decimal | null>;
}

export interface Bulletin {
  date: string;
  number: string | null;
  currencies: Map<string, CurrencyRate>;
}

export type FallbackReason = 'weekend' | 'holiday' | 'not_published_yet';

export interface ResolvedBulletin {
  requestedDate: string | null;
  bulletin: Bulletin;
  fallbackReason: FallbackReason | null;
}
