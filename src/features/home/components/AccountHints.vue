<script setup lang="ts">
import { computed } from 'vue';
import { useTranslation } from 'i18next-vue';
import { AlertTriangle, KeyRound } from 'lucide-vue-next';
import { percentage } from '@/lib/antelope/format';
import type { AccountData } from '@/services/account.service';

const props = defineProps<{ data: AccountData }>();
const { t } = useTranslation('ext');

const hints = computed(() => {
  const list: { key: string; kind: 'key' | 'resource' }[] = [];
  const owner = props.data.permissions.find((permission) => permission.name === 'owner');
  const active = props.data.permissions.find((permission) => permission.name === 'active');
  if (
    owner &&
    active &&
    owner.keys.some((key) => active.keys.some((entry) => entry.key === key.key))
  ) {
    list.push({ key: 'hint_owner_active_same', kind: 'key' });
  }
  if (props.data.cpu.max > 0 && percentage(props.data.cpu.available, props.data.cpu.max) < 10)
    list.push({ key: 'hint_cpu_low', kind: 'resource' });
  if (props.data.net.max > 0 && percentage(props.data.net.available, props.data.net.max) < 10)
    list.push({ key: 'hint_net_low', kind: 'resource' });
  if (
    props.data.ram.quota > 0 &&
    percentage(props.data.ram.quota - props.data.ram.used, props.data.ram.quota) < 10
  )
    list.push({ key: 'hint_ram_low', kind: 'resource' });
  return list;
});
</script>

<template>
  <div v-if="hints.length > 0" class="flex flex-col gap-2">
    <div
      v-for="hint in hints"
      :key="hint.key"
      class="border-warning/40 bg-warning/10 flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm"
    >
      <KeyRound v-if="hint.kind === 'key'" class="text-warning mt-0.5 size-4 shrink-0" />
      <AlertTriangle v-else class="text-warning mt-0.5 size-4 shrink-0" />
      <span>{{ t(hint.key) }}</span>
    </div>
  </div>
</template>
