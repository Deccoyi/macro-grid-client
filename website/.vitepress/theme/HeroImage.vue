<script setup lang="ts">
import { withBase } from 'vitepress'
</script>

<template>
  <img class="logo" :src="withBase('/logo.png')" alt="Macro Grid" />
</template>

<style scoped>
.logo {
  display: block;
  height: 200px;
  width: auto;
  max-width: 100%;
  border-radius: 40px;
}
@media (max-width: 959px) {
  .logo { height: 120px; border-radius: 24px; }
}
</style>
