import { describe, expect, it } from 'vitest';
import { TcmbClient } from '../src/tcmb/client.js';
import { collectHistory } from '../src/tcmb/history.js';
import { fakeTcmb, istanbulTime } from './helpers/fake-tcmb.js';

function client(published: string[]) {
  const tcmb = fakeTcmb({ latest: '2026-11-19', published });
  return new TcmbClient({ fetch: tcmb.fetch, now: istanbulTime('2026-11-19T16:00'), retries: 0 });
}

describe('collectHistory', () => {
  it('returns one point per published business day', async () => {
    const bulletins = await collectHistory(
      client(['2026-10-26', '2026-10-27', '2026-10-30']),
      '2026-10-25',
      '2026-11-01',
      'daily',
    );

    expect(bulletins.map((bulletin) => bulletin.date)).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-30',
    ]);
  });

  it('takes the last bulletin of each month', async () => {
    const bulletins = await collectHistory(
      client(['2026-08-31', '2026-09-29', '2026-10-30']),
      '2026-08-15',
      '2026-10-31',
      'monthly',
    );

    expect(bulletins.map((bulletin) => bulletin.date)).toEqual([
      '2026-08-31',
      '2026-09-29',
      '2026-10-30',
    ]);
  });

  it('takes the last bulletin of each week', async () => {
    const bulletins = await collectHistory(
      client(['2026-11-05', '2026-11-13', '2026-11-18']),
      '2026-11-02',
      '2026-11-18',
      'weekly',
    );

    expect(bulletins.map((bulletin) => bulletin.date)).toEqual([
      '2026-11-05',
      '2026-11-13',
      '2026-11-18',
    ]);
  });

  it('asks for a coarser interval when the range is too long', async () => {
    await expect(collectHistory(client([]), '2026-01-01', '2026-06-30', 'daily')).rejects.toThrow(
      /coarser interval/,
    );
  });

  it('rejects a reversed range', async () => {
    await expect(collectHistory(client([]), '2026-11-10', '2026-11-01', 'daily')).rejects.toThrow(
      /after end_date/,
    );
  });
});
