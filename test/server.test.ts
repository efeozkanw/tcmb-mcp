import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer } from '../src/server.js';
import { TcmbClient } from '../src/tcmb/client.js';
import { fakeTcmb, istanbulTime } from './helpers/fake-tcmb.js';

let mcp: Client;

beforeEach(async () => {
  const tcmb = fakeTcmb({ latest: '2026-11-19', published: ['2026-11-13', '2026-11-18'] });
  const client = new TcmbClient({
    fetch: tcmb.fetch,
    now: istanbulTime('2026-11-19T16:00'),
    retries: 0,
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await createServer({ client }).connect(serverTransport);
  mcp = new Client({ name: 'test', version: '1.0.0' });
  await mcp.connect(clientTransport);
});

afterEach(async () => {
  await mcp.close();
});

async function call(name: string, args: Record<string, unknown>) {
  const result = await mcp.callTool({ name, arguments: args });
  return result as {
    isError?: boolean;
    structuredContent?: Record<string, unknown>;
    content: { type: string; text?: string }[];
  };
}

describe('MCP server', () => {
  it('lists read-only tools in a stable order', async () => {
    const { tools } = await mcp.listTools();

    expect(tools.map((tool) => tool.name)).toEqual([
      'tcmb_get_rates',
      'tcmb_convert',
      'tcmb_invoice_rate',
      'tcmb_get_history',
      'tcmb_list_currencies',
    ]);
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint).toBe(true);
      expect(tool.outputSchema).toBeDefined();
    }
  });

  it('returns selected rates', async () => {
    const result = await call('tcmb_get_rates', { currencies: ['usd', 'JPY'] });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      bulletin_date: '2026-11-19',
      bulletin_number: '2026/218',
      source_url: 'https://www.tcmb.gov.tr/kurlar/202611/19112026.xml',
      rates: [
        { code: 'USD', forex_buying: 50.3786, forex_selling: 50.4694 },
        { code: 'JPY', forex_buying: 0.314505 },
      ],
    });
    expect(JSON.parse(result.content[0]?.text ?? '{}')).toEqual(result.structuredContent);
  });

  it('adds names and banknote rates in detailed mode', async () => {
    const result = await call('tcmb_get_rates', {
      currencies: ['XDR'],
      response_format: 'detailed',
    });

    expect(result.structuredContent?.rates).toEqual([
      {
        code: 'XDR',
        name: 'SPECIAL DRAWING RIGHT (SDR)',
        name_tr: 'ÖZEL ÇEKME HAKKI (SDR)',
        quoted_unit: 1,
        forex_buying: 67.7865,
        forex_selling: null,
        banknote_buying: null,
        banknote_selling: null,
      },
    ]);
  });

  it('converts to lira and across currencies', async () => {
    const toLira = await call('tcmb_convert', { amount: 100, from: 'USD', to: 'TRY' });
    const cross = await call('tcmb_convert', { amount: 100, from: 'EUR', to: 'USD' });

    expect(toLira.structuredContent).toMatchObject({ rate: 50.3786, result: 5037.86 });
    expect(cross.structuredContent).toMatchObject({ rate: 1.098842, result: 109.8842 });
  });

  it('uses the previous business day for an invoice', async () => {
    const monday = await call('tcmb_invoice_rate', {
      invoice_date: '2026-11-16',
      currency: 'USD',
    });
    const today = await call('tcmb_invoice_rate', {
      invoice_date: '2026-11-19',
      currency: 'EUR',
      amount: 1250,
    });

    expect(monday.structuredContent).toMatchObject({ bulletin_date: '2026-11-13' });
    expect(today.structuredContent).toMatchObject({
      bulletin_date: '2026-11-18',
      rate_type: 'forex_buying',
      rate: 55.2451,
      amount_try: 69056.38,
    });
  });

  it('explains which rates exist when one is missing', async () => {
    const result = await call('tcmb_convert', {
      amount: 10,
      from: 'XDR',
      to: 'TRY',
      rate_type: 'banknote_buying',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toMatch(/available for XDR: forex_buying/);
  });

  it('lists the valid codes for an unknown currency', async () => {
    const result = await call('tcmb_get_rates', { currencies: ['ABC'] });

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toMatch(/ABC is not in the TCMB bulletin.*USD/);
  });

  it('rejects arguments that do not match the schema', async () => {
    const result = await call('tcmb_convert', { amount: -5, from: 'USD', to: 'TRY' });

    expect(result.isError).toBe(true);
  });

  it('summarises a rate history', async () => {
    const result = await call('tcmb_get_history', {
      currency: 'USD',
      start_date: '2026-11-16',
      end_date: '2026-11-19',
    });

    expect(result.structuredContent).toMatchObject({
      points: [
        { date: '2026-11-18', rate: 50.3536 },
        { date: '2026-11-19', rate: 50.3786 },
      ],
      summary: { first: 50.3536, last: 50.3786, change_percent: 0.05 },
    });
  });
});
