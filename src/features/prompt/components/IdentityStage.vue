<script setup lang="ts">
import { computed } from 'vue';
import { useTranslation } from 'i18next-vue';
import { Fingerprint } from 'lucide-vue-next';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { chainLogo } from '@/lib/antelope/logos';
import type { RequestSigner } from '@/lib/storage/schemas';
import type { RequestView } from '@/services/request.service';
import { useAppStore } from '@/stores/app.store';
import SignerSelect from './SignerSelect.vue';

const props = defineProps<{ view: RequestView }>();
const emit = defineEmits<{ signer: [signer: RequestSigner] }>();
const { t } = useTranslation('ext');
const app = useAppStore();

const chains = computed(() =>
  props.view.chainIds
    .map((chainId) => app.chains.find((chain) => chain.chainId === chainId))
    .filter((chain): chain is NonNullable<typeof chain> => Boolean(chain)),
);

function onChain(value: unknown): void {
  if (typeof value !== 'string') return;
  const wallet = app.wallets.find((entry) => entry.chainId === value);
  if (wallet)
    emit('signer', {
      chainId: value,
      account: wallet.account,
      authorization: wallet.authorization,
    });
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-md flex-col gap-5">
    <div class="flex flex-col items-center gap-2 text-center">
      <span
        class="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full"
      >
        <Fingerprint class="size-6" />
      </span>
      <h2 class="text-xl font-semibold tracking-tight">
        {{ t('prompt_identity_title', { app: view.appName ?? view.callback?.origin ?? '' }) }}
      </h2>
      <p class="text-muted-foreground text-sm">{{ t('prompt_identity_description') }}</p>
    </div>
    <div class="bg-card flex flex-col gap-4 rounded-xl border p-4">
      <div v-if="chains.length > 1" class="flex flex-col gap-2">
        <p class="eyebrow">{{ t('nav_chains') }}</p>
        <Select :model-value="view.chainId ?? undefined" @update:model-value="onChain">
          <SelectTrigger class="w-full">
            <span class="flex items-center gap-2">
              <img
                v-if="view.chain && chainLogo(view.chain.id)"
                :src="chainLogo(view.chain.id)"
                class="size-4 rounded-full"
                alt=""
              />
              {{ view.chain?.name }}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="chain in chains" :key="chain.chainId" :value="chain.chainId">
              <span class="flex items-center gap-2">
                <img
                  v-if="chainLogo(chain.id)"
                  :src="chainLogo(chain.id)"
                  class="size-4 rounded-full"
                  alt=""
                />
                {{ chain.name }}
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="flex flex-col gap-2">
        <p class="eyebrow">{{ t('prompt_sign_as') }}</p>
        <SignerSelect
          v-if="view.chainId"
          :wallets="view.wallets"
          :signer="view.signer"
          :chain-id="view.chainId"
          @change="(signer) => emit('signer', signer)"
        />
      </div>
    </div>
  </div>
</template>
