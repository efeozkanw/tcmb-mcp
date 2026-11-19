import { McpServer } from '@modelcontextprotocol/server';
import { TcmbClient } from './tcmb/client.js';
import { registerConvert } from './tools/convert.js';
import { registerGetHistory } from './tools/get-history.js';
import { registerGetRates } from './tools/get-rates.js';
import { registerInvoiceRate } from './tools/invoice-rate.js';
import { registerListCurrencies } from './tools/list-currencies.js';
import { VERSION } from './version.js';

export interface ServerOptions {
  client?: TcmbClient;
}

export function createServer({ client = new TcmbClient() }: ServerOptions = {}): McpServer {
  const server = new McpServer({
    name: 'tcmb-mcp',
    title: 'TCMB exchange rates',
    version: VERSION,
  });
  registerGetRates(server, client);
  registerConvert(server, client);
  registerInvoiceRate(server, client);
  registerGetHistory(server, client);
  registerListCurrencies(server, client);
  return server;
}
