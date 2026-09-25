import { defineLoader } from 'vitepress'
import QRCode from 'qrcode'

export interface ReleaseApk {
  name: string
  size: number
  url: string
  /** A QR code of `url` as an image address (SVG), so a computer's page can hand the file to a phone. Null when it could not be made. */
  qr: string | null
}

export interface Release {
  tag: string
  version: string
  prerelease: boolean
  publishedAt: string
  notesUrl: string
  apk: ReleaseApk | null
}

export interface ReleasesData {
  releases: Release[]
}

declare const data: ReleasesData
export { data }

const API = 'https://api.github.com/repos/Deccoyi/macro-grid-client/releases?per_page=30'
const PREFIX = 'client-v'

/** The direct download link as a QR code (an SVG data address), made here so the page ships no QR code library. */
async function qrFor(url: string): Promise<string | null> {
  try {
    const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
  } catch {
    return null
  }
}

// Runs at build time. It must never fail the build: any error gives an empty list and the page shows a fallback.
export default defineLoader({
  async load(): Promise<ReleasesData> {
    try {
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'macro-grid-client-site',
      }
      if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
      const res = await fetch(API, { headers, signal: AbortSignal.timeout(15000) })
      if (!res.ok) throw new Error(`GitHub API answered ${res.status}`)
      const list = (await res.json()) as any[]
      const releases: Release[] = (
        await Promise.all(
          list
            .filter((r) => r && !r.draft && typeof r.tag_name === 'string' && r.tag_name.startsWith(PREFIX))
            .map(async (r) => {
              const asset = (r.assets ?? []).find((a: any) => typeof a.name === 'string' && a.name.toLowerCase().endsWith('.apk'))
              return {
                tag: r.tag_name,
                version: r.tag_name.slice(PREFIX.length),
                prerelease: !!r.prerelease,
                publishedAt: r.published_at ?? r.created_at ?? '',
                notesUrl: r.html_url,
                apk: asset
                  ? { name: asset.name, size: asset.size, url: asset.browser_download_url, qr: await qrFor(asset.browser_download_url) }
                  : null,
              }
            }),
        )
      )
        .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
      return { releases }
    } catch (err) {
      console.warn(`[releases] could not load releases: ${(err as Error).message}`)
      return { releases: [] }
    }
  },
})
