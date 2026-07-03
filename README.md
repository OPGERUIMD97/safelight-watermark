# Safelight Watermark

A Safelight extension that adds a **text or transparent PNG watermark** to exported photos. Supports positioning, opacity, size, multiple saved templates, and a live preview while editing in Develop.

- **Version:** 1.2.0
- **Author:** OPGERUIMD97
- **Entry point:** `dist/index.js`

---

## Features

- **Two modes:** text watermark or transparent PNG image.
- **Multiple templates:** save different configurations under their own name and switch between them with one click. The active template is remembered across restarts.
- **Fully configurable per template:**
  - Show live in Develop (controls the canvas overlay and panel preview only — does not affect export)
  - Font, color (text mode only)
  - Size (% of the photo's long edge)
  - Opacity (0–100%)
  - Position: 7 anchor points (`bottom-right`, `bottom-left`, `bottom-center`, `top-right`, `top-left`, `top-center`, `center`)
  - Offset X/Y from the edge (%)
- **Live in Develop:**
  - The watermark is drawn directly over the Develop canvas as you edit (via the `develop-canvas-overlay` slot) — the real watermark, not a simplified guide.
  - The panel preview auto-refreshes as you make changes in Develop (debounced at 400 ms), via `api.develop.captureFrame` — the same render path as export.
  - In Library (no active Develop session), a manual "Generate Preview" button is available, using the unedited photo thumbnail or a sample image.
- **Export integration:** the "Watermark" section in Safelight's core Export panel shows an **Apply watermark** toggle and a **Template** dropdown (instead of "No settings."), defaulting to the actively selected template. Export is governed exclusively by those Export panel controls — not by the "Show live in Develop" checkbox.
- **Automatic application on export** via a registered export processor.

---

## How it works

1. The extension registers a panel (`safelight-watermark.panel`) on the right side of the UI, and a canvas overlay (`safelight-watermark.develop-overlay`) on the `develop-canvas-overlay` slot.
2. In the panel you manage templates: create, rename (double-click the tag), delete, and adjust all watermark settings.
3. Settings are stored in `localStorage` under `safelight-watermark-templates`; the active template id is stored under `safelight-watermark-active-id`.
4. On export, a registered processor (`safelight-watermark.processor`) applies the template chosen in the Export panel via `OffscreenCanvas`.
5. Watermark text is scaled from the photo's long edge (`fontSize` as a percentage), so it looks consistent at any resolution — in the Develop overlay, the panel preview, and on export.

---

## Files

| File | Description |
|---|---|
| `index.js` | Full extension source: UI panel, Develop overlay, storage, watermark render logic, and export processor. |
| `safelight.json` | Extension manifest (name, version, description, author, entry point). |

---

## Technical notes

- **Styling** uses CSS variables from the Safelight theme (`--color-surface-*`, `--color-accent`, `--color-text-*`, `--color-border*`), so the extension follows the active theme automatically including dark mode.
- **Wayland/Niri compatibility:** all text and number inputs include `onKeyDown: e => e.stopPropagation()`. Under Wayland, Electron's global shortcut handler intercepts keydown events before they reach input elements; `stopPropagation()` prevents that interception. On X11, macOS, and Windows this is a no-op.
- **No `confirm()` dialog:** `window.confirm` is not available in Electron. Deleting a template happens immediately (the last remaining template cannot be deleted).
- Images are stored as a base64 data URL inside the template object — no separate file is written to disk.
- The Develop overlay and the panel preview share one helper (`getWatermarkBoxStyle`) for positioning, so both always show the same placement.
- **Separation of concerns:** `compositeWatermark()` (used by the export processor) never checks `template.enabled`. `applyWatermark()` (used by the panel preview) does check it, since the preview simulates what the Develop overlay shows.

---

## Changelog

### 1.2.0
- **Fix (Wayland/Niri):** text boxes in the panel were not editable under Wayland. Added `e.stopPropagation()` on `onKeyDown` to all typeable inputs (watermark text, template name fields, size, opacity, offset X/Y), preventing Safelight's global shortcut handler from intercepting keystrokes before they reach the input element.

### 1.1.0
- **New:** the "Watermark" section in Safelight's core Export panel now shows an **Apply watermark** toggle and a **Template** dropdown instead of "No settings." The settings list re-registers whenever templates change, so the dropdown always stays current.
- **Fix:** export processor used wrong signature `process(blob, settings)` — Safelight calls `process(blob, photo, settings)` — so the panel's chosen template was silently ignored.
- **Architecture:** the panel checkbox (renamed "Show live in Develop", was "Enable watermark") now only controls the live Develop overlay and the panel preview. Export is governed exclusively by the core Export panel controls via a dedicated `compositeWatermark()` path.

### 1.0.0 — Initial release
- Text or PNG watermark with configurable font/color, size, opacity, and 7-point anchored positioning.
- Multiple saved templates with persisted active selection.
- Live watermark overlay directly on the Develop canvas while editing.
- Auto-refreshing panel preview via `api.develop.captureFrame`, matching the export render path.
- Export processor always applies the actively selected template.

---

## Possible future improvements

- No size validation for very large PNGs (memory usage when base64-encoded into `localStorage`).
- No way to export/share templates between users or installs.

---

*This file is kept up to date as the extension changes.*
