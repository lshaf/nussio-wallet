import { installMessagingGuard } from '@/lib/messaging/guard';
import { registerAccountService } from './account.service';
import { registerBackupService } from './backup.service';
import { registerChainService } from './chain.service';
import { registerContactsService } from './contacts.service';
import { registerContractService } from './contract.service';
import { registerGovernanceService } from './governance.service';
import { registerHistoryService } from './history.service';
import { registerPendingService } from './pending.service';
import { registerPingService } from './ping.service';
import { registerRequestService } from './request.service';
import { registerResourcesService } from './resources.service';
import { registerSessionService } from './session.service';
import { registerSettingsService } from './settings.service';
import { registerSystemService } from './system.service';
import { registerTokensService } from './tokens.service';
import { registerTransactionService } from './transaction.service';
import { registerWalletService } from './wallet.service';

export const SERVICE_KEYS = [
  'AccountService',
  'BackupService',
  'ChainService',
  'ContactsService',
  'ContractService',
  'GovernanceService',
  'HistoryService',
  'PendingService',
  'PingService',
  'RequestService',
  'ResourcesService',
  'SessionService',
  'SettingsService',
  'SystemService',
  'TokensService',
  'TransactionService',
  'WalletService',
] as const;

export function registerServices(): void {
  installMessagingGuard([...SERVICE_KEYS]);
  registerWalletService();
  registerBackupService();
  registerChainService();
  registerAccountService();
  registerSettingsService();
  registerRequestService();
  registerSessionService();
  registerTransactionService();
  registerContactsService();
  registerTokensService();
  registerPendingService();
  registerResourcesService();
  registerGovernanceService();
  registerSystemService();
  registerContractService();
  registerHistoryService();
  registerPingService();
}
