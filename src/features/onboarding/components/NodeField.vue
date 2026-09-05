<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useTranslation } from 'i18next-vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useChainService } from '@/composables/useServices';
import type { NodeValidation } from '@/services/chain.service';

const props = defineProps<{ chainId: string; node: string }>();
const emit = defineEmits<{ change: [node: string]; validated: [result: NodeValidation] }>();

const { t } = useTranslation('ext');
const chainService = useChainService();
const value = ref(props.node);
const result = ref<NodeValidation | undefined>();
const busy = ref(false);

watch(
  () => props.node,
  (node) => {
    value.value = node;
  },
);

const insecure = computed(() => value.value.startsWith('http://'));
const message = computed(() => {
  if (!result.value) return '';
  if (result.value.ok) return t('node_ok');
  return t(`node_${result.value.error ?? 'unreachable'}`);
});

async function validate(): Promise<void> {
  busy.value = true;
  result.value = await chainService.validateNode(value.value, props.chainId);
  busy.value = false;
  emit('validated', result.value);
  if (result.value.ok) emit('change', value.value);
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <div class="flex flex-col gap-2 sm:flex-row">
      <Input
        v-model="value"
        type="url"
        class="flex-1 font-mono text-xs"
        :aria-label="t('node_url_label')"
        @change="result = undefined"
      />
      <Button type="button" variant="outline" size="sm" :disabled="busy" @click="validate">
        {{ t('action_validate') }}
      </Button>
    </div>
    <p v-if="message" :class="result?.ok ? 'text-positive' : 'text-destructive'" class="text-xs">
      {{ message }}
    </p>
    <p v-else-if="insecure" class="text-warning text-xs">{{ t('node_insecure') }}</p>
  </div>
</template>
