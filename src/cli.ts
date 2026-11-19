#!/usr/bin/env node
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createServer } from './server.js';
import { TcmbClient } from './tcmb/client.js';

const client = new TcmbClient();

serveStdio(() => createServer({ client }), {
  onerror: (error) => console.error(`tcmb-mcp: ${error.message}`),
});
