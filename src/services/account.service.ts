import { createProxyService, registerService } from '@webext-core/proxy-service';
import { Asset, Name } from '@wharfkit/antelope';
import { z } from 'zod';
import { clientFor } from '@/lib/antelope/client';
import { samePublicKey } from '@/lib/antelope/keys';
import { blockchainsItem, customTokensItem } from '@/lib/storage/items';
import type { Blockchain } from '@/lib/storage/schemas';

export interface PermissionSummary {
  name: string;
  parent: string;
  threshold: number;
  keys: { key: string; weight: number }[];
  accounts: { actor: string; permission: string; weight: number }[];
}

export interface AccountSummary {
  account: string;
  chainId: string;
  balance?: string;
  permissions: PermissionSummary[];
}

export interface AccountMatch {
  account: string;
  permission: string;
}

export interface ResourceLimit {
  used: number;
  available: number;
  max: number;
}

export interface AccountData {
  account: string;
  chainId: string;
  fetchedAt: number;
  headBlockNum: number;
  balance: string;
  cpu: ResourceLimit;
  net: ResourceLimit;
  ram: { used: number; quota: number };
  totalResources: { cpu: string; net: string } | null;
  selfDelegated: { cpu: string; net: string } | null;
  delegatedToOthers: { cpu: string; net: string } | null;
  refund: { cpu: string; net: string; requestTime: string } | null;
  voter: {
    proxy: string;
    producers: string[];
    staked: number;
    lastVoteWeight: number;
    proxiedVoteWeight: number;
    isProxy: boolean;
  } | null;
  rex: { balance: string; voteStake: string; fund: string | null } | null;
  permissions: PermissionSummary[];
}

export interface TokenBalance {
  contract: string;
  symbol: string;
  amount: string;
}

export interface AccountService {
  getAccount(chainId: string, account: string): Promise<AccountSummary | undefined>;
  getAccountData(chainId: string, account: string): Promise<AccountData | undefined>;
  getBalances(chainId: string, account: string): Promise<TokenBalance[]>;
  findAccountsByKey(chainId: string, publicKey: string): Promise<AccountMatch[]>;
  getDelegations(chainId: string, account: string): Promise<Delegation[]>;
}

export interface Delegation {
  to: string;
  cpu: string;
  net: string;
}

const SERVICE_KEY = 'AccountService';

const delbandRowSchema = z.object({
  from: z.string(),
  to: z.string(),
  net_weight: z.string(),
  cpu_weight: z.string(),
});

const rexFundRowSchema = z.object({ owner: z.string(), balance: z.string() });

async function chainFor(chainId: string): Promise<Blockchain> {
  const chain = (await blockchainsItem.getValue()).find((entry) => entry.chainId === chainId);
  if (!chain) throw new Error('unknown_chain');
  return chain;
}

function limit(value: { used: unknown; available: unknown; max: unknown }): ResourceLimit {
  return { used: Number(value.used), available: Number(value.available), max: Number(value.max) };
}

function sumWeights(
  rows: { cpu_weight: string; net_weight: string }[],
): { cpu: string; net: string } | null {
  const first = rows[0];
  if (!first) return null;
  const cpuSymbol = Asset.from(first.cpu_weight).symbol;
  const netSymbol = Asset.from(first.net_weight).symbol;
  const cpu = rows.reduce((total, row) => total + Asset.from(row.cpu_weight).value, 0);
  const net = rows.reduce((total, row) => total + Asset.from(row.net_weight).value, 0);
  return { cpu: String(Asset.from(cpu, cpuSymbol)), net: String(Asset.from(net, netSymbol)) };
}

async function fetchDelegatedToOthers(chain: Blockchain, account: string) {
  try {
    const result = await clientFor(chain.node).v1.chain.get_table_rows({
      code: chain.systemContract,
      scope: account,
      table: 'delband',
      json: true,
      limit: 500,
    });
    const rows = z
      .array(delbandRowSchema)
      .parse(result.rows)
      .filter((row) => row.to !== account);
    return sumWeights(rows);
  } catch {
    return null;
  }
}

async function fetchRexFund(chain: Blockchain, account: string): Promise<string | null> {
  try {
    const result = await clientFor(chain.node).v1.chain.get_table_rows({
      code: chain.systemContract,
      scope: chain.systemContract,
      table: 'rexfund',
      json: true,
      lower_bound: Name.from(account),
      upper_bound: Name.from(account),
      limit: 1,
    });
    const row = z.array(rexFundRowSchema).parse(result.rows)[0];
    return row && row.owner === account ? row.balance : null;
  } catch {
    return null;
  }
}

function coreBalanceFor(chain: Blockchain, value: unknown): string | null {
  if (value === undefined || value === null) return null;
  try {
    const asset = Asset.from(String(value));
    return asset.symbol.name === chain.symbol ? String(asset) : null;
  } catch {
    return null;
  }
}

async function fetchSystemBalance(chain: Blockchain, account: string): Promise<string> {
  try {
    const balances = await clientFor(chain.node).v1.chain.get_currency_balance(
      chain.tokenContract,
      account,
      chain.symbol,
    );
    const first = balances[0];
    if (first) return String(first);
  } catch {
    return String(Asset.from(0, `${chain.tokenPrecision},${chain.symbol}`));
  }
  return String(Asset.from(0, `${chain.tokenPrecision},${chain.symbol}`));
}

function summarizePermissions(
  permissions: {
    perm_name: unknown;
    parent: unknown;
    required_auth: {
      threshold: unknown;
      keys: { key: unknown; weight: unknown }[];
      accounts: { permission: { actor: unknown; permission: unknown }; weight: unknown }[];
    };
  }[],
): PermissionSummary[] {
  return permissions.map((permission) => ({
    name: String(permission.perm_name),
    parent: String(permission.parent),
    threshold: Number(permission.required_auth.threshold),
    keys: permission.required_auth.keys.map((entry) => ({
      key: String(entry.key),
      weight: Number(entry.weight),
    })),
    accounts: permission.required_auth.accounts.map((entry) => ({
      actor: String(entry.permission.actor),
      permission: String(entry.permission.permission),
      weight: Number(entry.weight),
    })),
  }));
}

async function findAccountsByKeyViaHistory(
  chainId: string,
  client: ReturnType<typeof clientFor>,
  publicKey: string,
): Promise<AccountMatch[]> {
  let names: string[];
  try {
    const result = await client.v1.history.get_key_accounts(publicKey);
    names = result.account_names.map((name) => String(name));
  } catch {
    return [];
  }
  const matches: AccountMatch[] = [];
  for (const name of names) {
    const summary = await accountService.getAccount(chainId, name);
    for (const permission of summary?.permissions ?? []) {
      if (permission.keys.some((entry) => samePublicKey(entry.key, publicKey))) {
        matches.push({ account: name, permission: permission.name });
      }
    }
  }
  return matches;
}

export const accountService: AccountService = {
  async getAccount(chainId, account) {
    const chain = await chainFor(chainId);
    try {
      const result = await clientFor(chain.node).v1.chain.get_account(account);
      return {
        account: String(result.account_name),
        chainId,
        balance: coreBalanceFor(chain, result.core_liquid_balance) ?? undefined,
        permissions: summarizePermissions(result.permissions),
      };
    } catch {
      return undefined;
    }
  },

  async getAccountData(chainId, account) {
    const chain = await chainFor(chainId);
    let result;
    try {
      result = await clientFor(chain.node).v1.chain.get_account(account);
    } catch {
      return undefined;
    }
    const core = coreBalanceFor(chain, result.core_liquid_balance);
    const [balance, delegatedToOthers, rexFund] = await Promise.all([
      core ? Promise.resolve(core) : fetchSystemBalance(chain, account),
      chain.stakedResources ? fetchDelegatedToOthers(chain, account) : Promise.resolve(null),
      chain.features.includes('rex') ? fetchRexFund(chain, account) : Promise.resolve(null),
    ]);
    return {
      account: String(result.account_name),
      chainId,
      fetchedAt: Date.now(),
      headBlockNum: Number(result.head_block_num),
      balance,
      cpu: limit(result.cpu_limit),
      net: limit(result.net_limit),
      ram: { used: Number(result.ram_usage), quota: Number(result.ram_quota) },
      totalResources: result.total_resources
        ? {
            cpu: String(result.total_resources.cpu_weight),
            net: String(result.total_resources.net_weight),
          }
        : null,
      selfDelegated: result.self_delegated_bandwidth
        ? {
            cpu: String(result.self_delegated_bandwidth.cpu_weight),
            net: String(result.self_delegated_bandwidth.net_weight),
          }
        : null,
      delegatedToOthers,
      refund: result.refund_request
        ? {
            cpu: String(result.refund_request.cpu_amount),
            net: String(result.refund_request.net_amount),
            requestTime: String(result.refund_request.request_time),
          }
        : null,
      voter: result.voter_info
        ? {
            proxy: String(result.voter_info.proxy),
            producers: result.voter_info.producers.map((name) => String(name)),
            staked: Number(result.voter_info.staked ?? 0),
            lastVoteWeight: Number(result.voter_info.last_vote_weight),
            proxiedVoteWeight: Number(result.voter_info.proxied_vote_weight),
            isProxy: Boolean(result.voter_info.is_proxy),
          }
        : null,
      rex: result.rex_info
        ? {
            balance: String(result.rex_info.rex_balance),
            voteStake: String(result.rex_info.vote_stake),
            fund: rexFund,
          }
        : null,
      permissions: summarizePermissions(result.permissions),
    };
  },

  async getBalances(chainId, account) {
    const chain = await chainFor(chainId);
    const client = clientFor(chain.node);
    const tokens = (await customTokensItem.getValue()).filter((token) => token.chainId === chainId);
    const targets = [{ contract: chain.tokenContract, symbol: chain.symbol }, ...tokens];
    const balances = await Promise.all(
      targets.map(async (token) => {
        try {
          const result = await client.v1.chain.get_currency_balance(
            token.contract,
            account,
            token.symbol,
          );
          const first = result[0];
          return {
            contract: token.contract,
            symbol: token.symbol,
            amount: first ? String(first) : null,
          };
        } catch {
          return { contract: token.contract, symbol: token.symbol, amount: null };
        }
      }),
    );
    return balances.map((balance) => ({
      contract: balance.contract,
      symbol: balance.symbol,
      amount: balance.amount ?? `0 ${balance.symbol}`,
    }));
  },

  async getDelegations(chainId, account) {
    const chain = await chainFor(chainId);
    const result = await clientFor(chain.node).v1.chain.get_table_rows({
      code: chain.systemContract,
      scope: account,
      table: 'delband',
      json: true,
      limit: 500,
    });
    return z
      .array(delbandRowSchema)
      .parse(result.rows)
      .filter((row) => row.to !== account)
      .map((row) => ({ to: row.to, cpu: row.cpu_weight, net: row.net_weight }));
  },

  async findAccountsByKey(chainId, publicKey) {
    const chain = await chainFor(chainId);
    const client = clientFor(chain.node);
    try {
      const result = await client.v1.chain.get_accounts_by_authorizers({ keys: [publicKey] });
      const seen = new Set<string>();
      const matches: AccountMatch[] = [];
      for (const row of result.accounts) {
        const match = {
          account: String(row.account_name),
          permission: String(row.permission_name),
        };
        const id = `${match.account}@${match.permission}`;
        if (seen.has(id)) continue;
        seen.add(id);
        matches.push(match);
      }
      return matches;
    } catch {
      return findAccountsByKeyViaHistory(chainId, client, publicKey);
    }
  },
};

export function registerAccountService(): void {
  registerService(SERVICE_KEY, accountService);
}

export function useAccountService(): AccountService {
  return createProxyService<AccountService>(SERVICE_KEY);
}
