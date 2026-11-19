const SCALE = 12;
const FACTOR = 10n ** BigInt(SCALE);
const DECIMAL_PATTERN = /^(-)?(\d+)(?:[.,](\d+))?$/;

export type Decimal = bigint;

export const ONE: Decimal = FACTOR;

export function parseDecimal(input: string): Decimal | null {
  const match = DECIMAL_PATTERN.exec(input.trim());
  if (!match) {
    return null;
  }
  const [, sign, whole = '0', fraction = ''] = match;
  const scaled = BigInt(whole) * FACTOR + BigInt(fraction.padEnd(SCALE, '0').slice(0, SCALE));
  return sign ? -scaled : scaled;
}

export function decimalFromNumber(value: number): Decimal {
  const parsed = parseDecimal(value.toFixed(SCALE));
  if (parsed === null) {
    throw new RangeError(`Cannot represent ${value} as a decimal`);
  }
  return parsed;
}

export function decimalFromInteger(value: number | bigint): Decimal {
  return BigInt(value) * FACTOR;
}

export function multiply(a: Decimal, b: Decimal): Decimal {
  return divideRounded(a * b, FACTOR);
}

export function divide(a: Decimal, b: Decimal): Decimal {
  if (b === 0n) {
    throw new RangeError('Division by zero');
  }
  return divideRounded(a * FACTOR, b);
}

export function toNumber(value: Decimal, places: number): number {
  const step = 10n ** BigInt(SCALE - places);
  return Number(divideRounded(value, step)) / 10 ** places;
}

function divideRounded(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const absRemainder = remainder < 0n ? -remainder : remainder;
  const absDenominator = denominator < 0n ? -denominator : denominator;
  if (absRemainder * 2n < absDenominator) {
    return quotient;
  }
  return numerator < 0n !== denominator < 0n ? quotient - 1n : quotient + 1n;
}
