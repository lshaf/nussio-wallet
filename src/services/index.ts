import { registerAccountService } from './account.service';
import { registerBackupService } from './backup.service';
import { registerChainService } from './chain.service';
import { registerContactsService } from './contacts.service';
import { registerGovernanceService } from './governance.service';
import { registerPendingService } from './pending.service';
import { registerRequestService } from './request.service';
import { registerResourcesService } from './resources.service';
import { registerSessionService } from './session.service';
import { registerSettingsService } from './settings.service';
import { registerTokensService } from './tokens.service';
import { registerTransactionService } from './transaction.service';
import { registerWalletService } from './wallet.service';

export function registerServices(): void {
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
}
