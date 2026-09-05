<script setup lang="ts">
import { useTranslation } from 'i18next-vue';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import type { RequestSigner, Wallet } from '@/lib/storage/schemas';

const props = defineProps<{
  wallets: Wallet[];
  signer: RequestSigner | null;
  chainId: string;
  disabled?: boolean;
}>();
const emit = defineEmits<{ change: [signer: RequestSigner] }>();
const { t } = useTranslation('ext');

function key(wallet: Pick<Wallet, 'account' | 'authorization'>): string {
  return `${wallet.account}@${wallet.authorization}`;
}

function onChange(value: unknown): void {
  if (typeof value !== 'string') return;
  const [account, authorization] = value.split('@');
  if (!account || !authorization) return;
  emit('change', { chainId: props.chainId, account, authorization });
}
</script>

<template>
  <Select
    :model-value="signer ? key(signer) : undefined"
    :disabled="disabled || wallets.length === 0"
    @update:model-value="onChange"
  >
    <SelectTrigger class="w-full font-mono" :aria-label="t('prompt_sign_as')">
      <span v-if="signer" class="truncate">{{ key(signer) }}</span>
      <span v-else class="text-muted-foreground font-sans">{{ t('home_no_wallet') }}</span>
    </SelectTrigger>
    <SelectContent>
      <SelectItem v-for="wallet in wallets" :key="key(wallet)" :value="key(wallet)">
        <span class="flex items-center gap-2 font-mono">
          {{ key(wallet) }}
          <Badge variant="secondary" class="font-sans text-[10px]">{{
            t(`mode_${wallet.mode}`)
          }}</Badge>
        </span>
      </SelectItem>
    </SelectContent>
  </Select>
</template>
