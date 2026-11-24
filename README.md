# Safelight Watermark

A text or transparent PNG watermark for [Safelight](https://github.com/anthonyreimche/SafeLight). The mark is stored on the photo. Develop draws it on the open photo. The library thumbnail draws it on top of the cell. Export burns in the marks saved on that photo.

- **Version:** 1.3.0
- **Requires:** Safelight 3.2.6 or newer
- **Author:** OPGERUIMD97
- **Entry point:** `dist/index.js`

## Install

In Safelight, go to **View ▸ Extensions** and enter:

```
OPGERUIMD97/safelight-watermark
```

Then open **Develop ▸ Watermark**. Safelight 3.2.6 or newer.

## In Develop

The Watermark panel edits the photo that is open.

- **Watermark 1** is off until you choose **Text** or **PNG Image**. **Empty** is the default and draws nothing. **Add watermark (★ name)** applies the default template.
- **Templates** are round chips. The default is marked ★. **☆ Set as default**, **Rename**, **Overwrite**, **Save as template**, **Delete**, and **Reset all**. Double-click a chip to rename it. Saving under a name that already exists overwrites that template.
- **Size, opacity, rotate, offset X and offset Y** are sliders. **Font** and **Anchor** are choice lists. Colour is a swatch with an eyedropper.
- Drag the mark on the photo to move it. Drag the dot to rotate it.
- **Add extra watermark** opens Watermark 2, 3, … under this panel. Each one starts empty. A template chip on that panel applies the look and turns it on. These extra marks exist only in Develop.
- A green dot in the header means that watermark is on this photo. Hold the eye to hide it. Right-click the header and choose **Reset to defaults** to turn that one watermark off, as one undo step. **Reset all** also deletes every template, after you confirm.

The look (text, PNG, font, colour, size, opacity) lives on the template. The photo stores which template watermark 1 uses, and where the mark sits. Change the template later and every photo that points at it changes with it. An extra watermark keeps its own copy of the look.

## In the Library

Dock the Watermark panel in the Library to put watermark 1 on many photos at once. The panel there is a different set of controls. It does not show the Develop sliders, and it does not open extra watermarks.

1. Select photos in the grid.
2. Pick a template chip. The default ★ is picked first. Picking a chip does not apply it yet.
3. Click **Apply to N photos**. **Remove watermark** takes watermark 1 off again.
4. Export as usual. Each photo carries the watermark saved on it.

Every selected photo gets one undoable step. Extra watermarks already on a photo stay as they are. The panel works on the selection, not on the Develop controls of the photo that happens to be open. Fine-tune a single photo in Develop.

A green dot in the header, and a line in the panel, show how many of the selected photos have watermark 1. The library thumbnail draws the saved marks on top of the cell as soon as they are stored. The thumbnail picture itself is not rebuilt.

The Library Export panel has no Watermark section. Export still burns in the marks saved on each photo.

## Files

| File | Description |
|---|---|
| `src/index.js` | Extension source. `dist/index.js` is the copy Safelight loads. |
| `safelight.json` | Manifest: name, version, minimum app version, entry point. |
| `.github/workflows/release.yml` | Publishes a GitHub release when a `v*` tag is pushed. |

## Technical notes

- The panel uses the same controls as Border: `api.components.Slider`, `api.ui.Select`, and the theme colours (`var(--color-*)`). It does not set its own font or background.
- A slider writes while you drag and commits once when you let go. Double-click resets it to the default value.
- **Wayland/Niri:** text fields call `stopPropagation()` on keydown so characters reach the box.
- There is no `confirm()` dialog. Delete is hidden when only one template is left. **Reset all** asks in the panel.
- A PNG is stored as a data URL inside the template or the photo's mark.
- The Develop overlay follows the whole photo while zooming (`imageRect`), including a mark you dragged free on the picture.
- Templates live in this Safelight profile (`safelight-watermark-templates`). The default template is `safelight-watermark-default-id`.

## Changelog

### 1.3.0

- The Develop panel uses the same layout as Border: green dot, sliders, choice lists, round template chips, and a colour swatch with an eyedropper.
- **Empty** is the default for watermark 1 and draws nothing. **Text** or **PNG Image** turns it on. **Add extra watermark** opens another overlay for this photo only. A new extra panel starts empty. Rename, Overwrite, and Save as template with an existing name update that template. **Reset all** deletes every template and clears the watermarks on the open photo.
- In the Library the same panel applies watermark 1 to the selected photos, or removes it. Each photo gets one undo step. Extra watermarks stay in Develop.
- The library thumbnail draws the marks saved on the photo. Export burns those marks in. The Export panel no longer lists Watermark.
- Hold the eye to hide that panel's mark. **Reset to defaults** turns that watermark off on the open photo, as one undo step.

### 1.2.0

- **Fix (Wayland/Niri):** text boxes in the panel were not editable under Wayland. Added `e.stopPropagation()` on `onKeyDown` to all typeable inputs, so Safelight's shortcut handler does not take the keystrokes.

### 1.1.0

- **New:** the Watermark section in the Export panel showed an Apply toggle and a Template dropdown.
- **Fix:** the export processor used `process(blob, settings)`. Safelight calls `process(blob, photo, settings)`, so the chosen template was ignored.

### 1.0.0

- Text or PNG watermark with font, colour, size, opacity, and anchored placement.
- Saved templates.
- Live watermark on the Develop canvas.
- Export of the selected template.

## Possible future improvements

- No size validation for very large PNGs (memory usage when base64-encoded into `localStorage`).
- No way to export or share templates between installs.
