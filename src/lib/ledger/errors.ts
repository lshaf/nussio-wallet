const STATUS_HINTS: Record<string, string> = {
  '6a80': 'ledger_contract_data',
  '6985': 'ledger_rejected',
  '5515': 'ledger_locked',
  '6b0c': 'ledger_locked',
  '6d00': 'ledger_app_closed',
  '6e00': 'ledger_app_closed',
  '6e01': 'ledger_app_closed',
  '6511': 'ledger_app_closed',
};

const MESSAGE_HINTS: Record<string, string> = {
  ledger_wrong_device: 'ledger_wrong_device',
  ledger_no_device: 'ledger_no_device',
  hid_unsupported: 'ledger_unsupported',
};

export function ledgerHint(message: string): string {
  const status = /^ledger_status:([0-9a-f]+)$/.exec(message)?.[1];
  if (status) return STATUS_HINTS[status] ?? 'ledger';
  return MESSAGE_HINTS[message] ?? 'ledger';
}
