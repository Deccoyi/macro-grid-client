import { defineConfig } from 'vitepress'

const repo = 'https://github.com/Deccoyi/macro-grid-client'

export default defineConfig({
  title: 'Macro Grid Phone App',
  description: 'The Android app for Macro Grid: a full-screen touch deck for your Windows PC. Download, install and release notes.',
  base: '/macro-grid-client/',
  lang: 'en-US',
  cleanUrls: true,
  lastUpdated: false,
  appearance: true,
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/macro-grid-client/favicon.png' }],
    ['meta', { name: 'theme-color', content: '#d97706' }],
  ],

  themeConfig: {
    logo: '/logo.png',
    search: { provider: 'local' },
    nav: [
      { text: 'Download', link: '/download' },
      { text: 'Install', link: '/install' },
      { text: 'Changelog', link: '/changelog' },
      {
        text: 'Macro Grid',
        items: [
          { text: 'PC server site', link: 'https://deccoyi.github.io/macro-grid/' },
          { text: 'Plugin store', link: 'https://deccoyi.github.io/macro-grid-plugin/store/' },
          { text: 'Phone app guide', link: 'https://deccoyi.github.io/macro-grid/guide/phone-app' },
        ],
      },
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
    outline: { level: [2, 3] },
    footer: {
      message:
        'Macro Grid: <a href="https://deccoyi.github.io/macro-grid/">PC app</a> &middot; <a href="https://deccoyi.github.io/macro-grid-client/">Phone app</a> &middot; <a href="https://deccoyi.github.io/macro-grid-plugin/">Plugins</a><br>Released under the MIT License. Alpha software, written entirely by an AI assistant, provided as is without warranty.',
      copyright: 'Copyright (c) 2026 Deccoyi',
    },
  },
})
