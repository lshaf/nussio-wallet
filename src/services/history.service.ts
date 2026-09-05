import { createProxyService, registerService } from '@webext-core/proxy-service';
import { z } from 'zod';
import { historyEndpointFor } from '@/lib/antelope/history';
import { parseAsset } from '@/lib/antelope/format';
import { blockchainsItem, settingsItem } from '@/lib/storage/items';
import type { Blockchain } from '@/lib/storage/schemas';

export interface HistoryAction {
  id: string;
  transactionId: string;
  blockNum: number;
  timestamp: string;
  contract: string;
  action: string;
  actor: string;
  summary: string;
  transfer: { from: string; to: string; quantity: string; memo: string } | null;
  data: Record<string, unknown>;
}

export interface HistoryPage {
  chainId: string;
  account: string;
  endpoint: string;
  actions: HistoryAction[];
  total: number;
}

export interface HistoryService {
  getActions(
    chainId: string,
    account: string,
    options?: { skip?: number; limit?: number },
  ): Promise<HistoryPage>;
}

const SERVICE_KEY = 'HistoryService';

const responseSchema = z.object({
  total: z.object({ value: z.number() }).optional(),
  actions: z.array(
    z.object({
      timestamp: z.string(),
      block_num: z.number(),
      trx_id: z.string(),
      global_sequence: z.union([z.number(), z.string()]).optional(),
      act: z.object({
        account: z.string(),
        name: z.string(),
        authorization: z.array(z.object({ actor: z.string(), permission: z.string() })).default([]),
        data: z.record(z.string(), z.unknown()).default({}),
      }),
    }),
  ),
});

const transferSchema = z.object({
  from: z.string(),
  to: z.string(),
  quantity: z.string(),
  memo: z.string().default(''),
});

async function chainFor(chainId: string): Promise<Blockchain> {
  const chain = (await blockchainsItem.getValue()).find((entry) => entry.chainId === chainId);
  if (!chain) throw new Error('unknown_chain');
  return chain;
}

function summarize(contract: string, action: string, data: Record<string, unknown>): string {
  const transfer = transferSchema.safeParse(data);
  if (action === 'transfer' && transfer.success) {
    return `${transfer.data.from} → ${transfer.data.to} ${transfer.data.quantity}`;
  }
  return `${contract}::${action}`;
}

export const historyService: HistoryService = {
  async getActions(chainId, account, options = {}) {
    const chain = await chainFor(chainId);
    const settings = await settingsItem.getValue();
    const endpoint = historyEndpointFor(chain, settings);
    if (!endpoint) throw new Error('history_unavailable');
    const limit = options.limit ?? 25;
    const skip = options.skip ?? 0;
    const url = `${endpoint}/v2/history/get_actions?account=${encodeURIComponent(account)}&limit=${limit}&skip=${skip}&sort=desc`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('history_unavailable');
    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error('history_unavailable');
    const threshold = settings.filterSpamTransfersUnder;
    const actions = parsed.data.actions
      .map((entry, index) => {
        const data = entry.act.data;
        const transfer = transferSchema.safeParse(data);
        return {
          id: String(entry.global_sequence ?? `${entry.trx_id}-${index}`),
          transactionId: entry.trx_id,
          blockNum: entry.block_num,
          timestamp: entry.timestamp,
          contract: entry.act.account,
          action: entry.act.name,
          actor: entry.act.authorization[0]?.actor ?? '',
          summary: summarize(entry.act.account, entry.act.name, data),
          transfer: transfer.success ? transfer.data : null,
          data,
        };
      })
      .filter((entry) => {
        if (threshold <= 0 || !entry.transfer || entry.transfer.to !== account) return true;
        try {
          return parseAsset(entry.transfer.quantity).amount >= threshold;
        } catch {
          return true;
        }
      });
    return {
      chainId,
      account,
      endpoint,
      actions,
      total: parsed.data.total?.value ?? actions.length,
    };
  },
};

export function registerHistoryService(): void {
  registerService(SERVICE_KEY, historyService);
}

export function useHistoryService(): HistoryService {
  return createProxyService<HistoryService>(SERVICE_KEY);
}
