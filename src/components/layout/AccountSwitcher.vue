<script setup lang="ts">
import { useTranslation } from 'i18next-vue';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/stores/app.store';

const { t } = useTranslation('ext');
const app = useAppStore();

function walletKey(account: string, authorization: string): string {
  return `${account}@${authorization}`;
}

function onChange(value: unknown): void {
  if (typeof value !== 'string' || !app.settings.chainId) return;
  const [account, authorization] = value.split('@');
  if (!account || !authorization) return;
  void app.selectWallet({ chainId: app.settings.chainId, account, authorization });
}
</script>

<template>
  <div class="min-w-0">
    <Select
      :model-value="
        app.currentWallet
          ? walletKey(app.currentWallet.account, app.currentWallet.authorization)
          : undefined
      "
      :disabled="app.walletsForChain.length === 0"
      @update:model-value="onChange"
    >
      <SelectTrigger class="w-full font-mono" :aria-label="t('wallets_col_account')">
        <SelectValue :placeholder="t('home_no_wallet')" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem
          v-for="wallet in app.walletsForChain"
          :key="walletKey(wallet.account, wallet.authorization)"
          :value="walletKey(wallet.account, wallet.authorization)"
        >
          <span class="flex items-center gap-2 font-mono">
            {{ wallet.account }}@{{ wallet.authorization }}
            <Badge variant="secondary" class="font-sans text-[10px]">{{
              t(`mode_${wallet.mode}`)
            }}</Badge>
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  </div>
</template>
