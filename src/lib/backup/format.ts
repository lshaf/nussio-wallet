import { z } from 'zod';
import { keyringEnvelopeSchema, type KeyringEnvelope } from '@/lib/crypto/keyring';
import {
  blockchainSchema,
  chainFeatureSchema,
  contactSchema,
  customTokenSchema,
  walletSchema,
  type Blockchain,
  type Contact,
  type CustomToken,
  type Settings,
  type Wallet,
} from '@/lib/storage/schemas';

export const NETWORK_SCHEMA = 'anchor.v2.network';
export const PENDING_SCHEMA = 'anchor.v1.pending';
export const SETTINGS_SCHEMA = 'anchor.v2.settings';
export const STORAGE_SCHEMA = 'anchor.v2.storage';
export const WALLET_SCHEMA = 'anchor.v2.wallet';
export const NUSSIO_STORAGE_SCHEMA = 'nussio.v1.storage';

const entrySchema = z.object({ schema: z.string(), data: z.unknown() });

export const backupStorageSchema = z.object({
  data: z.string().nullable().default(null),
  keys: z.array(z.string()).default([]),
  paths: z.record(z.string(), z.string()).default({}),
});
export type BackupStorage = z.infer<typeof backupStorageSchema>;

export const backupFileSchema = z.object({
  networks: z.array(entrySchema).default([]),
  pending: entrySchema.optional(),
  settings: entrySchema.optional(),
  storage: z.object({ schema: z.string(), data: backupStorageSchema }).optional(),
  wallets: z.array(entrySchema).default([]),
});
export type BackupFile = z.infer<typeof backupFileSchema>;

const networkDataSchema = z.object({
  _id: z.string().optional(),
  chainId: z.string(),
  name: z.string().optional(),
  node: z.string().optional(),
  symbol: z.string().optional(),
  keyPrefix: z.string().optional(),
  testnet: z.boolean().optional(),
  tokenPrecision: z.number().optional(),
  tokenContract: z.string().optional(),
  systemContract: z.string().optional(),
  chainRamSymbol: z.string().optional(),
  stakedResources: z.boolean().optional(),
  voteDecayPeriod: z.number().optional(),
  supportedContracts: z.array(z.string()).optional(),
});

const walletDataSchema = z.object({
  account: z.string(),
  authority: z.string().optional(),
  authorization: z.string().optional(),
  chainId: z.string(),
  mode: z.string().optional(),
  path: z.string().optional(),
  pubkey: z.string().optional(),
  data: z.string().optional(),
});

const settingsDataSchema = z.object({
  account: z.string().optional(),
  authorization: z.string().optional(),
  chainId: z.union([z.string(), z.literal(false)]).optional(),
  blockchains: z.array(z.string()).optional(),
  pinnedBlockchains: z.array(z.string()).optional(),
  blockExplorers: z.record(z.string(), z.string()).optional(),
  contacts: z.array(z.unknown()).optional(),
  customTokens: z.array(z.string()).optional(),
  lang: z.string().optional(),
  advancedOptions: z.boolean().optional(),
  advancedPermissions: z.boolean().optional(),
  displayTestNetworks: z.boolean().optional(),
  displayResourcesAvailable: z.boolean().optional(),
  allowSigningRequests: z.boolean().optional(),
  allowDangerousTransactions: z.boolean().optional(),
  promptCloseOnComplete: z.boolean().optional(),
  transactionFees: z.boolean().optional(),
  skipLinkModal: z.boolean().optional(),
  anchorLinkServiceUrl: z.string().optional(),
  refreshRate: z.number().optional(),
  filterSpamTransfersUnder: z.number().optional(),
  lastBackupDate: z.union([z.number(), z.literal(false)]).optional(),
});

export function slugFor(chain: Pick<Blockchain, 'name' | 'chainId'>): string {
  const slug = chain.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug.length > 0 ? slug : chain.chainId.slice(0, 12);
}

export function chainToNetwork(chain: Blockchain): { schema: string; data: unknown } {
  return {
    schema: NETWORK_SCHEMA,
    data: {
      _id: chain.id,
      chainId: chain.chainId,
      name: chain.name,
      node: chain.node,
      symbol: chain.symbol,
      keyPrefix: chain.keyPrefix,
      testnet: chain.testnet,
      tokenPrecision: chain.tokenPrecision,
      tokenContract: chain.tokenContract,
      systemContract: chain.systemContract,
      chainRamSymbol: chain.ramSymbol,
      stakedResources: chain.stakedResources,
      voteDecay: chain.voteDecayPeriodWeeks > 0,
      voteDecayPeriod: chain.voteDecayPeriodWeeks,
      supportedContracts: chain.features,
    },
  };
}

export function networkToChain(input: unknown, known: Blockchain[]): Blockchain | null {
  const parsed = networkDataSchema.safeParse(input);
  if (!parsed.success) return null;
  const data = parsed.data;
  const existing = known.find((chain) => chain.chainId === data.chainId);
  const features = (data.supportedContracts ?? []).flatMap((entry) => {
    const feature = chainFeatureSchema.safeParse(entry);
    return feature.success ? [feature.data] : [];
  });
  const candidate = {
    ...(existing ?? {}),
    id: existing?.id ?? data._id ?? data.chainId.slice(0, 12),
    chainId: data.chainId,
    name: data.name ?? existing?.name ?? data.chainId.slice(0, 8),
    node: data.node ?? existing?.node,
    symbol: data.symbol ?? existing?.symbol,
    keyPrefix: data.keyPrefix ?? existing?.keyPrefix,
    testnet: data.testnet ?? existing?.testnet,
    tokenPrecision: data.tokenPrecision ?? existing?.tokenPrecision,
    tokenContract: data.tokenContract ?? existing?.tokenContract,
    systemContract: data.systemContract ?? existing?.systemContract,
    ramSymbol: data.chainRamSymbol ?? existing?.ramSymbol,
    stakedResources: data.stakedResources ?? existing?.stakedResources,
    voteDecayPeriodWeeks: data.voteDecayPeriod ?? existing?.voteDecayPeriodWeeks,
    features: features.length > 0 ? features : (existing?.features ?? []),
    custom: existing?.custom ?? true,
  };
  const chain = blockchainSchema.safeParse(candidate);
  return chain.success ? chain.data : null;
}

export function walletToEntry(wallet: Wallet): { schema: string; data: unknown } {
  return {
    schema: WALLET_SCHEMA,
    data: {
      account: wallet.account,
      authority: wallet.authorization,
      chainId: wallet.chainId,
      mode: wallet.mode,
      path: wallet.path,
      pubkey: wallet.pubkey,
      type: wallet.path ? 'ledger' : 'key',
    },
  };
}

export interface ImportedWallet {
  wallet: Wallet;
  legacyData?: string;
}

export function entryToWallet(input: unknown): ImportedWallet | null {
  const parsed = walletDataSchema.safeParse(input);
  if (!parsed.success) return null;
  const data = parsed.data;
  const mode = data.path ? 'ledger' : (data.mode ?? (data.pubkey ? 'hot' : 'watch'));
  const wallet = walletSchema.safeParse({
    account: data.account,
    authorization: data.authority ?? data.authorization ?? 'active',
    chainId: data.chainId,
    pubkey: data.pubkey ?? '',
    mode,
    path: data.path,
  });
  if (!wallet.success) return null;
  return { wallet: wallet.data, legacyData: data.data };
}

export function settingsToBackup(settings: Settings): unknown {
  return {
    account: settings.account ?? '',
    authorization: settings.authorization ?? undefined,
    chainId: settings.chainId ?? false,
    blockchains: settings.enabledChains,
    pinnedBlockchains: settings.pinnedChains,
    blockExplorers: settings.blockExplorers,
    lang: settings.lang,
    advancedOptions: settings.advancedOptions,
    advancedPermissions: settings.advancedPermissions,
    displayTestNetworks: settings.displayTestNetworks,
    displayResourcesAvailable: settings.displayResourcesAvailable,
    allowSigningRequests: settings.allowSigningRequests,
    allowDangerousTransactions: settings.allowDangerousTransactions,
    promptCloseOnComplete: settings.promptCloseOnComplete,
    transactionFees: settings.transactionFees,
    skipLinkModal: settings.skipLinkModal,
    anchorLinkServiceUrl: settings.anchorLinkServiceUrl,
    refreshRate: settings.refreshRateSeconds,
    filterSpamTransfersUnder: settings.filterSpamTransfersUnder,
    lastBackupDate: settings.lastBackupAt ?? false,
    recentWallets: settings.recentWallets,
    idleTimeout: settings.idleTimeoutMinutes * 60_000,
    contacts: [],
    customTokens: [],
    walletInit: settings.walletInitialized,
  };
}

export interface ImportedSettings {
  patch: Partial<Settings>;
  contacts: Contact[];
  customTokens: CustomToken[];
}

export function settingsFromBackup(
  input: unknown,
  chains: Blockchain[],
  aliases: Record<string, string> = {},
): ImportedSettings {
  const parsed = settingsDataSchema.safeParse(input);
  if (!parsed.success) return { patch: {}, contacts: [], customTokens: [] };
  const data = parsed.data;
  const patch: Partial<Settings> = {};
  if (data.lang) patch.lang = data.lang;
  if (typeof data.chainId === 'string') patch.chainId = data.chainId;
  if (data.account) patch.account = data.account;
  if (data.authorization) patch.authorization = data.authorization;
  if (data.blockchains) patch.enabledChains = data.blockchains;
  if (data.pinnedBlockchains) patch.pinnedChains = data.pinnedBlockchains;
  if (data.blockExplorers) patch.blockExplorers = data.blockExplorers;
  if (data.advancedOptions !== undefined) patch.advancedOptions = data.advancedOptions;
  if (data.advancedPermissions !== undefined) patch.advancedPermissions = data.advancedPermissions;
  if (data.displayTestNetworks !== undefined) patch.displayTestNetworks = data.displayTestNetworks;
  if (data.displayResourcesAvailable !== undefined)
    patch.displayResourcesAvailable = data.displayResourcesAvailable;
  if (data.allowSigningRequests !== undefined)
    patch.allowSigningRequests = data.allowSigningRequests;
  if (data.allowDangerousTransactions !== undefined)
    patch.allowDangerousTransactions = data.allowDangerousTransactions;
  if (data.promptCloseOnComplete !== undefined)
    patch.promptCloseOnComplete = data.promptCloseOnComplete;
  if (data.transactionFees !== undefined) patch.transactionFees = data.transactionFees;
  if (data.skipLinkModal !== undefined) patch.skipLinkModal = data.skipLinkModal;
  if (data.anchorLinkServiceUrl) patch.anchorLinkServiceUrl = data.anchorLinkServiceUrl;
  if (data.refreshRate !== undefined) patch.refreshRateSeconds = Math.round(data.refreshRate);
  if (data.filterSpamTransfersUnder !== undefined)
    patch.filterSpamTransfersUnder = data.filterSpamTransfersUnder;
  if (typeof data.lastBackupDate === 'number') patch.lastBackupAt = data.lastBackupDate;

  const contacts = (data.contacts ?? []).flatMap((entry) => {
    const contact = contactSchema.safeParse(entry);
    return contact.success ? [contact.data] : [];
  });

  const customTokens = (data.customTokens ?? []).flatMap((entry) => {
    const token = customTokenFromString(entry, chains, aliases);
    return token ? [token] : [];
  });

  return { patch, contacts, customTokens };
}

export function customTokenToString(token: CustomToken, chains: Blockchain[]): string {
  const chain = chains.find((entry) => entry.chainId === token.chainId);
  return `${chain?.id ?? token.chainId}:${token.contract}:${token.symbol}`;
}

export function customTokenFromString(
  value: string,
  chains: Blockchain[],
  aliases: Record<string, string> = {},
): CustomToken | null {
  const [id, contract, symbol] = value.split(':');
  if (!id || !contract || !symbol) return null;
  const chainId = aliases[id];
  const chain = chains.find(
    (entry) => entry.id === id || entry.chainId === id || entry.chainId === chainId,
  );
  if (!chain) return null;
  const token = customTokenSchema.safeParse({ chainId: chain.chainId, contract, symbol });
  return token.success ? token.data : null;
}

export function networkAliases(networks: { data: unknown }[]): Record<string, string> {
  const aliases: Record<string, string> = {};
  for (const network of networks) {
    const parsed = networkDataSchema.safeParse(network.data);
    if (parsed.success && parsed.data._id) aliases[parsed.data._id] = parsed.data.chainId;
  }
  return aliases;
}

export function envelopeFromStorage(data: string): KeyringEnvelope | null {
  try {
    const parsed = keyringEnvelopeSchema.safeParse(JSON.parse(data));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
