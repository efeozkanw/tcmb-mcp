import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export const VERSION = manifest.version;
export const USER_AGENT = `tcmb-mcp/${VERSION} (+https://github.com/efeozkanw/tcmb-mcp)`;
