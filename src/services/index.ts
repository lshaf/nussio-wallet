import { registerAccountService } from './account.service';
import { registerChainService } from './chain.service';
import { registerRequestService } from './request.service';
import { registerSessionService } from './session.service';
import { registerSettingsService } from './settings.service';
import { registerWalletService } from './wallet.service';

export function registerServices(): void {
  registerWalletService();
  registerChainService();
  registerAccountService();
  registerSettingsService();
  registerRequestService();
  registerSessionService();
}
