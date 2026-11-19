import { readFileSync } from 'node:fs';

export function fixture(name: string): Buffer {
  return readFileSync(new URL(`../fixtures/${name}`, import.meta.url));
}

const NOT_FOUND = fixture('not-found.html');
const TEMPLATE = fixture('2026-11-18.xml').toString('utf8');
const REAL = new Map([
  ['2026-11-18', fixture('2026-11-18.xml')],
  ['2026-11-19', fixture('2026-11-19.xml')],
]);

export interface FakeTcmbOptions {
  latest: string;
  published: string[];
}

export function fakeTcmb({ latest, published }: FakeTcmbOptions) {
  const requests: string[] = [];
  const available = new Set([...published, latest]);

  const fetch = async (input: string | URL | Request): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : input);
    const path = url.pathname.replace('/kurlar/', '');
    requests.push(path);
    if (path === 'today.xml') {
      return xml(bulletinFor(latest));
    }
    const date = dateFromArchivePath(path);
    return date && available.has(date) && date <= latest
      ? xml(bulletinFor(date))
      : new Response(NOT_FOUND, { status: 404, headers: { 'content-type': 'text/html' } });
  };

  return { fetch: fetch as typeof globalThis.fetch, requests };
}

export function istanbulTime(dateTime: string): () => Date {
  return () => new Date(`${dateTime}:00+03:00`);
}

function bulletinFor(date: string): Buffer {
  const real = REAL.get(date);
  if (real) {
    return real;
  }
  const [year, month, day] = date.split('-');
  return Buffer.from(TEMPLATE.replace(/Tarih="[^"]+"/, `Tarih="${day}.${month}.${year}"`));
}

function dateFromArchivePath(path: string): string | null {
  const match = /^(\d{4})(\d{2})\/(\d{2})\d{2}\d{4}\.xml$/.exec(path);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function xml(body: Buffer): Response {
  return new Response(new Uint8Array(body), {
    status: 200,
    headers: { 'content-type': 'application/xml' },
  });
}
