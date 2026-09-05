<script setup lang="ts">
import { computed, ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import { BadgeCheck, ChevronDown } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ActionInput } from '@/lib/antelope/transaction';
import { useAppStore } from '@/stores/app.store';

const props = defineProps<{ isProxy: boolean; canSign: boolean }>();
const emit = defineEmits<{ confirm: [actions: ActionInput[]] }>();

const { t } = useTranslation('ext');
const app = useAppStore();

const infoOpen = ref(false);
const form = ref({ name: '', website: '', slogan: '', philosophy: '', logo_256: '' });

const fields = ['name', 'website', 'slogan', 'philosophy', 'logo_256'] as const;
const signer = computed(() => {
  const wallet = app.currentWallet;
  return wallet ? { actor: wallet.account, permission: wallet.authorization } : undefined;
});

function toggleRegistration(): void {
  const chain = app.currentChain;
  if (!signer.value || !chain) return;
  emit('confirm', [
    {
      account: chain.systemContract,
      name: props.isProxy ? 'unregproxy' : 'regproxy',
      authorization: [signer.value],
      data: props.isProxy
        ? { proxy: signer.value.actor }
        : { proxy: signer.value.actor, isproxy: true },
    },
  ]);
}

function publish(): void {
  if (!signer.value) return;
  emit('confirm', [
    {
      account: 'regproxyinfo',
      name: 'set',
      authorization: [signer.value],
      data: {
        proxy: signer.value.actor,
        name: form.value.name,
        slogan: form.value.slogan,
        philosophy: form.value.philosophy,
        background: '',
        website: form.value.website,
        logo_256: form.value.logo_256,
        telegram: '',
        steemit: '',
        twitter: '',
        wechat: '',
      },
    },
  ]);
}
</script>

<template>
  <section class="bg-card flex flex-col gap-3 rounded-lg border px-4 py-3">
    <div class="flex flex-wrap items-center gap-3">
      <BadgeCheck class="text-muted-foreground size-4 shrink-0" />
      <div class="flex min-w-0 flex-1 flex-col">
        <span class="text-sm font-medium">{{ t('governance_register_title') }}</span>
        <span class="text-muted-foreground text-xs">{{
          isProxy ? t('governance_register_active') : t('governance_register_hint')
        }}</span>
      </div>
      <Button variant="outline" size="sm" :disabled="!canSign" @click="toggleRegistration">
        {{ isProxy ? t('governance_unregister_action') : t('governance_register_action') }}
      </Button>
    </div>

    <button
      v-if="isProxy"
      type="button"
      class="text-primary flex items-center gap-1 self-start text-xs font-medium"
      @click="infoOpen = !infoOpen"
    >
      <ChevronDown class="size-3.5 transition-transform" :class="infoOpen ? 'rotate-180' : ''" />
      {{ t('governance_proxy_info') }}
    </button>

    <form v-if="isProxy && infoOpen" class="flex flex-col gap-3" @submit.prevent="publish">
      <div v-for="field in fields" :key="field" class="flex flex-col gap-1.5">
        <Label :for="`proxy-${field}`">{{ t(`governance_proxy_field_${field}`) }}</Label>
        <Input :id="`proxy-${field}`" v-model="form[field]" autocomplete="off" />
      </div>
      <Button type="submit" size="sm" class="self-start" :disabled="!canSign || !form.name">{{
        t('governance_proxy_publish')
      }}</Button>
    </form>
  </section>
</template>
