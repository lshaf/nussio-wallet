<script setup lang="ts">
import { computed, ref } from 'vue';
import { useTranslation } from 'i18next-vue';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { inspectKey } from '@/lib/antelope/keys';
import { useAppStore } from '@/stores/app.store';

const { t } = useTranslation('ext');
const app = useAppStore();
const value = ref('');

const result = computed(() => inspectKey(value.value, app.currentChain?.keyPrefix ?? 'EOS'));

const items = computed(() => {
  const key = result.value;
  if (key.kind === 'invalid') return [];
  const list = [
    { label: t('keys_type'), value: key.kind === 'private' ? t('keys_private') : t('keys_public') },
  ];
  list.push({ label: t('keys_curve'), value: key.type });
  if (key.kind === 'private') {
    list.push({ label: t('keys_wif'), value: key.wif });
    list.push({ label: t('keys_modern_private'), value: key.pvt });
  }
  list.push({ label: t('keys_public'), value: key.publicKey });
  if (key.legacy) list.push({ label: t('keys_legacy'), value: key.legacy });
  return list;
});
</script>

<template>
  <section class="flex flex-col gap-3">
    <h2 class="eyebrow">{{ t('keys_utility_title') }}</h2>
    <div class="bg-card flex flex-col gap-4 rounded-lg border p-4">
      <p class="text-muted-foreground text-sm">{{ t('keys_utility_description') }}</p>
      <div class="flex flex-col gap-2">
        <Label for="key-utility">{{ t('keys_utility_label') }}</Label>
        <Input
          id="key-utility"
          v-model="value"
          class="font-mono"
          autocomplete="off"
          spellcheck="false"
        />
      </div>
      <p v-if="value.trim() && result.kind === 'invalid'" class="text-destructive text-sm">
        {{ t('keys_utility_invalid') }}
      </p>
      <div v-else-if="items.length > 0" class="flex flex-col gap-2">
        <p class="text-positive text-sm">{{ t('keys_utility_valid') }}</p>
        <dl class="flex flex-col gap-2 text-sm">
          <div v-for="item in items" :key="item.label" class="flex flex-col gap-0.5">
            <dt class="eyebrow">{{ item.label }}</dt>
            <dd class="bg-muted rounded-md p-2 font-mono text-[11px] break-all">
              {{ item.value }}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  </section>
</template>
