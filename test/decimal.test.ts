import { describe, expect, it } from 'vitest';
import {
  decimalFromNumber,
  divide,
  multiply,
  parseDecimal,
  toNumber,
} from '../src/tcmb/decimal.js';

const d = (value: string) => {
  const parsed = parseDecimal(value);
  if (parsed === null) {
    throw new Error(`bad test value ${value}`);
  }
  return parsed;
};

describe('decimal', () => {
  it('parses dot and comma separators', () => {
    expect(d('50.3786')).toBe(d('50,3786'));
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('1.2.3')).toBeNull();
  });

  it('multiplies without floating point drift', () => {
    expect(toNumber(multiply(d('0.1'), d('0.2')), 6)).toBe(0.02);
    expect(toNumber(multiply(decimalFromNumber(1234.56), d('50.3786')), 2)).toBe(62195.4);
  });

  it('divides and rounds half away from zero', () => {
    expect(toNumber(divide(d('55.3581'), d('50.3786')), 6)).toBe(1.098842);
    expect(toNumber(d('0.125'), 2)).toBe(0.13);
    expect(toNumber(d('-0.125'), 2)).toBe(-0.13);
  });

  it('refuses to divide by zero', () => {
    expect(() => divide(d('1'), 0n)).toThrow(RangeError);
  });
});
