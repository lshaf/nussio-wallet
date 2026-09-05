# QA matrix

Run before every release. `pnpm build` first; the e2e suite loads `dist/chrome-mv3`.

## Automated

| target         | command                                                                      | status 2026-09-05                                         |
| -------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------- |
| Chromium       | `pnpm test:e2e`                                                              | 18 passed, 1 skipped (`idle-session`, needs `E2E_SLOW=1`) |
| Microsoft Edge | `pnpm test:e2e:edge`                                                         | 18 passed, 1 skipped                                      |
| Brave          | `pnpm test:e2e:brave`                                                        | 18 passed, 1 skipped                                      |
| Firefox MV2    | `pnpm build:firefox && pnpm exec web-ext lint --source-dir dist/firefox-mv2` | 0 errors, 3 warnings                                      |
| Firefox MV2    | `pnpm test:firefox`                                                          | 4 checks passed on Firefox 155                            |
| Firefox MV3    | `pnpm test:firefox:mv3`                                                      | 4 checks passed on Firefox 155                            |
| Bundle budgets | `pnpm check:bundle`                                                          | popup 519 KB, prompt 577 KB, app 1106 KB, 2.43 MB total   |
| Accessibility  | part of `pnpm test:e2e` (`a11y.spec.ts`)                                     | no serious or critical findings                           |

`session-transact` and the other relay tests talk to the live buoy service, so they can time out
when the whole suite runs in parallel; Playwright retries once locally and twice in CI.

`E2E_CHANNEL` picks a Playwright channel (`chromium`, `chrome`, `msedge`); `E2E_BROWSER_PATH`
points at any other Chromium build, which is how Brave runs.

The three Firefox lint warnings come from bundled libraries probing `Function('')` to detect a
strict CSP, plus one dynamic property assignment. Nothing in our own source evaluates strings.

## Manual, per release

`pnpm test:firefox` covers the parts a script can reach: `web-ext` installs the build into a throwaway
profile on real Firefox, loads a local page, and asserts that the `world: 'MAIN'` content script ran
before any page script and that `inpage.js` reached the page. Playwright cannot drive Firefox
extensions, so the wallet UI itself is still a hand walk with `pnpm dev:firefox`:

1. Onboarding: password → enable Jungle 4 → import a watch account → home lists the balance.
2. Link capture: open a page with an `esr:` link, click it, prompt window opens.
3. Lock and unlock, then confirm the idle timeout still locks.
4. Copy buttons (key export, request copy) — Firefox needs the `clipboardWrite` permission.
5. Side panel is Chrome-only and must be absent.

Firefox 128 and later honour `world: 'MAIN'`, and the add-on requires 142, so link capture uses the
same path as Chrome. The injected `inpage.js` stays as a second route for the isolated world.

Headless Firefox ignores `--start-url` under `web-ext`, so the smoke script opens a real window.

## Live-chain checks

The suite reads real chains, so a failure can mean a node is down rather than a regression:

- Jungle 4 (`jungle4.greymass.com`) — onboarding, resources, governance, contracts, history.
- WAX and Proton (`chains.spec.ts`) — 8-decimal balances, PowerUp presence, XPR versus SYS,
  hidden staking on Proton.
- Hyperion history endpoints, which are third-party and rate limited.

## Not covered by tests

- Signing, Fuel and broadcast with a funded key. Every automated path uses watch wallets, which
  stop at the unsigned export. Run a manual transfer on Jungle 4 before release.
- A real Anchor Desktop backup file. Interop is proven against a file this repo generates.
- Ledger, cold wallet, keycert recovery: not built (M9).
