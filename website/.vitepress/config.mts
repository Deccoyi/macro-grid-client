import { defineConfig } from 'vitepress'
import { sharedConfig, turkishThemeLabels } from './shared'

const repo = 'https://github.com/Deccoyi/macro-grid-client'
const shared = sharedConfig('/macro-grid-client/', '#2563eb')

export default defineConfig({
  ...shared,
  title: 'Macro Grid Phone App',
  description: 'The Android app for Macro Grid: a full-screen touch deck for your Windows PC. Download, install and release notes.',
  base: '/macro-grid-client/',

  locales: {
    root: { label: 'English', lang: 'en-US' },
    tr: {
      label: 'Türkçe',
      lang: 'tr-TR',
      link: '/tr/',
      description: "Macro Grid için Android uygulaması: Windows PC'niz için tam ekran dokunmatik deck. İndirme, kurulum ve sürüm notları.",
      themeConfig: {
        ...turkishThemeLabels(),
        nav: [
          { text: 'İndir', link: '/tr/download' },
          { text: 'Kurulum', link: '/tr/install' },
          { text: 'Değişiklik günlüğü', link: '/tr/changelog' },
        ],
        sidebar: [
          {
            text: 'Telefon uygulaması',
            items: [
              { text: 'İndir', link: '/tr/download' },
              { text: 'Gereksinimler', link: '/tr/requirements' },
              { text: "APK'yı kurun", link: '/tr/install' },
              { text: 'Değişiklik günlüğü', link: '/tr/changelog' },
            ],
          },
        ],
        editLink: { pattern: `${repo}/edit/dev/website/:path`, text: "GitHub'da bir değişiklik öner" },
      },
    },
  },

  themeConfig: {
    ...shared.themeConfig,
    nav: [
      { text: 'Download', link: '/download' },
      { text: 'Install', link: '/install' },
      { text: 'Changelog', link: '/changelog' },
    ],
    sidebar: [
      {
        text: 'Phone app',
        items: [
          { text: 'Download', link: '/download' },
          { text: 'Requirements', link: '/requirements' },
          { text: 'Install the APK', link: '/install' },
          { text: 'Changelog', link: '/changelog' },
        ],
      },
    ],
    socialLinks: [{ icon: 'github', link: repo }],
    editLink: { pattern: `${repo}/edit/dev/website/:path`, text: 'Suggest a change on GitHub' },
  },
})
