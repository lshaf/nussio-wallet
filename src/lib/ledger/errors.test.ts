import { describe, expect, it } from 'vitest';
import { ledgerHint } from './errors';

describe('ledgerHint', () => {
  it('maps device status words to specific hints', () => {
    expect(ledgerHint('ledger_status:6a80')).toBe('ledger_contract_data');
    expect(ledgerHint('ledger_status:6985')).toBe('ledger_rejected');
    expect(ledgerHint('ledger_status:5515')).toBe('ledger_locked');
    expect(ledgerHint('ledger_status:6e00')).toBe('ledger_app_closed');
  });

  it('maps local failures to specific hints', () => {
    expect(ledgerHint('ledger_wrong_device')).toBe('ledger_wrong_device');
    expect(ledgerHint('ledger_no_device')).toBe('ledger_no_device');
    expect(ledgerHint('hid_unsupported')).toBe('ledger_unsupported');
  });

  it('falls back to the generic hint', () => {
    expect(ledgerHint('ledger_status:9999')).toBe('ledger');
    expect(ledgerHint('Failed to open the device.')).toBe('ledger');
  });
});
