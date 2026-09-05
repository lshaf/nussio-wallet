import { createProxyService, registerService } from '@webext-core/proxy-service';
import { Name, PrivateKey } from '@wharfkit/antelope';
import { PlaceholderName, SigningRequest } from '@wharfkit/signing-request';
import { clientFor } from '@/lib/antelope/client';
import { samePublicKey } from '@/lib/antelope/keys';
import { zlib } from '@/lib/antelope/esr';
import { loadAbis } from '@/lib/antelope/transaction';
import { blockchainsItem, pendingItem } from '@/lib/storage/items';
import { accountNameSchema, type Blockchain, type PendingState } from '@/lib/storage/schemas';
import { readerFor } from './transaction.service';
import { walletService } from './wallet.service';

const RAM_BYTES = 3000;

export type PendingAccountStatus = 'available' | 'taken' | 'awaiting' | 'ready' | 'mismatch';

export interface PendingAccount {
  chainId: string;
  account: string;
  active: string;
  owner: string;
  request: string;
  createdAt: number;
}

export interface PendingCreated {
  account: PendingAccount;
  ownerKey: string;
  activeKey: string;
}

export interface PendingService {
  list(): Promise<PendingAccount[]>;
  checkName(chainId: string, account: string): Promise<PendingAccountStatus>;
  create(chainId: string, account: string, password: string): Promise<PendingCreated>;
  status(chainId: string, account: string): Promise<PendingAccountStatus>;
  claim(chainId: string, account: string): Promise<void>;
  remove(chainId: string, account: string): Promise<PendingAccount[]>;
}

const SERVICE_KEY = 'PendingService';

async function chainFor(chainId: string): Promise<Blockchain> {
  const chain = (await blockchainsItem.getValue()).find((entry) => entry.chainId === chainId);
  if (!chain) throw new Error('unknown_chain');
  return chain;
}

async function accountExists(chain: Blockchain, account: string): Promise<boolean> {
  try {
    await clientFor(chain.node).v1.chain.get_account(account);
    return true;
  } catch {
    return false;
  }
}

function authority(publicKey: string): Record<string, unknown> {
  return {
    threshold: 1,
    keys: [{ key: publicKey, weight: 1 }],
    accounts: [],
    waits: [],
  };
}

async function buildRequest(
  chain: Blockchain,
  account: string,
  ownerKey: string,
  activeKey: string,
): Promise<string> {
  const creator = String(PlaceholderName);
  const actions = [
    {
      account: chain.systemContract,
      name: 'newaccount',
      authorization: [{ actor: creator, permission: 'active' }],
      data: {
        creator,
        name: account,
        owner: authority(ownerKey),
        active: authority(activeKey),
      },
    },
    {
      account: chain.systemContract,
      name: 'buyrambytes',
      authorization: [{ actor: creator, permission: 'active' }],
      data: { payer: creator, receiver: account, bytes: RAM_BYTES },
    },
  ];
  const abis = await loadAbis(
    readerFor(chain),
    actions.map((action) => action.account),
  );
  const request = await SigningRequest.create(
    { chainId: chain.chainId, actions },
    {
      zlib,
      abiProvider: {
        getAbi: async (name) => {
          const abi = abis[String(name)];
          if (!abi) throw new Error('missing_abi');
          return abi;
        },
      },
    },
  );
  return request.encode(true, false);
}

async function writePending(accounts: PendingAccount[]): Promise<void> {
  const state: PendingState = { accounts };
  await pendingItem.setValue(state);
}

export const pendingService: PendingService = {
  async list() {
    return (await pendingItem.getValue()).accounts;
  },

  async checkName(chainId, account) {
    accountNameSchema.parse(account);
    const chain = await chainFor(chainId);
    return (await accountExists(chain, account)) ? 'taken' : 'available';
  },

  async create(chainId, account, password) {
    accountNameSchema.parse(account);
    const chain = await chainFor(chainId);
    if (await accountExists(chain, account)) throw new Error('name_taken');
    const owner = PrivateKey.generate('K1');
    const active = PrivateKey.generate('K1');
    const ownerPublic = String(owner.toPublic());
    const activePublic = String(active.toPublic());
    await walletService.importKey(active.toWif(), password);
    const request = await buildRequest(chain, account, ownerPublic, activePublic);
    const entry: PendingAccount = {
      chainId,
      account,
      active: activePublic,
      owner: ownerPublic,
      request,
      createdAt: Date.now(),
    };
    const accounts = (await pendingItem.getValue()).accounts.filter(
      (known) => !(known.chainId === chainId && known.account === account),
    );
    accounts.push(entry);
    await writePending(accounts);
    return { account: entry, ownerKey: owner.toWif(), activeKey: active.toWif() };
  },

  async status(chainId, account) {
    const chain = await chainFor(chainId);
    const entry = (await pendingItem.getValue()).accounts.find(
      (known) => known.chainId === chainId && known.account === account,
    );
    if (!entry) throw new Error('unknown_pending');
    let permissions;
    try {
      const result = await clientFor(chain.node).v1.chain.get_account(account);
      permissions = result.permissions;
    } catch {
      return 'awaiting';
    }
    const matches = (name: string, publicKey: string): boolean =>
      permissions
        .filter((permission) => String(permission.perm_name) === name)
        .some((permission) =>
          permission.required_auth.keys.some((key) => samePublicKey(String(key.key), publicKey)),
        );
    return matches('owner', entry.owner) && matches('active', entry.active) ? 'ready' : 'mismatch';
  },

  async claim(chainId, account) {
    const entry = (await pendingItem.getValue()).accounts.find(
      (known) => known.chainId === chainId && known.account === account,
    );
    if (!entry) throw new Error('unknown_pending');
    await walletService.addWallets([
      {
        account: Name.from(account).toString(),
        authorization: 'active',
        chainId,
        pubkey: entry.active,
        mode: 'hot',
      },
    ]);
    await pendingService.remove(chainId, account);
  },

  async remove(chainId, account) {
    const accounts = (await pendingItem.getValue()).accounts.filter(
      (known) => !(known.chainId === chainId && known.account === account),
    );
    await writePending(accounts);
    return accounts;
  },
};

export function registerPendingService(): void {
  registerService(SERVICE_KEY, pendingService);
}

export function usePendingService(): PendingService {
  return createProxyService<PendingService>(SERVICE_KEY);
}
