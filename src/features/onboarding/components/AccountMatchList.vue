<script setup lang="ts">
import { computed } from 'vue';
import { useTranslation } from 'i18next-vue';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { AccountMatch } from '@/services/account.service';

const props = withDefaults(defineProps<{ matches: AccountMatch[]; title?: string }>(), {
  title: 'import_key_found',
});
const selected = defineModel<string[]>({ default: () => [] });

const { t } = useTranslation('ext');

function id(match: AccountMatch): string {
  return `${match.account}@${match.permission}`;
}

function toggle(match: AccountMatch, checked: boolean | 'indeterminate'): void {
  const key = id(match);
  selected.value =
    checked === true
      ? [...new Set([...selected.value, key])]
      : selected.value.filter((entry) => entry !== key);
}

const allSelected = computed(
  () =>
    props.matches.length > 0 && props.matches.every((match) => selected.value.includes(id(match))),
);

function toggleAll(): void {
  selected.value = allSelected.value ? [] : props.matches.map(id);
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center justify-between">
      <p class="text-sm font-medium">{{ t(props.title) }}</p>
      <Button v-if="matches.length > 1" variant="link" size="sm" @click="toggleAll">
        {{ allSelected ? t('action_unselect_all') : t('action_select_all') }}
      </Button>
    </div>
    <div
      v-for="match in matches"
      :key="id(match)"
      class="flex items-center gap-2 rounded-md border px-3 py-2"
    >
      <Checkbox
        :id="`match-${id(match)}`"
        :model-value="selected.includes(id(match))"
        @update:model-value="(value) => toggle(match, value)"
      />
      <Label :for="`match-${id(match)}`" class="cursor-pointer font-mono text-sm">{{
        id(match)
      }}</Label>
    </div>
  </div>
</template>
