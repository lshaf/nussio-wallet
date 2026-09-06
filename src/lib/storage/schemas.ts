import { z } from 'zod';
import { keyEntrySchema, keyringEnvelopeSchema } from '@/lib/crypto/keyring';

export const chainIdSchema = z.string().regex(/^[0-9a-f]{64}$/);
export const accountNameSchema = z.string().regex(/^[a-z1-5.]{1,12}$/);
export const permissionNameSchema = z.string().regex(/^[a-z1-5.]{1,12}$/);

export const walletModeSchema = z.enum(['hot', 'cold', 'watch', 'ledger', 'auth']);
export type WalletMode = z.infer<typeof walletModeSchema>;

export const chainFeatureSchema = z.enum([
  'bidname',
  'customtokens',
  'delphioracle',
  'greymassfuel',
  'powerup',
  'producerinfo',
  'proposals',
  'regproxyinfo',
  'rex',
]);
export type ChainFeature = z.infer<typeof chainFeatureSchema>;

export const blockchainSchema = z.object({
  id: z.string().min(1),
  chainId: chainIdSchema,
  name: z.string().min(1),
  node: z.string().url(),
  symbol: z.string().min(1),
  keyPrefix: z.string().default('EOS'),
  testnet: z.boolean().default(false),
  tokenPrecision: z.number().int().min(0).max(18).default(4),
  tokenContract: accountNameSchema.default('eosio.token'),
  systemContract: accountNameSchema.default('eosio'),
  ramSymbol: z.string().optional(),
  stakedResources: z.boolean().default(true),
  voteDecayPeriodWeeks: z.number().int().positive().default(52),
  features: z.array(chainFeatureSchema).default([]),
  custom: z.boolean().default(false),
});
export type Blockchain = z.infer<typeof blockchainSchema>;
export type BlockchainInput = z.input<typeof blockchainSchema>;

export const walletSchema = z
  .object({
    account: accountNameSchema,
    authorization: permissionNameSchema,
    chainId: chainIdSchema,
    pubkey: z.string().default(''),
    mode: walletModeSchema,
    path: z.string().optional(),
  })
  .refine(
    (wallet) => wallet.mode === 'watch' || wallet.mode === 'auth' || wallet.pubkey.length > 0,
    {
      message: 'pubkey_required',
      path: ['pubkey'],
    },
  );
export type Wallet = z.infer<typeof walletSchema>;

export const settingsSchema = z.object({
  lang: z.string().default('en-US'),
  langChosen: z.boolean().default(false),
  walletInitialized: z.boolean().default(false),
  chainId: chainIdSchema.nullable().default(null),
  account: accountNameSchema.nullable().default(null),
  authorization: permissionNameSchema.nullable().default(null),
  enabledChains: z.array(chainIdSchema).default([]),
  pinnedChains: z.array(chainIdSchema).default([]),
  recentWallets: z
    .record(
      chainIdSchema,
      z.object({ account: accountNameSchema, authorization: permissionNameSchema }),
    )
    .default({}),
  advancedOptions: z.boolean().default(false),
  advancedPermissions: z.boolean().default(false),
  displayTestNetworks: z.boolean().default(true),
  displayResourcesAvailable: z.boolean().default(true),
  idleTimeoutMinutes: z.number().int().min(0).default(15),
  refreshRateSeconds: z.number().int().min(0).default(30),
  allowSigningRequests: z.boolean().default(true),
  allowSiteConnections: z.boolean().default(true),
  allowDangerousTransactions: z.boolean().default(false),
  promptCloseOnComplete: z.boolean().default(true),
  transactionFees: z.boolean().default(false),
  skipLinkModal: z.boolean().default(false),
  blockExplorers: z.record(chainIdSchema, z.string()).default({}),
  recentBids: z.record(chainIdSchema, z.array(accountNameSchema)).default({}),
  recentContracts: z.record(chainIdSchema, z.array(accountNameSchema)).default({}),
  historyEndpoints: z.record(chainIdSchema, z.string()).default({}),
  anchorLinkServiceUrl: z.string().default('cb.anchor.link'),
  lastBackupAt: z.number().nullable().default(null),
  filterSpamTransfersUnder: z.number().min(0).default(0),
});
export type Settings = z.infer<typeof settingsSchema>;

export const connectedSiteSchema = z.object({
  origin: z.string().min(1).max(2048),
  chainId: chainIdSchema,
  actor: accountNameSchema,
  permission: permissionNameSchema,
  createdAt: z.number(),
  lastUsedAt: z.number(),
});
export type ConnectedSite = z.infer<typeof connectedSiteSchema>;

export const sessionSchema = z.object({
  network: chainIdSchema,
  actor: accountNameSchema,
  permission: permissionNameSchema,
  publicKey: z.string().min(1),
  name: z.string().min(1),
  created: z.number(),
  lastUsed: z.number(),
});
export type Session = z.infer<typeof sessionSchema>;

export const sessionsStateSchema = z.object({
  linkId: z.string().nullable().default(null),
  linkUrl: z.string().default('cb.anchor.link'),
  requestKey: z.string().nullable().default(null),
  sessions: z.array(sessionSchema).default([]),
});
export type SessionsState = z.infer<typeof sessionsStateSchema>;

export const linkStatusSchema = z.object({
  connected: z.boolean().default(false),
  lastOpen: z.number().nullable().default(null),
  lastClose: z.number().nullable().default(null),
  lastMessage: z.number().nullable().default(null),
  lastError: z.string().nullable().default(null),
  lastErrorAt: z.number().nullable().default(null),
});
export type LinkStatus = z.infer<typeof linkStatusSchema>;

export const abiCacheEntrySchema = z.object({
  abi: z.unknown(),
  fetchedAt: z.number(),
});
export type AbiCacheEntry = z.infer<typeof abiCacheEntrySchema>;

export const contactSchema = z.object({
  accountName: accountNameSchema,
  label: z.string().default(''),
  defaultMemo: z.string().default(''),
});
export type Contact = z.infer<typeof contactSchema>;

export const customTokenSchema = z.object({
  chainId: chainIdSchema,
  contract: accountNameSchema,
  symbol: z.string().regex(/^[A-Z]{1,7}$/),
  precision: z.number().int().min(0).max(18).optional(),
});
export type CustomToken = z.infer<typeof customTokenSchema>;

export const pendingAccountCreateSchema = z.object({
  chainId: chainIdSchema,
  account: accountNameSchema,
  active: z.string(),
  owner: z.string(),
  request: z.string(),
  createdAt: z.number(),
});

export const pendingStateSchema = z.object({
  accounts: z.array(pendingAccountCreateSchema).default([]),
});
export type PendingState = z.infer<typeof pendingStateSchema>;

export const requestStatusSchema = z.enum([
  'received',
  'resolving',
  'ready',
  'signing',
  'signed',
  'broadcasting',
  'callback',
  'done',
  'error',
  'cancelled',
]);
export type RequestStatus = z.infer<typeof requestStatusSchema>;

export const requestSignerSchema = z.object({
  chainId: chainIdSchema,
  account: accountNameSchema,
  authorization: permissionNameSchema,
});
export type RequestSigner = z.infer<typeof requestSignerSchema>;

export const pendingRequestSchema = z.object({
  id: z.string().min(1),
  uri: z.string().min(1),
  receivedAt: z.number(),
  requester: z.string().nullable().default(null),
  status: requestStatusSchema,
  error: z.string().optional(),
  chainId: chainIdSchema.optional(),
  signer: requestSignerSchema.optional(),
  windowId: z.number().optional(),
  outcome: z.unknown().optional(),
  prepared: z.unknown().optional(),
});
export type PendingRequest = z.infer<typeof pendingRequestSchema>;

export { keyEntrySchema, keyringEnvelopeSchema };
