# Threat model and security notes

Scope: the extension as built from this repository. Last reviewed 2026-09-05 (M8).

## Assets

| asset                             | where it lives                                                    | who may read it                                                        |
| --------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Private keys                      | `local:keyring`, AES-256-GCM under PBKDF2-SHA256 (600,000 rounds) | only `wallet.service` in the service worker                            |
| Unlocked keys                     | `session:unlockedKeys` (`chrome.storage.session`)                 | service worker only; cleared on lock, idle timeout and browser restart |
| Buoy request key                  | `local:sessions.requestKey`, plaintext                            | service worker; see "Accepted risks"                                   |
| Wallets, chains, contacts, tokens | `local:*`                                                         | extension pages and the worker                                         |
| Pending signing requests          | `session:requests`                                                | extension pages and the worker                                         |

Keys never cross the messaging bridge. Pages ask `transaction.service` to sign; the signature comes
back, the key does not.

## Trust boundaries

1. **Web page ↔ content script.** Pages can post `{source: 'nussio-wallet', type: 'request'}`
   messages and click `esr:` links. The content script forwards only strings that pass
   `isRequestUri`, deduped within 1.5 s. Everything else is dropped. A forwarded request only ever
   opens the prompt window; the user still has to approve it.
2. **Content script ↔ service worker.** Only the `request:open` and `provider:call` message types
   are reachable from a content script. Service calls are blocked by the guard below.
3. **Extension page ↔ service worker.** Trusted: popup, app tab, prompt window. These may call the
   proxy services.
4. **dApp ↔ buoy channel.** Sealed messages decrypt to signing requests, which land in the same
   prompt queue as any other request.

## Messaging guard

`@webext-core/proxy-service` registers every service on one `runtime.onMessage` channel and walks an
attacker-supplied `data.path` (`method.bind(target)(...data.args)`) with **no sender validation**.
That is the shape of CVE-2023-40580 (Freighter). `src/lib/messaging/guard.ts` wraps
`runtime.onMessage.addListener` before any service registers, and drops `proxy-service.*` messages
unless:

- `sender.id` is our own extension id, and
- `sender.url` starts with our extension origin (so content scripts are excluded), and
- the service key is one of `SERVICE_KEYS`, and
- `data.path` is an array of at most two plain strings, none of them `__proto__`, `constructor` or
  `prototype`, and `data.args` is an array.

Other message types pass through untouched. A unit test asserts the key list matches the
`SERVICE_KEY` constant in every `*.service.ts` file, so a new service cannot silently escape it.

## Request provenance

`request:open` records the sender's origin (`sender.url`, never a value from the payload — the
Coin98 mistake) on the pending request, and the prompt shows it as "Sent by". The app name in an
anchor-link request and the ESR callback origin are both chosen by whoever built the request, so
they cannot be trusted on their own. `ProviderCall` no longer carries an `origin` field for the
same reason.

At most five non-final requests can be queued at once, so a page cannot bury the user in prompt
windows even within the rate limit.

## Session storage

The background worker calls `storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })`
at startup, so unlocked keys stay unreachable from content scripts even if that default changes.

## Signing request parsing

`parseSigningRequest` refuses URIs over 16 KB, and the zlib provider refuses any payload that
inflates past 500 KB, which stops a compression bomb from wedging the worker. `esr.fuzz.test.ts`
throws malformed, truncated and bomb payloads at both. Forbidden actions (`updateauth`, `linkauth`,
`deleteauth` on owner/active) are blocked unless `allowDangerousTransactions` is on.

## Permissions

| permission                     | why                                                                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `storage`                      | wallets, keyring, settings, session state                                                                             |
| `alarms`                       | socket heartbeat and idle lock                                                                                        |
| `idle`                         | idle auto-lock                                                                                                        |
| `contextMenus`                 | "Open with Nussio Wallet" on links                                                                                    |
| `clipboardWrite`               | copy key, request and transaction text (Firefox needs it)                                                             |
| `sidePanel`                    | side panel mode (Chrome only)                                                                                         |
| `host_permissions: <all_urls>` | API nodes, Hyperion history, Fuel and the buoy relay are user-configurable hosts, and `esr:` links appear on any site |

`tabs` was removed: `tabs.create` does not require it. Chrome pages declare
`script-src 'self'; object-src 'self'; frame-ancestors 'none'`.

Narrowing `<all_urls>` is open work: Firefox should move the host access to
`optional_host_permissions`, and link capture could use `activeTab` if store review pushes back.

## Dependency audit

`pnpm audit --prod --audit-level moderate` runs in CI. Current state:

- `uuid` was pulled in at 8.3.2 by the session manager, affected by a moderate bounds-check
  advisory; a workspace override pins it to 11.1.1. The library only calls `v4()`, which the
  advisory does not cover, but the override removes the question.
- `elliptic` (via `@wharfkit/antelope`) carries a low advisory with no patched release. It is used
  for secp256k1 signing; the advisory concerns lenient signature decoding on verification, a path
  this wallet does not take. Revisit when wharfkit ships a fix.

## Accepted risks

- **Buoy request key is stored in plaintext.** It only decrypts incoming request payloads and cannot
  sign anything. Encrypting it under the wallet password would break dApp sessions while the wallet
  is locked, which is the whole point of the session socket. Same trade-off Anchor Desktop makes.
- **Desktop-compatible backups use weak crypto.** The `anchor.v2.storage` format is crypto-js
  PBKDF2-SHA1 with 4,500 rounds and unauthenticated AES-CBC. It is opt-in per export, warned about
  in the UI, and only exists so a wallet can move to Anchor Desktop. The default export uses the
  strong envelope.
- **A malicious page can try to spam prompt windows** by posting request URIs. `request:open` is
  rate limited to 5 requests per 10 seconds per sender origin, and every request still needs a user
  decision.

## Open items before release

- `window.nussio` provider is still a stub; it needs per-origin permission prompts and a method
  allowlist before it is wired to `provider:call`.
- Dependency audit and a review of storage migrations from every shipped version.
- Firefox host permissions should become optional.
