import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { blockchainsItem, pendingRequestsItem, settingsItem } from '@/lib/storage/items';
import { settingsSchema, type PendingRequest } from '@/lib/storage/schemas';
import { builtinChains } from '@/lib/antelope/chains';

const open = vi.fn();
vi.mock('./request.service', () => ({
  requestService: {
    open: (uri: string, requester: string | null) => open(uri, requester),
  },
}));

const { handleProviderCall, providerService } = await import('./provider.service');

const JUNGLE4 = builtinChains.find((chain) => chain.id === 'jungle4')!;
const ORIGIN = 'https://dapp.example';

async function seedChain(): Promise<void> {
  await blockchainsItem.setValue([JUNGLE4]);
  await settingsItem.setValue(
    settingsSchema.parse({ enabledChains: [JUNGLE4.chainId], chainId: JUNGLE4.chainId }),
  );
}

function completeWith(record: Partial<PendingRequest>): void {
  open.mockImplementation(async (uri: string, requester: string | null) => {
    const id = 'request-1';
    await pendingRequestsItem.setValue([
      {
        id,
        uri,
        receivedAt: Date.now(),
        status: 'done',
        requester,
        signer: { account: 'teamgreymass', authorization: 'active' },
        chainId: JUNGLE4.chainId,
        ...record,
      } as PendingRequest,
    ]);
    return { id };
  });
}

describe('provider service', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    open.mockReset();
    await seedChain();
  });

  it('refuses unknown methods and calls made while connections are off', async () => {
    await expect(handleProviderCall('evil', [], ORIGIN)).rejects.toThrow('unknown_method');

    await settingsItem.setValue(
      settingsSchema.parse({ enabledChains: [JUNGLE4.chainId], allowSiteConnections: false }),
    );
    await expect(handleProviderCall('login', [], ORIGIN)).rejects.toThrow('connections_disabled');
  });

  it('gates transact and sign behind a connection', async () => {
    await expect(handleProviderCall('transact', [{ actions: [] }], ORIGIN)).rejects.toThrow(
      'not_connected',
    );
    await expect(handleProviderCall('sign', ['esr:gmNgZ'], ORIGIN)).rejects.toThrow(
      'not_connected',
    );
    expect(await handleProviderCall('isConnected', [], ORIGIN)).toBe(false);
  });

  it('records a site once login is approved and forgets it on disconnect', async () => {
    completeWith({});
    expect(await handleProviderCall('login', [], ORIGIN)).toEqual({
      chainId: JUNGLE4.chainId,
      actor: 'teamgreymass',
      permission: 'active',
    });

    const [uri, requester] = open.mock.calls[0]!;
    expect(uri.startsWith('esr:')).toBe(true);
    expect(requester).toBe(ORIGIN);

    expect(await handleProviderCall('isConnected', [], ORIGIN)).toBe(true);
    expect(await handleProviderCall('isConnected', [], 'https://other.example')).toBe(false);
    expect(await providerService.listSites()).toHaveLength(1);

    expect(await handleProviderCall('disconnect', [], ORIGIN)).toBe(true);
    expect(await providerService.listSites()).toEqual([]);
  });

  it('rejects a login the user cancels and a chain that is not enabled', async () => {
    completeWith({ status: 'cancelled', signer: undefined });
    await expect(handleProviderCall('login', [], ORIGIN)).rejects.toThrow('rejected');
    expect(await providerService.listSites()).toEqual([]);

    await expect(handleProviderCall('login', ['f'.repeat(64)], ORIGIN)).rejects.toThrow(
      'unknown_chain',
    );
    await expect(handleProviderCall('login', [42], ORIGIN)).rejects.toThrow('invalid_params');
  });

  it('refuses a sign payload that is not a signing request', async () => {
    completeWith({});
    await handleProviderCall('login', [], ORIGIN);
    await expect(handleProviderCall('sign', ['https://evil.example'], ORIGIN)).rejects.toThrow(
      'invalid_params',
    );
  });
});
