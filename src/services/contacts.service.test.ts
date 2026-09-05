import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { contactsService } from './contacts.service';

describe('contacts service', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('saves, renames and removes contacts in name order', async () => {
    await contactsService.save({
      accountName: 'zzzexchange',
      label: 'Exchange',
      defaultMemo: '42',
    });
    const contacts = await contactsService.save({
      accountName: 'greymassfuel',
      label: 'Fuel',
      defaultMemo: '',
    });
    expect(contacts.map((entry) => entry.accountName)).toEqual(['greymassfuel', 'zzzexchange']);

    const updated = await contactsService.save(
      { accountName: 'teamgreymass', label: 'Greymass', defaultMemo: '' },
      'greymassfuel',
    );
    expect(updated.map((entry) => entry.accountName)).toEqual(['teamgreymass', 'zzzexchange']);

    const deduped = await contactsService.save({
      accountName: 'zzzexchange',
      label: 'Renamed',
      defaultMemo: 'memo',
    });
    expect(deduped).toHaveLength(2);
    expect(deduped.find((entry) => entry.accountName === 'zzzexchange')?.label).toBe('Renamed');

    expect(await contactsService.remove('zzzexchange')).toEqual([
      { accountName: 'teamgreymass', label: 'Greymass', defaultMemo: '' },
    ]);
  });

  it('rejects an invalid account name', async () => {
    await expect(
      contactsService.save({ accountName: 'NOT VALID', label: '', defaultMemo: '' }),
    ).rejects.toThrow();
  });
});
