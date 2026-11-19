import { describe, expect, it } from 'vitest';
import { toNumber } from '../src/tcmb/decimal.js';
import { UpstreamError } from '../src/tcmb/errors.js';
import { decodeBody, parseBulletin } from '../src/tcmb/parse.js';
import { fixture } from './helpers/fake-tcmb.js';

const load = (name: string) => parseBulletin(decodeBody(new Uint8Array(fixture(name))));

describe('parseBulletin', () => {
  it('reads the bulletin header and every currency', () => {
    const bulletin = load('2026-11-19.xml');

    expect(bulletin.date).toBe('2026-11-19');
    expect(bulletin.number).toBe('2026/218');
    expect(bulletin.currencies.size).toBe(22);
  });

  it('keeps forex and banknote rates as exact decimals', () => {
    const usd = load('2026-11-19.xml').currencies.get('USD');

    expect(usd?.rates.forex_buying).not.toBeNull();
    expect(toNumber(usd?.rates.forex_buying ?? 0n, 6)).toBe(50.3786);
    expect(toNumber(usd?.rates.banknote_selling ?? 0n, 6)).toBe(50.5451);
  });

  it('divides rates quoted per 100 units', () => {
    const jpy = load('2026-11-19.xml').currencies.get('JPY');

    expect(jpy?.unit).toBe(100);
    expect(toNumber(jpy?.rates.forex_buying ?? 0n, 6)).toBe(0.314505);
  });

  it('returns null for rates TCMB leaves empty', () => {
    const bulletin = load('2026-11-19.xml');
    const xdr = bulletin.currencies.get('XDR');

    expect(xdr?.rates.forex_buying).not.toBeNull();
    expect(xdr?.rates.forex_selling).toBeNull();
    expect(xdr?.rates.banknote_buying).toBeNull();
    expect(bulletin.currencies.get('CNY')?.rates.banknote_selling).toBeNull();
  });

  it('trims padded names', () => {
    const xdr = load('2026-11-19.xml').currencies.get('XDR');

    expect(xdr?.name).toBe('SPECIAL DRAWING RIGHT (SDR)');
    expect(xdr?.nameTr).toBe('ÖZEL ÇEKME HAKKI (SDR)');
  });

  it('decodes ISO-8859-9 archives', () => {
    const bulletin = load('2010-01-04.xml');

    expect(bulletin.date).toBe('2010-01-04');
    expect(bulletin.currencies.get('JPY')?.nameTr).toBe('JAPON YENİ');
    expect(toNumber(bulletin.currencies.get('USD')?.rates.forex_buying ?? 0n, 6)).toBe(1.481);
  });

  it('converts pre-2005 old lira values to the current lira', () => {
    const bulletin = load('1996-04-16.xml');

    expect(bulletin.number).toBeNull();
    expect(bulletin.currencies.has('DEM')).toBe(true);
    expect(toNumber(bulletin.currencies.get('USD')?.rates.forex_buying ?? 0n, 6)).toBe(0.073218);
  });

  it('rejects documents that are not bulletins', () => {
    expect(() => parseBulletin(fixture('not-found.html').toString('utf8'))).toThrow(UpstreamError);
  });
});
