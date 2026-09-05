<script setup lang="ts">
import { useTranslation } from 'i18next-vue';
import { Fuel } from 'lucide-vue-next';

defineProps<{ fee: string | null; costs?: Record<string, string> }>();
const { t } = useTranslation('ext');
</script>

<template>
  <div
    class="flex items-start gap-2.5 rounded-lg border px-3 py-2 text-xs"
    :class="fee ? 'border-warning/40 bg-warning/10' : 'border-positive/40 bg-positive/10'"
  >
    <Fuel class="mt-0.5 size-4 shrink-0" :class="fee ? 'text-warning' : 'text-positive'" />
    <div class="flex flex-col gap-1">
      <p class="font-medium">
        {{ fee ? t('prompt_fuel_fee_title') : t('prompt_fuel_free_title') }}
      </p>
      <p class="text-muted-foreground">
        {{ fee ? t('prompt_fuel_fee_body', { fee }) : t('prompt_fuel_free_body') }}
      </p>
      <dl
        v-if="costs && Object.keys(costs).length > 0"
        class="mt-1 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-xs"
      >
        <template v-for="(value, key) in costs" :key="key">
          <dt class="text-muted-foreground uppercase">{{ key }}</dt>
          <dd class="num">{{ value }}</dd>
        </template>
      </dl>
    </div>
  </div>
</template>
