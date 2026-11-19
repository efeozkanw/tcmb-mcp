import { USER_AGENT } from '../version.js';
import {
  addDays,
  archivePath,
  daysBetween,
  FIRST_BULLETIN_DATE,
  isIsoDate,
  istanbulNow,
  isWeekend,
  PUBLICATION_MINUTE,
} from './dates.js';
import { TcmbError, UpstreamError } from './errors.js';
import { LruCache } from './lru.js';
import { decodeBody, parseBulletin } from './parse.js';
import type { Bulletin, FallbackReason, ResolvedBulletin } from './types.js';

export interface TcmbClientOptions {
  fetch?: typeof globalThis.fetch;
  now?: () => Date;
  baseUrl?: string;
  timeoutMs?: number;
  retries?: number;
}

const DEFAULT_BASE_URL = 'https://www.tcmb.gov.tr/kurlar/';
const LATEST_TTL_MS = 10 * 60 * 1000;
const LOOKBACK_DAYS = 14;
const MAX_BODY_BYTES = 1024 * 1024;

export class TcmbClient {
  readonly #fetch: typeof globalThis.fetch;
  readonly #now: () => Date;
  readonly #baseUrl: string;
  readonly #timeoutMs: number;
  readonly #retries: number;
  readonly #archive = new LruCache<string, Promise<Bulletin | null>>(1000);
  #latest: { bulletin: Promise<Bulletin>; expiresAt: number } | undefined;

  constructor(options: TcmbClientOptions = {}) {
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#now = options.now ?? (() => new Date());
    this.#baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.#timeoutMs = options.timeoutMs ?? 10_000;
    this.#retries = options.retries ?? 2;
  }

  today(): string {
    return istanbulNow(this.#now()).date;
  }

  sourceUrl(date: string): string {
    return new URL(archivePath(date), this.#baseUrl).href;
  }

  latest(): Promise<Bulletin> {
    const now = this.#now().getTime();
    if (this.#latest && this.#latest.expiresAt > now) {
      return this.#latest.bulletin;
    }
    const bulletin = this.#download('today.xml').then((result) => {
      if (!result) {
        throw new UpstreamError('TCMB did not return the current bulletin (today.xml)');
      }
      return result;
    });
    const entry = { bulletin, expiresAt: now + LATEST_TTL_MS };
    this.#latest = entry;
    bulletin.catch(() => {
      if (this.#latest === entry) {
        this.#latest = undefined;
      }
    });
    return bulletin;
  }

  async resolve(date?: string): Promise<ResolvedBulletin> {
    if (date === undefined) {
      return { requestedDate: null, bulletin: await this.latest(), fallbackReason: null };
    }
    this.assertDate(date);
    const bulletin = await this.#findOnOrBefore(date);
    return {
      requestedDate: date,
      bulletin,
      fallbackReason: bulletin.date === date ? null : this.#fallbackReason(date),
    };
  }

  async resolveBefore(date: string): Promise<Bulletin> {
    this.assertDate(date);
    if (date === FIRST_BULLETIN_DATE) {
      throw new TcmbError(`There is no TCMB bulletin before ${FIRST_BULLETIN_DATE}`);
    }
    return this.#findOnOrBefore(addDays(date, -1));
  }

  bulletinOn(date: string): Promise<Bulletin | null> {
    const cached = this.#archive.get(date);
    if (cached) {
      return cached;
    }
    const request = this.#download(archivePath(date));
    this.#archive.set(date, request);
    request.then(
      (bulletin) => {
        if (!bulletin && date >= this.today()) {
          this.#archive.delete(date);
        }
      },
      () => this.#archive.delete(date),
    );
    return request;
  }

  assertDate(date: string): void {
    if (!isIsoDate(date)) {
      throw new TcmbError(`"${date}" is not a valid date. Use YYYY-MM-DD, for example 2026-11-19.`);
    }
    if (date < FIRST_BULLETIN_DATE) {
      throw new TcmbError(`TCMB bulletins start on ${FIRST_BULLETIN_DATE}; ${date} is earlier.`);
    }
    const today = this.today();
    if (date > today) {
      throw new TcmbError(`${date} is in the future. The latest possible date is ${today}.`);
    }
  }

  async #findOnOrBefore(date: string): Promise<Bulletin> {
    if (daysBetween(date, this.today()) <= LOOKBACK_DAYS) {
      const latest = await this.latest();
      if (latest.date <= date) {
        return latest;
      }
    }
    for (let offset = 0; offset <= LOOKBACK_DAYS; offset++) {
      const candidate = addDays(date, -offset);
      if (candidate < FIRST_BULLETIN_DATE) {
        break;
      }
      if (isWeekend(candidate)) {
        continue;
      }
      const bulletin = await this.bulletinOn(candidate);
      if (bulletin) {
        return bulletin;
      }
    }
    throw new TcmbError(
      `No TCMB bulletin was published in the ${LOOKBACK_DAYS} days up to ${date}`,
    );
  }

  #fallbackReason(date: string): FallbackReason {
    if (isWeekend(date)) {
      return 'weekend';
    }
    const now = istanbulNow(this.#now());
    return date === now.date && now.minute < PUBLICATION_MINUTE ? 'not_published_yet' : 'holiday';
  }

  async #download(path: string): Promise<Bulletin | null> {
    const url = new URL(path, this.#baseUrl);
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.#request(url);
      } catch (error) {
        const retryable =
          !(error instanceof TcmbError) || (error instanceof UpstreamError && error.retryable);
        if (!retryable || attempt >= this.#retries) {
          throw error instanceof TcmbError
            ? error
            : new UpstreamError(describeFailure(url, error), true);
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** attempt));
    }
  }

  async #request(url: URL): Promise<Bulletin | null> {
    const response = await this.#fetch(url, {
      headers: { accept: 'application/xml', 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(this.#timeoutMs),
    });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new UpstreamError(
        `TCMB responded with HTTP ${response.status} for ${url.pathname}`,
        response.status >= 500,
      );
    }
    const body = new Uint8Array(await response.arrayBuffer());
    if (body.byteLength > MAX_BODY_BYTES) {
      throw new UpstreamError(`TCMB response for ${url.pathname} is unexpectedly large`);
    }
    return parseBulletin(decodeBody(body));
  }
}

function describeFailure(url: URL, error: unknown): string {
  const reason =
    error instanceof Error && error.name === 'TimeoutError'
      ? 'timed out'
      : error instanceof Error
        ? error.message
        : String(error);
  return `Could not reach TCMB for ${url.pathname} (${reason})`;
}
