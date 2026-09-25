<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'
import { data } from '../releases.data'
import { langOf } from '../i18n'

const { lang } = useData()
const isTr = computed(() => langOf(lang.value) === 'tr')
const T = {
  en: {
    alpha: 'alpha', latest: 'Latest release', version: 'Version', released: 'Released', apk: 'Download APK',
    openPage: 'Open the release page', notes: 'Release notes', download: 'Download', onGithub: 'Releases are on GitHub',
    failed: 'The release list could not be loaded right now, or no release has been published yet. You can always get the APK from GitHub.',
    goGithub: 'Go to GitHub Releases', previous: 'Previous versions',
    scan: 'Scan with your phone to download the APK', qrAlt: 'QR code of the APK download link',
  },
  tr: {
    alpha: 'alfa', latest: 'Son sürüm', version: 'Sürüm', released: 'Yayın tarihi:', apk: 'APK indir',
    openPage: 'Sürüm sayfasını aç', notes: 'Sürüm notları', download: 'İndir', onGithub: "Sürümler GitHub'da",
    failed: "Sürüm listesi şu anda yüklenemedi ya da henüz bir sürüm yayımlanmadı. APK'yı her zaman GitHub'dan edinebilirsiniz.",
    goGithub: "GitHub Sürümleri'ne git", previous: 'Önceki sürümler',
    scan: "APK'yı indirmek için telefonunuzla tarayın", qrAlt: 'APK indirme bağlantısının QR kodu',
  },
}
const t = computed(() => T[isTr.value ? 'tr' : 'en'])

const RELEASES_URL = 'https://github.com/Deccoyi/macro-grid-client/releases'

const latest = computed(() => data.releases[0] ?? null)
const previous = computed(() => data.releases.slice(1, 4))

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  if (isTr.value) return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  return d.toISOString().slice(0, 10)
}
function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}
</script>

<template>
  <div class="dl">
    <section v-if="latest" class="hero">
     <div class="hero-row">
      <div class="hero-main">
      <div class="label">{{ t.latest }}</div>
      <h2 class="ver">
        {{ t.version }} {{ latest.version }}
        <span v-if="latest.prerelease" class="badge">{{ t.alpha }}</span>
      </h2>
      <div class="meta">{{ t.released }} {{ formatDate(latest.publishedAt) }}</div>
      <div class="actions">
        <a v-if="latest.apk" class="btn brand" :href="latest.apk.url">{{ t.apk }}</a>
        <a v-else class="btn brand" :href="latest.notesUrl">{{ t.openPage }}</a>
        <a class="btn alt" :href="latest.notesUrl">{{ t.notes }}</a>
      </div>
      <div v-if="latest.apk" class="file">{{ latest.apk.name }} &middot; {{ formatSize(latest.apk.size) }}</div>
      </div>
      <figure v-if="latest.apk?.qr" class="qr">
        <img :src="latest.apk.qr" :alt="t.qrAlt" width="148" height="148" />
        <figcaption>{{ t.scan }}</figcaption>
      </figure>
     </div>
    </section>

    <section v-else class="hero">
      <div class="label">{{ t.download }}</div>
      <h2 class="ver">{{ t.onGithub }}</h2>
      <p class="meta">{{ t.failed }}</p>
      <div class="actions">
        <a class="btn brand" :href="RELEASES_URL">{{ t.goGithub }}</a>
      </div>
    </section>

    <section v-if="previous.length" class="prev">
      <h3>{{ t.previous }}</h3>
      <ul>
        <li v-for="r in previous" :key="r.tag">
          <div class="info">
            <strong>{{ r.version }}</strong>
            <span v-if="r.prerelease" class="badge">{{ t.alpha }}</span>
            <span class="date">{{ formatDate(r.publishedAt) }}</span>
          </div>
          <div class="links">
            <a v-if="r.apk" :href="r.apk.url">APK ({{ formatSize(r.apk.size) }})</a>
            <a :href="r.notesUrl">{{ t.notes }}</a>
          </div>
        </li>
      </ul>
    </section>

    <p v-if="isTr" class="older">Daha eski sürümler <a :href="RELEASES_URL">GitHub Sürümler sayfasında</a>.</p>
    <p v-else class="older">Older versions are on the <a :href="RELEASES_URL">GitHub Releases page</a>.</p>
  </div>
</template>

<style scoped>
.dl { margin: 24px 0; }
.hero {
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  border-radius: 12px;
  padding: 24px;
}
.hero-row { display: flex; align-items: center; justify-content: space-between; gap: 24px; }
.hero-main { min-width: 0; flex: 1 1 auto; }
/* White behind the code whatever the theme: a scanner needs dark modules on a light ground. */
.qr { margin: 0; flex: 0 0 auto; text-align: center; }
.qr img { display: block; padding: 6px; background: #fff; border-radius: 8px; }
.qr figcaption { margin-top: 6px; max-width: 148px; font-size: 12px; line-height: 1.35; color: var(--vp-c-text-2); }
.label { font-size: 12px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--vp-c-text-2); }
.ver { margin: 6px 0 0; padding: 0; border: 0; font-size: 28px; line-height: 1.2; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.meta { margin: 6px 0 0; color: var(--vp-c-text-2); font-size: 14px; }
.actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 18px; }
.btn {
  display: inline-block;
  padding: 0 24px;
  line-height: 44px;
  border-radius: 22px;
  font-weight: 600;
  font-size: 15px;
  text-decoration: none !important;
  transition: background-color 0.2s;
}
.btn.brand { background: var(--vp-button-brand-bg); color: var(--vp-button-brand-text) !important; }
.btn.brand:hover { background: var(--vp-button-brand-hover-bg); }
.btn.alt { background: var(--vp-button-alt-bg); color: var(--vp-button-alt-text) !important; }
.btn.alt:hover { background: var(--vp-button-alt-hover-bg); }
.file { margin-top: 12px; font-size: 13px; color: var(--vp-c-text-2); word-break: break-all; }
.badge {
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
  padding: 0 8px;
  border-radius: 10px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  letter-spacing: 0;
}
.prev { margin-top: 28px; }
.prev h3 { margin: 0 0 8px; border: 0; padding: 0; }
.prev ul { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--vp-c-divider); }
.prev li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 16px;
  padding: 12px 0;
  border-bottom: 1px solid var(--vp-c-divider);
}
.info { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.date { color: var(--vp-c-text-2); font-size: 14px; }
.links { display: flex; gap: 16px; font-size: 14px; }
.older { margin-top: 20px; color: var(--vp-c-text-2); font-size: 14px; }
@media (max-width: 640px) {
  .qr { display: none; }
}
@media (max-width: 480px) {
  .hero { padding: 18px; }
  .ver { font-size: 24px; }
  .btn { flex: 1 1 100%; text-align: center; }
}
</style>
