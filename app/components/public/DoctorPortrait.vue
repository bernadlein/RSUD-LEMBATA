<script setup lang="ts">
import type { PublicTone } from '../../domain/public-portal'
import { usePublicDoctorPortrait } from '../../composables/usePublicDoctorPortrait'

const props = withDefaults(defineProps<{
  photoUrl: string | null; name: string; initials: string; tone?: PublicTone; size?: 'small' | 'large';
}>(), { tone: 'teal', size: 'small' })
const { src, onError } = usePublicDoctorPortrait(() => props.photoUrl)
</script>
<template>
  <span class="public-portrait" :class="{ 'is-large': size === 'large', 'is-lime': tone === 'lime' }">
    <img
      v-if="src"
      :src="src"
      :alt="'Foto ' + name"
      width="480"
      height="600"
      loading="lazy"
      decoding="async"
      @error="onError"
    />
    <span v-else aria-hidden="true">{{ initials }}</span>
  </span>
</template>
