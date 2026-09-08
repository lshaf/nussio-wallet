# QA matrix

Run before every release. `pnpm build` first; the e2e suite loads `dist/chrome-mv3`.

## Automated

| target         | command                                                                      | last run                                                                     |
| -------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Chromium       | `pnpm test:e2e`                                                              | 2026-09-08: 19 passed, 3 skipped (`idle-session` and the two live-key specs) |
| Microsoft Edge | `pnpm test:e2e:edge`                                                         | 2026-09-05: 19 passed, 1 skipped                                             |
| Brave          | `pnpm test:e2e:brave`                                                        | 2026-09-05: 19 passed, 1 skipped                                             |
| Firefox MV3    | `pnpm build:firefox && pnpm exec web-ext lint --source-dir dist/firefox-mv3` | 2026-09-08: 0 errors, 3 warnings                                             |
| Firefox MV3    | `pnpm test:firefox`                                                          | 2026-09-08: 4 checks passed                                                  |
| Bundle budgets | `pnpm check:bundle`                                                          | 2026-09-08: popup 522 KB, prompt 585 KB, app 1119 KB, 2.45 MB total          |
| Accessibility  | part of `pnpm test:e2e` (`a11y.spec.ts`)                                     | 2026-09-08: no serious or critical findings                                  |

`session-transact` and the other relay tests talk to the live buoy service, so they can time out
when the whole suite runs in parallel; Playwright retries once locally and twice in CI.

Specs that flip `advancedOptions` write straight into `chrome.storage.local`, so they must wait for
`#/setup/import` first. Without that barrier the read-modify-write races the app's own settings
write from the chain step and drops the enabled chain, which strands onboarding.

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

Both builds are Manifest V3. Firefox grants `host_permissions` at install from 127 onward, and the
smoke test proves it: a content script only injects into `http://127.0.0.1` if that grant landed.

Headless Firefox ignores `--start-url` under `web-ext`, so the smoke script opens a real window.

The MAIN-world check races the page's first inline script and fails about one run in five. Click
capture does not depend on winning that race — the isolated content script listens for the same
clicks — so re-run before treating a single failure as a regression.

## Ledger, per release

WebHID needs a real device, so this is a hand walk in Chrome, Edge or Brave (Firefox has no WebHID
and hides the tab):

1. Unlock a Ledger with the Antelope app open, then Import → **Ledger** → Connect device. Chrome
   asks which device to share; the app version appears and the first five paths are read.
2. Accounts that use those keys on the enabled chain are listed; import one. It shows a **Ledger**
   badge under Wallets and no key lands in the keyring.
3. Send a small transfer. The wallet stays unlocked-free: the prompt waits on "Confirm the
   transaction on the Ledger", the device shows the action, and approving broadcasts it. The device
   must leave its review screen on its own: the app repaints only when the approval finds the
   transaction already complete, so the whole serialisation has to reach it before it prompts.
4. Reject on the device and confirm the dialog reports the Ledger error rather than hanging.
5. Log in to a dApp with the same account, then transact; the prompt window takes the same path.

The device signs the Fuel-cosigned transaction, so the bytes it displays are the ones broadcast.

## Known build warnings

`pnpm build` prints one warning, and it is expected:

```
Module "crypto" has been externalized for browser compatibility, imported by asmcrypto.js
```

`asmcrypto.js` reaches the bundle through `@greymass/anchor-link-session-manager`, which imports
`AES_CBC` to unseal incoming dApp messages. The node `require('crypto')` sits in asmcrypto's
`getRandomValues`, which only its RSA prime search calls. The session manager never generates
randomness: it has no `sealMessage`, and `unsealMessage` builds `AES_CBC` from a key and IV derived
from the shared secret, then decrypts. So the externalised import is unreachable.

It is worth re-checking if that dependency ever starts sealing messages, because the same function
would also fail on the browser branch inside a service worker: it tests `window.crypto` before
`self.crypto`, and `window` does not exist there.

## Live-chain checks

The suite reads real chains, so a failure can mean a node is down rather than a regression:

- Jungle 4 (`jungle4.greymass.com`) — onboarding, resources, governance, contracts, history.
- WAX and Proton (`chains.spec.ts`) — 8-decimal balances, PowerUp presence, XPR versus SYS,
  hidden staking on Proton.
- Hyperion history endpoints, which are third-party and rate limited.

## Live key checks

Two specs need a funded WAX Testnet key and skip without one. Create an account and fund it from
the sw/eden faucet, which returns both key pairs:

```
curl "https://faucet.waxsweden.org/create_account?<12 chars a-z1-5>"
curl "https://faucet.waxsweden.org/get_token?<account>"
```

Then:

```
WAX_TEST_ACCOUNT=<account> WAX_TEST_KEY=<active private key> \
  pnpm exec playwright test tests/e2e/live-signing.spec.ts tests/e2e/dapp-login.spec.ts
```

- `live-signing.spec.ts` imports the key, sends 0.00000001 WAX to `eosio` and asserts the result
  dialog shows a transaction id. This is the only test that signs, pays for resources and
  broadcasts for real.
- `dapp-login.spec.ts` logs in to `wax-test.atomichub.io` with anchor-link, then checks the session
  is listed under Settings. AtomicHub renders its wallet picker inside a closed shadow root, so the
  two clicks that reach it are by coordinate at 1280x720 and will need updating if that modal moves.

Status 2026-09-05: both pass. Transfer `65f4c16c…` and `21c09209…` are on WAX Testnet.

## Not covered by tests

- A real Anchor Desktop backup file. Interop is proven against a file this repo generates.
- Ledger signing on a real device. The APDU framing, HID packets and BER serialisation have unit
  tests against a fake device; nothing drives real hardware. See the manual check below.
- Cold wallet, keycert recovery: not built (M9).
