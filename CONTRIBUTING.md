# Contributing

Bug reports and pull requests are welcome.

```bash
npm ci
npm run lint
npm run typecheck
npm test
```

Tests run offline against the bulletins in `test/fixtures`. If you fix a parsing problem, add the bulletin that caused it as a fixture.

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org) (`fix:`, `feat:`, `docs:` and so on) because releases and the changelog are generated from them.
