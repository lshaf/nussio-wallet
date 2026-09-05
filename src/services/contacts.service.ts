import { createProxyService, registerService } from '@webext-core/proxy-service';
import { contactsItem } from '@/lib/storage/items';
import { contactSchema, type Contact } from '@/lib/storage/schemas';

export interface ContactsService {
  list(): Promise<Contact[]>;
  save(contact: Contact, replaces?: string): Promise<Contact[]>;
  remove(accountName: string): Promise<Contact[]>;
}

const SERVICE_KEY = 'ContactsService';

export const contactsService: ContactsService = {
  list: () => contactsItem.getValue(),

  async save(input, replaces) {
    const contact = contactSchema.parse(input);
    const contacts = (await contactsItem.getValue()).filter(
      (entry) => entry.accountName !== replaces && entry.accountName !== contact.accountName,
    );
    contacts.push(contact);
    contacts.sort((a, b) => a.accountName.localeCompare(b.accountName));
    await contactsItem.setValue(contacts);
    return contacts;
  },

  async remove(accountName) {
    const contacts = (await contactsItem.getValue()).filter(
      (entry) => entry.accountName !== accountName,
    );
    await contactsItem.setValue(contacts);
    return contacts;
  },
};

export function registerContactsService(): void {
  registerService(SERVICE_KEY, contactsService);
}

export function useContactsService(): ContactsService {
  return createProxyService<ContactsService>(SERVICE_KEY);
}
