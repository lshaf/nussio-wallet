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

export type ServiceKey = (typeof SERVICE_KEYS)[number];
