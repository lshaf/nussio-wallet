# ADR-0004: Backup file format and desktop interoperability

Status: accepted (2026-09-05)

## Context

Anchor Desktop writes a single JSON backup holding networks, wallets, settings, pending records and
one encrypted keyring blob (`storage.data`). That blob uses crypto-js: PBKDF2-SHA1 with 4,500
iterations and AES-256-CBC, with the salt and IV hex-prefixed onto the base64 ciphertext. The
extension encrypts its keyring with PBKDF2-SHA256 at 600,000 iterations and AES-256-GCM
(`KeyringEnvelope`, ADR-0002). Users need to move wallets in both directions without downgrading
the encryption of every backup they take.

## Decision

- One file layout, the desktop one: `networks[]`, `pending`, `settings`, `storage`, `wallets[]`,
  each entry tagged with a `schema` string. Field mapping lives in `src/lib/backup/format.ts` and
  is unit tested (`_id` ↔ `id`, `authority` ↔ `authorization`, `supportedContracts` ↔ `features`,
  `chainRamSymbol` ↔ `ramSymbol`, `refreshRate` ↔ `refreshRateSeconds`, desktop's
  `"<chain _id>:<contract>:<SYMBOL>"` custom-token strings ↔ `CustomToken` rows).
- Two export formats, chosen by the user:
  - `nussio` (default) writes `storage.schema = "nussio.v1.storage"` and puts the serialized
    `KeyringEnvelope` in `storage.data`. Strong KDF, readable only by this extension.
  - `desktop` writes `storage.schema = "anchor.v2.storage"` and a crypto-js blob, so Anchor Desktop
    can restore it. The UI states that this uses Anchor's older, weaker encryption.
- Import auto-detects: a `storage.data` that parses as a `KeyringEnvelope` is decrypted with
  WebCrypto, anything else is treated as a legacy crypto-js blob. `anchor.v1.wallet` entries carry
  their own per-wallet blob; each is decrypted with the same backup password and merged, which is
  the v1 → v2 storage upgrade desktop ran as a separate screen.
- Restore always merges. Keys are matched by public key, wallets by
  `(chainId, account, authorization)`, chains by chain id, contacts by account name. Nothing is
  deleted, and the keyring is re-encrypted with the current wallet password (or, on a fresh
  install, with the backup password, which then becomes the wallet password).
- Export never leaves plaintext keys in the file, and requires the wallet password, so it doubles
  as the confirm-with-password step. It stamps `settings.lastBackupAt`, which drives the backup
  reminder in Tools → Pending.

## Consequences

- A desktop backup restores here and a `desktop`-format export restores there, but the weaker
  format is opt-in per export instead of being the only option.
- Legacy decryption stays a lazy `import('crypto-js')`, so the 60 kB dependency is not in the
  common bundle.
- Ledger `paths` are carried through the file shape but always empty until WebHID lands (M9); the
  field is written so desktop backups round-trip without losing it.
