<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useTranslation } from 'i18next-vue';

const props = defineProps<{ expiration: string }>();
const emit = defineEmits<{ expired: [] }>();
const { t } = useTranslation('ext');

const now = ref(Date.now());
const timer = setInterval(() => (now.value = Date.now()), 1000);
onBeforeUnmount(() => clearInterval(timer));

const remaining = computed(() =>
  Math.max(0, Math.floor((Date.parse(`${props.expiration}Z`) - now.value) / 1000)),
);
const label = computed(() => {
  const minutes = Math.floor(remaining.value / 60);
  const seconds = remaining.value % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
});

watch(remaining, (value, previous) => {
  if (value === 0 && previous > 0) emit('expired');
});
</script>

<template>
  <span class="num" :class="remaining === 0 ? 'text-destructive' : ''">
    {{ remaining === 0 ? t('prompt_expired') : label }}
  </span>
</template>
