import { createProxyService } from '@webext-core/proxy-service';
import type { ServiceKey } from '@/services/keys';
import type { AccountService } from '@/services/account.service';
import type { BackupService } from '@/services/backup.service';
import type { ChainService } from '@/services/chain.service';
import type { ContactsService } from '@/services/contacts.service';
import type { ContractService } from '@/services/contract.service';
import type { GovernanceService } from '@/services/governance.service';
import type { HistoryService } from '@/services/history.service';
import type { PendingService } from '@/services/pending.service';
import type { PingService } from '@/services/ping.service';
import type { ProviderService } from '@/services/provider.service';
import type { RequestService } from '@/services/request.service';
import type { ResourcesService } from '@/services/resources.service';
import type { SessionService } from '@/services/session.service';
import type { SettingsService } from '@/services/settings.service';
import type { SystemService } from '@/services/system.service';
import type { TokensService } from '@/services/tokens.service';
import type { TransactionService } from '@/services/transaction.service';
import type { WalletService } from '@/services/wallet.service';

function proxy<T>(key: ServiceKey): T {
  return createProxyService(key) as T;
}

export const useAccountService = () => proxy<AccountService>('AccountService');
export const useBackupService = () => proxy<BackupService>('BackupService');
export const useChainService = () => proxy<ChainService>('ChainService');
export const useContactsService = () => proxy<ContactsService>('ContactsService');
export const useContractService = () => proxy<ContractService>('ContractService');
export const useGovernanceService = () => proxy<GovernanceService>('GovernanceService');
export const useHistoryService = () => proxy<HistoryService>('HistoryService');
export const usePendingService = () => proxy<PendingService>('PendingService');
export const usePingService = () => proxy<PingService>('PingService');
export const useProviderService = () => proxy<ProviderService>('ProviderService');
export const useRequestService = () => proxy<RequestService>('RequestService');
export const useResourcesService = () => proxy<ResourcesService>('ResourcesService');
export const useSessionService = () => proxy<SessionService>('SessionService');
export const useSettingsService = () => proxy<SettingsService>('SettingsService');
export const useSystemService = () => proxy<SystemService>('SystemService');
export const useTokensService = () => proxy<TokensService>('TokensService');
export const useTransactionService = () => proxy<TransactionService>('TransactionService');
export const useWalletService = () => proxy<WalletService>('WalletService');

export type { Delegation } from '@/services/account.service';
export type { BackupFormat, BackupImportResult, BackupPreview } from '@/services/backup.service';
export type {
  AbiAction,
  AbiCacheEntryInfo,
  AbiTable,
  ContractInfo,
} from '@/services/contract.service';
export type { HistoryAction } from '@/services/history.service';
export type { Producer, ProducerList, Proxy } from '@/services/governance.service';
export type { PendingAccount, PendingAccountStatus } from '@/services/pending.service';
export type { ApiEndpoint, PingResult } from '@/services/ping.service';
export type { PowerUpQuote, RamQuote, ResourceState, RexQuote } from '@/services/resources.service';
export type { LinkInfo } from '@/services/session.service';
export type { NameBid, NameStatus } from '@/services/system.service';
export type { ScannedToken } from '@/services/tokens.service';
