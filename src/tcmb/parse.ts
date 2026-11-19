import { XMLParser } from 'fast-xml-parser';
import * as z from 'zod';
import { fromTcmbDate, REDENOMINATION_DATE } from './dates.js';
import { type Decimal, decimalFromInteger, divide, parseDecimal } from './decimal.js';
import { UpstreamError } from './errors.js';
import type { Bulletin, CurrencyRate } from './types.js';

const OLD_LIRA_FACTOR = 1_000_000;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  ignoreDeclaration: true,
  ignorePiTags: true,
  parseTagValue: false,
  parseAttributeValue: false,
  processEntities: false,
  trimValues: true,
  isArray: (name) => name === 'Currency',
});

const text = z.string().optional();

const documentSchema = z.object({
  Tarih_Date: z.object({
    Tarih: z.string(),
    Bulten_No: text,
    Currency: z.array(
      z.object({
        Kod: text,
        CurrencyCode: text,
        Unit: text,
        Isim: text,
        CurrencyName: text,
        ForexBuying: text,
        ForexSelling: text,
        BanknoteBuying: text,
        BanknoteSelling: text,
      }),
    ),
  }),
});

export function decodeBody(bytes: Uint8Array): string {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 200));
  const encoding = /encoding=["']([\w-]+)["']/i.exec(head)?.[1] ?? 'utf-8';
  try {
    return new TextDecoder(encoding).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

export function parseBulletin(xml: string): Bulletin {
  const parsed = documentSchema.safeParse(parser.parse(xml));
  if (!parsed.success) {
    throw new UpstreamError('TCMB returned a document that is not an exchange rate bulletin');
  }
  const root = parsed.data.Tarih_Date;
  const date = fromTcmbDate(root.Tarih);
  const lira = date < REDENOMINATION_DATE ? OLD_LIRA_FACTOR : 1;
  const currencies = new Map<string, CurrencyRate>();

  for (const entry of root.Currency) {
    const code = (entry.CurrencyCode || entry.Kod || '').toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) {
      continue;
    }
    const unit = Number.parseInt(entry.Unit ?? '', 10) || 1;
    const divisor = decimalFromInteger(unit * lira);
    const perUnit = (value: string | undefined): Decimal | null => {
      const amount = value ? parseDecimal(value) : null;
      return amount === null || amount <= 0n ? null : divide(amount, divisor);
    };
    currencies.set(code, {
      code,
      name: entry.CurrencyName ?? code,
      nameTr: entry.Isim ?? code,
      unit,
      rates: {
        forex_buying: perUnit(entry.ForexBuying),
        forex_selling: perUnit(entry.ForexSelling),
        banknote_buying: perUnit(entry.BanknoteBuying),
        banknote_selling: perUnit(entry.BanknoteSelling),
      },
    });
  }

  if (currencies.size === 0) {
    throw new UpstreamError(`The TCMB bulletin for ${date} contains no currencies`);
  }
  return { date, number: root.Bulten_No ?? null, currencies };
}
