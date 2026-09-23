import type { Page, Profile, Widget } from "@macro/renderer";

/** One changed page inside a `layout.patch` (mirrors LayoutDiff.cs server-side). */
export interface PagePatch {
  id: string;
  /** The page's own settings (name, cols, rows, gap, ...) — present only when they changed or the page is new. */
  meta?: Record<string, unknown>;
  /** Widget ids in display order — present only when the set or order of widgets changed. */
  order?: string[];
  /** Widgets that were added or edited, in full. */
  widgets: Widget[];
}

export interface LayoutPatchData {
  profileId: string;
  /** The page this client should be showing after the patch (the server falls back when the current one was deleted). */
  pageId: string;
  name?: string;
  /** Every page id in display order. */
  pageOrder: string[];
  /** Only the pages that changed or are new. */
  pages: PagePatch[];
}

export interface PatchedProfile {
  profile: Profile;
  /** Widgets that were added, edited or removed: their cached live state is stale and the server re-sends it. */
  changedWidgetIds: string[];
}

/**
 * Applies a `layout.patch` to the profile the client currently has. Everything the patch does not mention keeps
 * its object identity, so unchanged widgets do not re-render. Returns null if the patch does not fit the
 * profile we hold (we missed a message) — the caller must then reconnect to get a full layout.
 */
export function applyLayoutPatch(profile: Profile, patch: LayoutPatchData): PatchedProfile | null {
  if (profile.id !== patch.profileId) return null;

  const patches = new Map(patch.pages.map((p) => [p.id, p]));
  const oldPages = new Map(profile.pages.map((p) => [p.id, p]));
  const changedWidgetIds = new Set<string>();
  const pages: Page[] = [];

  for (const id of patch.pageOrder) {
    const pagePatch = patches.get(id);
    const oldPage = oldPages.get(id);
    if (!pagePatch) {
      if (!oldPage) return null;
      pages.push(oldPage);
      continue;
    }
    if (!oldPage && !pagePatch.meta) return null;

    const base = oldPage ?? ({ id, widgets: [] } as unknown as Page);
    const oldWidgets = new Map(base.widgets.map((w) => [w.id, w]));
    for (const widget of pagePatch.widgets) {
      oldWidgets.set(widget.id, widget);
      changedWidgetIds.add(widget.id);
    }

    const order = pagePatch.order ?? base.widgets.map((w) => w.id);
    const widgets: Widget[] = [];
    for (const widgetId of order) {
      const widget = oldWidgets.get(widgetId);
      if (!widget) return null;
      widgets.push(widget);
    }
    for (const old of base.widgets) {
      if (!order.includes(old.id)) changedWidgetIds.add(old.id);
    }

    pages.push({ ...base, ...(pagePatch.meta as Partial<Page> | undefined), id, widgets });
  }

  for (const [id, old] of oldPages) {
    if (patch.pageOrder.includes(id)) continue;
    for (const widget of old.widgets) changedWidgetIds.add(widget.id);
  }

  return {
    profile: { ...profile, name: patch.name ?? profile.name, pages },
    changedWidgetIds: [...changedWidgetIds],
  };
}
