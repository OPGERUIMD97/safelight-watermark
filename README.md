# Safelight Watermark

A Safelight extension that adds a **text or PNG watermark** to exported photos. Supports positioning, opacity, size, multiple saved templates, and a **live preview while editing in Develop**.

- **Version:** 1.0.0
- **Author:** OPGERUIMD97
- **Entry point:** `dist/index.js`

---

## Features

- **Two modes:** text watermark or transparent PNG image.
- **Multiple templates:** save different watermark configurations under their own name and switch between them with one click. The active template is remembered, even after a restart.
- **Fully configurable per template:**
  - Enable/disable
  - Font, color (text mode only)
  - Size (% of the photo's long edge)
  - Opacity (0–100%)
  - Position: 7 anchor points (`bottom-right`, `bottom-left`, `bottom-center`, `top-right`, `top-left`, `top-center`, `center`)
  - Offset X/Y from the edge (%)
- **Live in Develop:**
  - The watermark is drawn **directly over the Develop canvas** as you edit (via the `develop-canvas-overlay` slot) — the real watermark, not a simplified guide, since text/PNG compositing is cheap enough to render live.
  - The preview image in the panel (under "Generate Preview") **auto-refreshes** as soon as you make a change in Develop (debounced at 400ms), via `api.develop.captureFrame` — the same render path as export, so preview and final result always match.
  - In Library (no active Develop session), the manual "Generate Preview" button remains available, with a clear note that it shows the unedited thumbnail.
- **Automatic application on export** via a registered export processor — always uses the actually selected template, not just the first one in the list.

---

## How it works

1. The extension registers a panel (`safelight-watermark.panel`) that appears on the right side of the UI, and an overlay (`safelight-watermark.develop-overlay`) on the `develop-canvas-overlay` slot.
2. In the panel you manage templates: create, rename (double-click the tag), delete, and adjust all watermark settings.
3. Settings are stored in `localStorage` under the key `safelight-watermark-templates`; which template is active is stored under `safelight-watermark-active-id` — so everything persists between sessions, and the Develop overlay (a separate React tree) stays in sync with the panel (polled every 500ms).
4. On export, the extension registers an **export processor** (`safelight-watermark.processor`) that applies the actually active template to the exported photo via an `OffscreenCanvas`.
5. Watermark text is scaled based on the photo's long edge (`fontSize` as a percentage), so it looks consistent at any photo size — in the Develop overlay, the panel preview, and on export alike.

---

## Files

| File | Description |
|---|---|
| `index.js` | Full extension source: UI panel, Develop overlay, storage, watermark render logic, and export processor. |
| `safelight.json` | Extension manifest (name, version, description, author, entry point). |

---

## Technical notes

- **Styling** uses CSS variables from the Safelight theme (`--color-surface-*`, `--color-accent`, `--color-text-*`, `--color-border*`), so the extension automatically follows the active theme (including dark mode).
- **No `confirm()` dialog**: `window.confirm` isn't available in Electron, so deleting a template happens immediately without a confirmation prompt (except for the last remaining template, which can't be deleted).
- Images are stored as a base64 data URL in `imageDataUrl` on the template object — no separate file is written to disk.
- The Develop overlay and the panel preview share one helper (`getWatermarkBoxStyle`) for positioning, so both always show the same thing.

---

## Changelog

### 1.0.0 — Initial release
- Text or PNG watermark with configurable font/color, size, opacity, and 7-point anchored positioning.
- Multiple saved templates with persisted active selection.
- Live watermark overlay directly on the Develop canvas while editing.
- Auto-refreshing panel preview via `api.develop.captureFrame`, matching the export render path exactly.
- Export processor that applies the actually selected template.

---

## Possible future improvements

- No size validation for very large PNGs (memory usage when base64-encoded into `localStorage`).
- No way to export/share templates between users or installs.

---

*This file is kept up to date as the extension changes.*
