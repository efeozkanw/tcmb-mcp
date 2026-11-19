# tcmb-mcp

[![npm](https://img.shields.io/npm/v/tcmb-mcp)](https://www.npmjs.com/package/tcmb-mcp)
[![CI](https://github.com/efeozkanw/tcmb-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/efeozkanw/tcmb-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

An MCP server for the daily exchange rates of the Central Bank of the Republic of Türkiye (TCMB).

It reads the official XML bulletins straight from tcmb.gov.tr, needs no API key, and handles the parts that usually go wrong: weekends and public holidays, the 15:30 publication time, currencies quoted per 100 units, missing rates, and the rate Turkish tax practice expects on a foreign currency invoice.

[Türkçe](README.tr.md)

## Install

Requires Node.js 22.12 or later.

**Claude Code**

```bash
claude mcp add tcmb -- npx -y tcmb-mcp
```

Add `--scope user` to make it available in every project.

**Claude Desktop, Cursor, Windsurf**

Add this to `claude_desktop_config.json`, `~/.cursor/mcp.json` or the equivalent file:

```json
{
  "mcpServers": {
    "tcmb": {
      "command": "npx",
      "args": ["-y", "tcmb-mcp"]
    }
  }
}
```

**VS Code**

```json
{
  "servers": {
    "tcmb": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "tcmb-mcp"]
    }
  }
}
```

## Tools

| Tool                   | What it does                                                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tcmb_get_rates`       | Rates from the latest bulletin or a given date, for all currencies or a selection. `response_format: "detailed"` adds names and banknote rates.                  |
| `tcmb_convert`         | Converts an amount between TRY and a foreign currency, or between two foreign currencies through their TRY rates.                                                |
| `tcmb_invoice_rate`    | The rate for a foreign currency invoice: the last bulletin before the invoice date, forex buying by default. Optionally returns the TRY amount rounded to kuruş. |
| `tcmb_get_history`     | One currency over a date range, daily, weekly or monthly, with first, last, min, max and percentage change.                                                      |
| `tcmb_list_currencies` | Currencies in a bulletin, their Turkish and English names, quoted unit and which rate types exist.                                                               |

All tools are read-only and return structured output with a JSON schema.

Things you can ask once it is installed:

- What is the euro selling rate today?
- I am issuing a 3,400 USD invoice dated 2 January 2026. What lira amount goes on it?
- How did the dollar move against the lira month by month in 2025?
- Convert 250 GBP to EUR using the rates of 15 March 2024.

## How dates are handled

- TCMB announces one bulletin per business day at 15:30 Istanbul time. Until then the most recent bulletin is the previous business day's.
- There is no bulletin on weekends, public holidays or the half day before a religious holiday. Asking for such a date returns the closest earlier bulletin. Every response carries `requested_date`, `bulletin_date` and `fallback_reason` (`weekend`, `holiday` or `not_published_yet`) so nothing is silently substituted.
- `tcmb_invoice_rate` always uses the bulletin before the invoice date, which is the one published in the Official Gazette on that date. An invoice dated Monday therefore uses Friday's rate.
- Rates are lira per one unit. Currencies TCMB quotes per 100 units, such as JPY, are divided.
- Bulletins before 2005 are in old lira and are converted to the current lira (1 TRY = 1,000,000 TRL).
- The archive goes back to 16 April 1996. The set of currencies changes over the years, so codes are read from each bulletin rather than hard-coded.

Past bulletins never change, so they are kept in memory for the life of the process. The current bulletin is refreshed every ten minutes. Requests time out after ten seconds and server errors are retried twice.

## Library use

The client behind the server is exported as well:

```ts
import { TcmbClient } from 'tcmb-mcp';

const tcmb = new TcmbClient();
const { bulletin, fallbackReason } = await tcmb.resolve('2026-10-29');
```

## Development

```bash
npm ci
npm test
npm run test:live
npm run inspect
```

`npm test` runs against recorded bulletins in `test/fixtures` and does not touch the network. `npm run test:live` checks the real TCMB endpoints. `npm run inspect` opens the server in the MCP Inspector.

## Data and disclaimer

The data comes from the indicative exchange rates published by TCMB at [tcmb.gov.tr](https://www.tcmb.gov.tr/kurlar/kurlar_tr.html). This project is not affiliated with TCMB. The rates are indicative; check them against the official source before using them in accounting or tax filings.

For macroeconomic series such as inflation, interest rates and reserves, use TCMB's own EVDS MCP server.

## License

[MIT](LICENSE)
