# ADR-0003: Transaction pipeline and Greymass Fuel cosigning

Status: accepted (2026-09-05)

## Context

Every on-chain form (send, stake, unstake, claim, later PowerUp/REX/RAM/voting) needs the same
steps: fetch ABIs, set TAPOS, optionally get the transaction cosigned by Greymass Fuel, sign with the
wallet key, broadcast, and turn the outcome into something the UI can render. Anchor desktop did
this inside `EOSHandler` with three libraries; the extension has one (`@wharfkit/antelope`) and the
signing key only exists inside the service worker.

## Decision

- Pure helpers in `src/lib/antelope/transaction.ts` (build, sign, decode, export, parse, error
  taxonomy) and `src/lib/antelope/fuel.ts` (endpoint lookup, HTTP request, response validation).
  Both are unit tested without a network.
- One service, `transaction.service.ts`, runs in the service worker and is the only place that
  touches private keys (`signingKeyFor`). Pages call `transact`, `broadcast`, `inspect`,
  `hasContract` over the proxy-service bridge and receive plain JSON results.
- `transact` returns a discriminated union (`success | unsigned | fee_required | error`). The UI
  state machine (`TransactionResultDialog`) renders exactly these four states; forms never
  interpret raw chain errors.
- Fuel is attempted for chains with the `greymassfuel` feature (endpoint map by chain id, or the
  configured node when it is a greymass.com host). The unsigned transaction is sent as an ESR
  payload; a `200` answer is validated with the same rules as desktop's `ValidateFuel` (noop first,
  original actions byte-identical, fee transfer only to `fuel.gm` and only from the signer) before
  the cosigned transaction is signed. A `402` answer becomes `fee_required` unless the user
  accepted the fee or `settings.transactionFees` is on. Any other Fuel failure falls back to a
  normal user-paid transaction.
- Watch and cold wallets never sign: `transact` returns an `unsigned` result carrying the
  desktop-compatible `{contracts, transaction}` file, the raw transaction JSON, and an `esr:` link
  (zlib via pako) for QR hand-off.
- Expiration is 120 s when signing here and 3600 s for unsigned exports.
- ABIs are cached in `local:abis` for 15 minutes, keyed `chainId:account`.

## Consequences

- Adding a new on-chain action is a form that produces `ActionInput[]` and calls
  `useTransact().run(actions)`; no new signing code.
- Fuel validation rejects any response that changes the requested actions; users see
  `fuel_invalid` instead of signing something unexpected.
- Explorer links default to Unicove per chain and can be overridden per chain in
  `settings.blockExplorers` with a `{id}` template.
