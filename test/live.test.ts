import { describe, expect, it } from 'vitest';
import { TcmbClient } from '../src/tcmb/client.js';

describe.skipIf(!process.env.TCMB_LIVE)(
  'live TCMB',
  () => {
    const client = new TcmbClient({ timeoutMs: 30_000 });

    it('downloads the current bulletin', async () => {
      const bulletin = await client.latest();

      expect(bulletin.currencies.get('USD')?.rates.forex_buying).not.toBeNull();
    });

    it('reads a known archive bulletin', async () => {
      const bulletin = await client.bulletinOn('2026-11-18');

      expect(bulletin?.number).toBe('2026/217');
    });

    it('has no bulletin on a Sunday', async () => {
      expect(await client.bulletinOn('2026-11-15')).toBeNull();
    });
  },
  60_000,
);
