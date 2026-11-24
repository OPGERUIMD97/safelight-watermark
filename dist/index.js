// Safelight Watermark Extension v1.3.0
// Text or PNG watermark stored on the photo.
// Develop edits watermark 1 and any extra overlays on the open photo.
// Library applies watermark 1 to the selected photos.

const STORAGE_KEY = "safelight-watermark-templates";
const ACTIVE_KEY  = "safelight-watermark-active-id";
const DEFAULT_ID_KEY = "safelight-watermark-default-id";
const INSTANCES_KEY = "safelight-watermark.instances";
const PRIMARY_KEY = "safelight-watermark.primary";

function markKey(id) { return `safelight-watermark.mark.${id}`; }
function panelId(id) { return `safelight-watermark.panel.${id}`; }

const POSITIONS = [
  "bottom-right", "bottom-left", "bottom-center",
  "top-right",    "top-left",    "top-center",
  "center",
];

const DEFAULT_TEMPLATE = {
  id:       "default",
  name:     "© Copyright",
  enabled:  true,
  mode:     "text",        // "text" | "image"
  text:     "© Your Name",
  fontFamily: "sans-serif",
  fontSize:  2.5,          // % of long edge
  color:    "#ffffff",
  opacity:  80,            // 0-100
  position: "bottom-right",
  offsetX:  2,             // % from edge
  offsetY:  2,             // % from edge
  imageDataUrl: null,      // base64 PNG
};

const S = {
  container: {
    background: "var(--color-surface-0)", color: "inherit",
    fontSize: 11, padding: "10px 12px",
    height: "100%", overflowY: "auto", boxSizing: "border-box",
  },
  sectionTitle: {
    color: "var(--color-accent)", fontSize: 10, fontWeight: 600,
    letterSpacing: "0.06em", textTransform: "uppercase",
    margin: "12px 0 6px",
  },
  row:   { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  label: { color: "var(--color-text-secondary)", fontSize: 11 },
  input: {
    background: "var(--color-surface-2)", color: "var(--color-text-primary)", border: "1px solid var(--color-border)",
    borderRadius: 3, padding: "3px 6px", fontSize: 11, width: 140,
  },
  inputSmall: {
    background: "var(--color-surface-2)", color: "var(--color-text-primary)", border: "1px solid var(--color-border)",
    borderRadius: 3, padding: "3px 6px", fontSize: 11, width: 60, textAlign: "right",
  },
  select: {
    background: "var(--color-surface-2)", color: "var(--color-text-primary)", border: "1px solid var(--color-border)",
    borderRadius: 3, padding: "3px 6px", fontSize: 11, width: 150,
  },
  colorInput: {
    width: 36, height: 24, borderRadius: 3, border: "1px solid var(--color-border)",
    cursor: "pointer", padding: 0,
  },
  btn: {
    background: "var(--color-surface-2)", color: "var(--color-text-primary)", border: "1px solid var(--color-border)",
    borderRadius: 3, padding: "4px 10px", fontSize: 11, cursor: "pointer",
  },
  btnDanger: {
    background: "var(--color-surface-2)", color: "#E05252", border: "1px solid var(--color-border)",
    borderRadius: 3, padding: "4px 10px", fontSize: 11, cursor: "pointer",
  },
  divider:  { borderColor: "var(--color-surface-2)", margin: "10px 0" },
  checkbox: { accentColor: "var(--color-accent)", marginRight: 6 },
  tag: {
    display: "inline-block", padding: "2px 8px", borderRadius: 12,
    background: "var(--color-surface-2)", color: "var(--color-text-secondary)", fontSize: 10, marginRight: 4, marginBottom: 4, cursor: "pointer",
  },
  tagActive: {
    display: "inline-block", padding: "2px 8px", borderRadius: 12,
    background: "var(--color-accent)", color: "var(--color-text-primary)", fontSize: 10, marginRight: 4, marginBottom: 4, cursor: "pointer",
  },
  modeBtn: {
    flex: 1, padding: "5px 0", fontSize: 11, cursor: "pointer",
    border: "1px solid var(--color-border)", background: "var(--color-surface-2)", color: "var(--color-text-secondary)",
  },
  modeBtnActive: {
    flex: 1, padding: "5px 0", fontSize: 11, cursor: "pointer",
    border: "1px solid var(--color-accent)", background: "var(--color-accent)", color: "var(--color-on-accent, #fff)",
  },
  preview: {
    background: "var(--color-surface-1)", borderRadius: 4, padding: 8, marginTop: 6,
    display: "flex", alignItems: "center", justifyContent: "center",
    minHeight: 70, position: "relative", overflow: "hidden",
  },
};

// ── Storage ───────────────────────────────────────────────────────────────────
function loadTemplates() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [{ ...DEFAULT_TEMPLATE }];
}

function saveTemplates(tpls) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tpls)); } catch (e) {}
  try { window.dispatchEvent(new Event("safelight-watermark-templates")); } catch (e) {}
}

function loadActiveTemplateId() {
  try { return localStorage.getItem(ACTIVE_KEY) || null; } catch (e) { return null; }
}

function saveActiveTemplateId(id) {
  try { localStorage.setItem(ACTIVE_KEY, id); } catch (e) {}
}

function loadDefaultId() {
  try { return localStorage.getItem(DEFAULT_ID_KEY) || ""; } catch (e) { return ""; }
}

function saveDefaultId(id) {
  try {
    if (id) localStorage.setItem(DEFAULT_ID_KEY, id);
    else localStorage.removeItem(DEFAULT_ID_KEY);
  } catch (e) {}
}

function resolveDefault(list, id) {
  const items = Array.isArray(list) ? list : [];
  return items.find(t => t && t.id === id) || items.find(t => t && t.id === "default") || items[0] || null;
}

// Resolves which template should actually be used for export/preview: the
// persisted "active" id if it still exists, otherwise the first template.
// (Fixes the recurring bug — also seen in border/print-mat — where the
// export processor blindly used tpls[0] regardless of what was selected
// in the panel.)
function resolveExportTemplate(tpls) {
  if (!tpls || !tpls.length) return null;
  const activeId = loadActiveTemplateId();
  return tpls.find(t => t.id === activeId) || tpls[0];
}

// ── Shared positioning helper ─────────────────────────────────────────────────
// Computes the absolute CSS box for the watermark given the pixel size of its
// containing box (the caller is responsible for positioning that container,
// e.g. via rect.x/rect.y for the live Develop canvas). Used by both the panel
// preview (fixed mock box) and the live Develop canvas overlay, so the two
// always stay visually in sync.
// Longest side of a PNG is fontSize% of the photo's long edge — the same
// ratio drawWatermark uses for export. Width and height stay in proportion.
function fitImagePx(natural, longEdge, fontPct) {
  if (!natural || !natural.w || !natural.h || !(longEdge > 0)) return null;
  const target = longEdge * ((Number(fontPct) || 0) / 100);
  if (!(target > 0)) return null;
  const scale = target / Math.max(natural.w, natural.h);
  return {
    width: Math.max(1, Math.round(natural.w * scale)),
    height: Math.max(1, Math.round(natural.h * scale)),
  };
}

function containedRect(cellW, cellH, photoW, photoH) {
  if (!(cellW > 0) || !(cellH > 0)) return { x: 0, y: 0, w: 0, h: 0 };
  if (!(photoW > 0) || !(photoH > 0)) return { x: 0, y: 0, w: cellW, h: cellH };
  const scale = Math.min(cellW / photoW, cellH / photoH);
  const w = photoW * scale;
  const h = photoH * scale;
  return { x: (cellW - w) / 2, y: (cellH - h) / 2, w, h };
}

function thumbMarkVisible(mark) {
  if (!mark || mark.mode === "empty") return false;
  if (mark.mode === "image") return !!mark.imageDataUrl;
  return !!(mark.text && String(mark.text).trim());
}

function markRotation(t) {
  const n = Number(t && t.rotation);
  if (!Number.isFinite(n)) return 0;
  return ((n + 180) % 360 + 360) % 360 - 180;
}

function cssRotation(rotation) {
  const n = Number(rotation) || 0;
  return n ? `rotate(${n}deg)` : "";
}

function isFreePlacement(t) {
  return t.position === "free" && Number.isFinite(Number(t.posX)) && Number.isFinite(Number(t.posY));
}

// Center of the mark inside its box. Free placement stores that center as a
// percentage of the box. Anchors still pin a corner, then the center follows.
function markCenterPx(t, boxW, boxH, markW, markH) {
  if (isFreePlacement(t)) return { x: boxW * Number(t.posX) / 100, y: boxH * Number(t.posY) / 100 };
  const padX = boxW * ((Number(t.offsetX) || 0) / 100);
  const padY = boxH * ((Number(t.offsetY) || 0) / 100);
  const pos = t.position || "bottom-right";
  const x = pos.includes("left") ? padX + markW / 2
    : pos.includes("right") ? boxW - padX - markW / 2
    : boxW / 2;
  const y = pos.includes("top") ? padY + markH / 2
    : pos.includes("bottom") ? boxH - padY - markH / 2
    : boxH / 2;
  return { x, y };
}

function getWatermarkBoxStyle(t, boxW, boxH) {
  const rot = cssRotation(markRotation(t));
  if (isFreePlacement(t)) {
    return {
      position: "absolute", pointerEvents: "none",
      left: `${Number(t.posX)}%`, top: `${Number(t.posY)}%`,
      transform: ["translate(-50%, -50%)", rot].filter(Boolean).join(" "),
      opacity: t.opacity / 100,
    };
  }
  const pos = t.position || "bottom-right";
  const isCenter  = pos === "center";
  const isCenterH = pos.includes("center") && !isCenter; // bottom-center / top-center
  const padX = boxW * (t.offsetX / 100);
  const padY = boxH * (t.offsetY / 100);
  const anchor = isCenter ? "translate(-50%, 50%)" : isCenterH ? "translateX(-50%)" : "";
  return {
    position: "absolute", pointerEvents: "none",
    bottom: pos.includes("bottom") ? padY : isCenter ? "50%" : undefined,
    top:    pos.includes("top")    ? padY : undefined,
    left:   pos.includes("left")   ? padX : (isCenterH || isCenter) ? "50%" : undefined,
    right:  pos.includes("right")  ? padX : undefined,
    transform: [anchor, rot].filter(Boolean).join(" ") || undefined,
    opacity: t.opacity / 100,
  };
}

// ── Watermark draw helper ─────────────────────────────────────────────────────
async function drawWatermark(ctx, W, H, t, box) {
  if (!t || t.mode === "empty") return;
  const x0 = box ? box.x : 0;
  const y0 = box ? box.y : 0;
  const bw = box ? box.w : W;
  const bh = box ? box.h : H;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, bw, bh);
  ctx.clip();
  ctx.globalAlpha = t.opacity / 100;

  const spin = (cx, cy, draw) => {
    ctx.save();
    ctx.translate(x0 + cx, y0 + cy);
    ctx.rotate(markRotation(t) * Math.PI / 180);
    draw();
    ctx.restore();
  };

  if (t.mode === "text") {
    const fontSize = Math.round(Math.max(W, H) * (t.fontSize / 100));
    ctx.font      = `${fontSize}px ${t.fontFamily}`;
    ctx.fillStyle = t.color;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    const metrics = ctx.measureText(t.text || "");
    const c = markCenterPx(t, bw, bh, metrics.width, fontSize);
    spin(c.x, c.y, () => ctx.fillText(t.text || "", 0, 0));

  } else if (t.mode === "image" && t.imageDataUrl) {
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload  = res;
      img.onerror = rej;
      img.src = t.imageDataUrl;
    });
    const scale = (Math.max(W, H) * (t.fontSize / 100)) / Math.max(img.width, img.height);
    const iW = img.width  * scale;
    const iH = img.height * scale;
    const c = markCenterPx(t, bw, bh, iW, iH);
    spin(c.x, c.y, () => ctx.drawImage(img, -iW / 2, -iH / 2, iW, iH));
  }

  ctx.restore();
}

function stampFromTemplate(t, keepId) {
  return {
    id: keepId && t.id ? String(t.id) : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: t.name || "Watermark",
    enabled: t.enabled !== false,
    mode: t.mode === "empty" ? "empty" : (t.mode === "image" ? "image" : "text"),
    text: t.text || "",
    fontFamily: t.fontFamily || "sans-serif",
    fontSize: Number(t.fontSize) || 2.5,
    color: t.color || "#ffffff",
    opacity: Number.isFinite(Number(t.opacity)) ? Number(t.opacity) : 80,
    position: t.position === "free" && Number.isFinite(Number(t.posX)) && Number.isFinite(Number(t.posY))
      ? "free"
      : (POSITIONS.includes(t.position) ? t.position : "bottom-right"),
    posX: Number.isFinite(Number(t.posX)) ? Number(t.posX) : null,
    posY: Number.isFinite(Number(t.posY)) ? Number(t.posY) : null,
    rotation: markRotation(t),
    offsetX: Number(t.offsetX) || 0,
    offsetY: Number(t.offsetY) || 0,
    imageDataUrl: t.imageDataUrl || null,
    place: t.place === "strip" ? "strip" : "on",
    stripColor: t.stripColor || "#111111",
    stripHeight: Number(t.stripHeight) || 8,
  };
}

function readInstanceIds(bag) {
  const raw = bag && bag[INSTANCES_KEY];
  if (!Array.isArray(raw)) return [];
  const ids = [];
  for (const n of raw) {
    const id = Number(n);
    if (Number.isInteger(id) && id >= 2 && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

function readMark(bag, id) {
  const raw = bag && bag[markKey(id)];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const mark = stampFromTemplate(raw, true);
  if (raw.templateId) mark.templateId = raw.templateId;
  return mark;
}

function emptyMark(name) {
  return stampFromTemplate({
    mode: "empty",
    name: name || "Watermark",
    enabled: true,
    text: "",
    fontFamily: "sans-serif",
    fontSize: 2.5,
    color: "#ffffff",
    opacity: 80,
    position: "bottom-right",
    offsetX: 2,
    offsetY: 2,
    rotation: 0,
    place: "on",
    imageDataUrl: null,
  });
}

// Watermark 1 is not "the extension is installed". A photo has it only when
// this record is stored on that photo. The look still comes from the template.
function readPrimary(bag, tpls) {
  const raw = bag && bag[PRIMARY_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || raw.on === false || !raw.templateId) return null;
  const list = tpls && tpls.length ? tpls : loadTemplates();
  const tpl = list.find(t => t.id === raw.templateId);
  if (!tpl) return null;
  return stampFromTemplate({
    ...tpl,
    position: raw.position || tpl.position,
    posX: raw.posX,
    posY: raw.posY,
    rotation: raw.rotation,
    offsetX: raw.offsetX != null ? raw.offsetX : tpl.offsetX,
    offsetY: raw.offsetY != null ? raw.offsetY : tpl.offsetY,
    place: raw.place === "strip" ? "strip" : "on",
    stripColor: raw.stripColor || tpl.stripColor,
    stripHeight: raw.stripHeight || tpl.stripHeight,
  }, true);
}

// Library apply stores watermark 1 only. A free placement on the template
// becomes the bottom-right anchor; extra overlays are left untouched.
export function primaryFromTemplate(tpl) {
  if (!tpl || !tpl.id || tpl.mode === "empty") return null;
  const offset = (v, fallback) => (v != null && Number.isFinite(Number(v)) ? Number(v) : fallback);
  return {
    on: true,
    templateId: tpl.id,
    position: POSITIONS.includes(tpl.position) ? tpl.position : "bottom-right",
    rotation: markRotation(tpl),
    offsetX: offset(tpl.offsetX, 2),
    offsetY: offset(tpl.offsetY, 2),
  };
}

export const WATERMARK_OFF = { on: false };

// One undoable step on a photo that is not the Develop session, the same
// shape core uses when pasting settings.
export function appendEditStep(editState, photoId, patch, label, fresh, now = Date.now()) {
  const stack0 = editState && Array.isArray(editState.stack) ? editState.stack : [];
  const ci = editState ? editState.currentIndex : -1;
  const cursor = Number.isInteger(ci) && ci >= 0 && ci < stack0.length ? ci : stack0.length - 1;
  const stack = stack0.slice(0, cursor + 1);
  if (stack.length === 0) stack.push({ timestamp: now, label: "Original", params: fresh(), paramBag: {} });
  const top = stack[stack.length - 1];
  stack.push({
    timestamp: now,
    label,
    params: top.params,
    paramBag: { ...(top.paramBag || {}), ...patch },
  });
  return { photoId, stack, currentIndex: stack.length - 1 };
}

export function watermarkInfo(bag, templates) {
  const primary = readPrimary(bag, templates);
  if (!primary) return false;
  return { name: primary.name || null };
}

function panelHeld(bypassed, id) {
  return bypassHeld(bypassed, panelId(id));
}

function mainHeld(bypassed) {
  return bypassHeld(bypassed, "safelight-watermark.panel");
}

function bypassHeld(bypassed, pid) {
  if (!bypassed || !pid) return false;
  for (const key of Object.keys(bypassed)) {
    if (!bypassed[key]) continue;
    if (key === pid || key.endsWith(`/${pid}`)) return true;
  }
  return false;
}

function instanceMarks(bag, bypassed) {
  const out = [];
  for (const id of readInstanceIds(bag)) {
    if (panelHeld(bypassed, id)) continue;
    const mark = readMark(bag, id);
    if (mark && mark.mode !== "empty") out.push({ ...mark, instanceId: id });
  }
  return out;
}

// Pure compositing: draws the watermark unconditionally, no "enabled" check.
// Used by the export processor, which decides enable/disable purely from the
// core Export panel's own toggle — never from this template's own checkbox.
async function compositeWatermark(blob, template) {
  const bitmap = await createImageBitmap(blob);
  const W = bitmap.width, H = bitmap.height;
  const canvas = new OffscreenCanvas(W, H);
  const ctx    = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);
  await drawWatermark(ctx, W, H, template);
  return canvas.convertToBlob({ type: blob.type || "image/jpeg", quality: 0.95 });
}

// Stamps with place "strip" add a band under the photo, so the file grows.
// Stamps with place "on" are drawn on the photo and do not change its size.
async function compositeMarks(blob, marks) {
  const list = (marks || []).filter(m => m);
  const on = list.filter(m => m.place !== "strip");
  const strips = list.filter(m => m.place === "strip");
  const bitmap = await createImageBitmap(blob);
  try {
    const W = bitmap.width, H = bitmap.height;
    const heights = strips.map(m => Math.max(1, Math.round(H * (Number(m.stripHeight) || 8) / 100)));
    const extra = heights.reduce((sum, h) => sum + h, 0);
    const canvas = new OffscreenCanvas(W, H + extra);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    for (const m of on) await drawWatermark(ctx, W, H, m);
    let y = H;
    for (let i = 0; i < strips.length; i++) {
      const m = strips[i];
      const h = heights[i];
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.fillStyle = m.stripColor || "#111111";
      ctx.fillRect(0, y, W, h);
      ctx.restore();
      await drawWatermark(ctx, W, H, m, { x: 0, y, w: W, h });
      y += h;
    }
    return canvas.convertToBlob({ type: blob.type || "image/jpeg", quality: 0.95 });
  } finally {
    bitmap.close?.();
  }
}

let closeInstancePanels = () => {};

// ── Panel ─────────────────────────────────────────────────────────────────────
export function activate(api) {
  const { react: React, stores } = api;
  const { useState, useEffect, useLayoutEffect, useRef } = React;
  const ce = (type, props, ...ch) => React.createElement(type, props, ...ch);

  // Wayland / Niri fix: Electron's global shortcut handler intercepts keydown
  // events before they reach input elements when running under Wayland. Adding
  // stopPropagation() on every typeable input prevents that interception, so
  // characters actually appear in the text box.
  // On X11/macOS/Windows this is a no-op — stopPropagation has no side effects
  // on vanilla platforms because the global handler runs in a separate context.
  const stopKeys = e => e.stopPropagation();

  function commitBag(label) {
    if (commitTimer) {
      clearTimeout(commitTimer);
      commitTimer = null;
      commitPending = null;
    }
    const devStore = stores?.useDevelopStore;
    const current = devStore && devStore.getState ? devStore.getState() : null;
    if (!current || typeof current.commitEdit !== "function") return;
    current.commitEdit(label || "Watermark");
  }

  const comps = api.components || {};
  const ui = api.ui || {};
  const devApi = api.develop || {};
  const rowStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 26 };
  const labelStyle = { fontSize: 12, flex: "0 0 auto" };
  const hintStyle = { fontSize: 11, color: "var(--color-text-muted)", lineHeight: 1.4 };
  const wrapStyle = { display: "flex", flexDirection: "column", gap: 6, padding: "6px 10px 10px" };
  const smallBtn = {
    fontSize: 11, padding: "3px 8px", borderRadius: 4, cursor: "pointer",
    border: "1px solid var(--color-border)", background: "transparent", color: "inherit",
  };
  const fieldInput = {
    width: "100%", fontSize: 12, padding: "3px 6px", borderRadius: 4, boxSizing: "border-box",
    border: "1px solid var(--color-border)", background: "var(--color-surface-0)", color: "inherit",
  };
  const FONT_OPTIONS = [
    { value: "sans-serif", label: "Sans-serif" },
    { value: "serif", label: "Serif" },
    { value: "monospace", label: "Monospace" },
    { value: "Georgia", label: "Georgia" },
    { value: "Helvetica Neue", label: "Helvetica Neue" },
  ];
  const TYPE_OPTIONS = [
    { value: "text", label: "Text" },
    { value: "image", label: "PNG Image" },
    { value: "empty", label: "Empty" },
  ];
  const PLACE_OPTIONS = [
    { value: "on", label: "On the photo" },
    { value: "strip", label: "Strip below" },
  ];
  function anchorOptions(position) {
    const opts = POSITIONS.map(p => ({
      value: p,
      label: p.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
    }));
    if (position === "free") opts.unshift({ value: "free", label: "Placed on photo" });
    return opts;
  }

  const chipStyle = (active) => ({
    fontSize: 11, lineHeight: "16px", padding: "2px 10px", borderRadius: 999, cursor: "pointer",
    whiteSpace: "nowrap",
    border: `1px solid ${active ? "var(--color-accent)" : "var(--color-border)"}`,
    background: active ? "var(--color-accent)" : "transparent",
    color: active ? "var(--color-on-accent, #fff)" : "inherit",
  });

  function SelectRow({ label, value, options, onChange }) {
    const control = ui.Select
      ? ce(ui.Select, { value, onChange, options, ariaLabel: label })
      : ce("select", {
          value, onChange: e => onChange(e.target.value),
          style: fieldInput,
        }, options.map(o => ce("option", { key: o.value, value: o.value }, o.label)));
    return ce("div", { style: rowStyle },
      ce("span", { style: labelStyle }, label),
      ce("div", { style: { flex: "0 1 60%" } }, control),
    );
  }

  function NumSlider({ label, value, min, max, step, defaultValue, onChange, onCommit }) {
    const shown = Number.isFinite(Number(value)) ? Number(value) : defaultValue;
    if (comps.Slider) {
      return ce(comps.Slider, {
        label, value: shown, min, max, step, defaultValue,
        onChange, onCommit,
      });
    }
    return ce("label", { style: { display: "block", fontSize: 12 } },
      `${label}: ${shown}`,
      ce("input", {
        type: "range", min, max, step, value: shown, style: { width: "100%" },
        onChange: e => onChange(Number(e.target.value)),
        onPointerUp: onCommit,
        onKeyUp: onCommit,
      }),
    );
  }

  function ColorRow({ label, value, onChange, onCommit }) {
    const [picking, setPicking] = useState(false);
    useEffect(() => () => { if (picking) devApi.setPickDrag?.(null); }, [picking]);
    const pick = () => {
      if (typeof devApi.setPickDrag !== "function") return;
      if (picking) { devApi.setPickDrag(null); setPicking(false); return; }
      setPicking(true);
      devApi.setPickDrag({
        onDown: (rgb) => {
          const hex = rgbToHex(rgb);
          onChange(hex);
          onCommit?.();
          devApi.setPickDrag(null);
          setPicking(false);
        },
      });
    };
    const swatch = {
      width: 44, height: 22, padding: 0, border: "1px solid var(--color-border)",
      borderRadius: 4, background: "none", cursor: "pointer",
    };
    const btn = {
      width: 26, height: 22, display: "inline-flex", alignItems: "center", justifyContent: "center",
      border: "1px solid var(--color-border)", borderRadius: 4, cursor: "pointer",
      background: picking ? "var(--color-accent)" : "transparent",
      color: picking ? "var(--color-on-accent, #fff)" : "inherit",
    };
    return ce("div", { style: { ...rowStyle, minHeight: 28 } },
      ce("span", { style: labelStyle }, label),
      ce("div", { style: { display: "flex", gap: 6, alignItems: "center" } },
        ce("input", {
          type: "color", value: value || "#ffffff", style: swatch, "aria-label": label,
          onChange: e => onChange(e.target.value),
          onBlur: () => onCommit?.(),
        }),
        typeof devApi.setPickDrag === "function"
          ? ce("button", { type: "button", style: btn, title: "Pick a colour from the photo", onClick: pick },
              comps.PickerIcon ? ce(comps.PickerIcon, { size: 12 }) : "⌖")
          : null,
      ),
    );
  }

  function rgbToHex(rgb) {
    const n = v => Math.round(Math.min(1, Math.max(0, Number(v) || 0)) * 255).toString(16).padStart(2, "0");
    return `#${n(rgb[0])}${n(rgb[1])}${n(rgb[2])}`;
  }

  let commitTimer = null;
  let commitPending = null;
  function writeBag(patch, label, immediate) {
    const devStore = stores?.useDevelopStore;
    const dev = devStore && devStore.getState ? devStore.getState() : null;
    if (!dev || !dev.photoId) return false;
    const photoId = dev.photoId;
    if (typeof dev.setDynParams === "function") dev.setDynParams(patch);
    else if (typeof dev.setDynParam === "function") {
      for (const key of Object.keys(patch)) dev.setDynParam(key, patch[key]);
    } else return false;
    const commit = () => {
      const current = devStore.getState();
      if (!current || current.photoId !== photoId || typeof current.commitEdit !== "function") return;
      current.commitEdit(label || "Watermark");
    };
    if (immediate === "live") return true;
    if (commitTimer) clearTimeout(commitTimer);
    commitTimer = null;
    if (immediate) {
      commitPending = null;
      commit();
    } else {
      commitPending = commit;
      commitTimer = setTimeout(() => { commitTimer = null; commitPending = null; commit(); }, 400);
    }
    return true;
  }

  function flushMarks() {
    if (!commitTimer || !commitPending) return;
    clearTimeout(commitTimer);
    commitTimer = null;
    const commit = commitPending;
    commitPending = null;
    commit();
  }

  async function bagForPhoto(photo) {
    const dev = stores?.useDevelopStore?.getState?.();
    if (dev && photo && dev.photoId === photo.id) {
      return { bag: dev.paramBag || {}, bypassed: dev.bypassedPanels || {} };
    }
    if (photo && api.catalog && typeof api.catalog.getEditState === "function") {
      const edit = await api.catalog.getEditState(photo.id);
      const stack = edit && edit.stack;
      const snap = stack && stack.length
        ? stack[Math.min(edit.currentIndex || 0, stack.length - 1)]
        : null;
      return {
        bag: (snap && snap.paramBag) || {},
        bypassed: (snap && snap.bypassedPanels) || (edit && edit.bypassedPanels) || {},
      };
    }
    return { bag: {}, bypassed: {} };
  }

  if (typeof api.registerExportProcessor === "function") {
    api.registerExportProcessor({
      id: "safelight-watermark.processor",
      label: "Watermark",
      hidden: true,
      async process(blob, photo) {
        try {
          const { bag, bypassed } = await bagForPhoto(photo);
          const primary = mainHeld(bypassed) ? null : readPrimary(bag, loadTemplates());
          const marks = instanceMarks(bag, bypassed);
          const list = primary ? [primary, ...marks] : marks;
          if (list.length) return await compositeMarks(blob, list);
        } catch (err) {
          console.warn("[safelight-watermark] edit state", err);
        }
        return blob;
      },
    });
  }

  const FRESH_PROCESS_VERSION = 2;
  const catalogApi = api.catalog || {};
  const useCatalogStore = stores?.useCatalogStore;
  const useUIStore = stores?.useUIStore;
  const createStore = stores?.create;
  const useMarkMap = typeof createStore === "function" ? createStore(() => ({ map: {} })) : null;

  function setMarkInfo(id, info) {
    if (!useMarkMap || !id) return;
    const prev = useMarkMap.getState().map[id];
    if (JSON.stringify(prev) === JSON.stringify(info)) return;
    useMarkMap.setState(st => ({ map: { ...st.map, [id]: info } }));
  }

  function bagFromEdit(edit) {
    const stack = edit && Array.isArray(edit.stack) ? edit.stack : [];
    if (!stack.length) return {};
    const ci = edit.currentIndex;
    const i = Number.isInteger(ci) && ci >= 0 && ci < stack.length ? ci : stack.length - 1;
    return (stack[i] && stack[i].paramBag) || {};
  }

  async function refreshMark(id) {
    if (typeof catalogApi.getEditState !== "function") return;
    try {
      setMarkInfo(id, watermarkInfo(bagFromEdit(await catalogApi.getEditState(id)), loadTemplates()));
    } catch (err) {}
  }

  async function applyToSelection(ids, primaryValue, label, onProgress) {
    const photos = new Map((useCatalogStore?.getState?.().photos || []).map(p => [p.id, p]));
    const norm = api.develop?.normalizeParams;
    const patch = { [PRIMARY_KEY]: primaryValue };
    let done = 0;
    for (const id of ids) {
      const photo = photos.get(id);
      if (!photo) continue;
      const asShot = photo.exif?.colorTemperature ?? 6500;
      const fresh = () => {
        const base = { temperature: asShot, processVersion: FRESH_PROCESS_VERSION };
        return typeof norm === "function" ? norm(base) : base;
      };
      const existing = await catalogApi.getEditState(id);
      await catalogApi.putEditState(appendEditStep(existing, id, patch, label, fresh));
      if (typeof catalogApi.requestThumbnail === "function") catalogApi.requestThumbnail(id);
      setMarkInfo(id, watermarkInfo(patch, loadTemplates()));
      done += 1;
      if (onProgress) onProgress(done);
    }
    return done;
  }

  function LibraryPanel() {
    const selected = useCatalogStore ? useCatalogStore(s => s.selectedIds) : null;
    const ids = selected ? Array.from(selected) : [];
    const n = ids.length;
    const [list, setList] = useState(loadTemplates);
    const [pickId, setPickId] = useState(() => (resolveDefault(loadTemplates(), loadDefaultId()) || {}).id);
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState("");
    const map = useMarkMap ? useMarkMap(s => s.map) : {};
    const canWrite = typeof catalogApi.getEditState === "function" && typeof catalogApi.putEditState === "function";
    const pick = list.find(t => t.id === pickId) || null;
    const star = resolveDefault(list, loadDefaultId());
    const key = ids.join("|");

    useEffect(() => {
      const sync = () => setList(loadTemplates());
      window.addEventListener("safelight-watermark-templates", sync);
      return () => window.removeEventListener("safelight-watermark-templates", sync);
    }, []);
    useEffect(() => {
      for (const id of ids) if (map[id] === undefined) void refreshMark(id);
    }, [key]);

    const withMark = ids.filter(id => map[id]);
    const names = Array.from(new Set(withMark.map(id => map[id].name || "Watermark")));
    const run = async (value, label, verb) => {
      if (!n || busy) return;
      setBusy(true);
      setStatus(`${verb} 0 / ${n}…`);
      try {
        const done = await applyToSelection(ids, value, label, d => setStatus(`${verb} ${d} / ${n}…`));
        setStatus(`Done: ${done} photo${done === 1 ? "" : "s"}. Export as usual.`);
      } catch (err) {
        console.warn("[safelight-watermark] library apply failed:", err);
        setStatus("Something went wrong; see the console.");
      } finally {
        setBusy(false);
      }
    };
    const applyBtn = (primary, disabled) => ({
      ...smallBtn,
      cursor: disabled ? "default" : "pointer",
      border: `1px solid ${primary ? "var(--color-accent)" : "var(--color-border)"}`,
      background: primary && !disabled ? "var(--color-accent)" : "transparent",
      color: primary && !disabled ? "var(--color-on-accent, #fff)" : "inherit",
      opacity: disabled ? 0.5 : 1,
    });
    if (!canWrite) {
      return ce("div", { style: wrapStyle },
        ce("div", { style: hintStyle }, "This Safelight version can't write watermarks from the Library. Open a photo in Develop to add one."));
    }
    const off = !n || busy || !pick || pick.mode === "empty";
    return ce("div", { style: wrapStyle },
      ce("span", { style: labelStyle }, "Templates"),
      ce("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } },
        ...list.map(t => ce("button", {
          key: t.id, type: "button", style: chipStyle(t.id === pickId),
          onClick: () => setPickId(t.id),
          "aria-pressed": t.id === pickId,
        }, `${star && t.id === star.id ? "★ " : ""}${t.name}`))),
      ce("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "flex-end" } },
        ce("button", {
          type: "button", style: applyBtn(false, !n || busy), disabled: !n || busy,
          onClick: () => run(WATERMARK_OFF, "Remove watermark", "Removing"),
        }, "Remove watermark"),
        ce("button", {
          type: "button", style: applyBtn(true, off), disabled: off,
          onClick: () => run(primaryFromTemplate(pick), `Watermark template: ${pick.name}`, "Adding"),
        }, n ? `Apply to ${n} photo${n === 1 ? "" : "s"}` : "Select photos")),
      status ? ce("div", { style: { fontSize: 11 } }, status) : null,
      n ? ce("div", { style: { display: "flex", alignItems: "center", gap: 6, fontSize: 11 } },
        withMark.length ? activeDot(`Watermark on: ${names.join(", ")}`) : null,
        withMark.length
          ? `${withMark.length} of ${n} selected ${withMark.length === 1 ? "has" : "have"} a watermark (${names.join(", ")})`
          : `None of the ${n} selected ${n === 1 ? "has" : "have"} a watermark`) : null,
      ce("div", { style: hintStyle },
        "Select photos in the grid, pick a template and click Apply. Each photo gets watermark 1 as an undoable step, and it goes along with every export. ",
        "Extra watermarks stay in Develop. Fine-tune a single photo there."),
    );
  }

  function WatermarkPanel() {
    const module = useUIStore ? useUIStore(s => s.activeModule) : "develop";
    if (module === "library") return ce(LibraryPanel);
    return ce(DevelopWatermark);
  }

  function DevelopWatermark() {
    const [templates, setTemplates] = useState(loadTemplates);
    const [activeIdx, setActiveIdx] = useState(() => {
      const tpls = loadTemplates();
      const activeId = loadActiveTemplateId();
      const idx = tpls.findIndex(x => x.id === activeId);
      return idx >= 0 ? idx : 0;
    });
    const [newName,    setNewName]    = useState("");
    const [showNew,    setShowNew]    = useState(false);
    const [developPhotoId, setDevelopPhotoId] = useState(null);
    const [instanceIds, setInstanceIds] = useState([]);
    const [primary, setPrimary] = useState(null);
    const [defId, setDefId] = useState(loadDefaultId);
    const fileRef = useRef(null);

    useEffect(() => {
      const sync = () => {
        const next = loadTemplates();
        setTemplates(prev => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
        setDefId(loadDefaultId());
        setActiveIdx(i => (next[i] ? i : 0));
      };
      window.addEventListener("safelight-watermark-templates", sync);
      return () => window.removeEventListener("safelight-watermark-templates", sync);
    }, []);

    const t = templates[activeIdx] || templates[0] || DEFAULT_TEMPLATE;

    const selectTemplate = (i) => {
      setActiveIdx(i);
      const tpl = templates[i];
      if (!tpl) return;
      saveActiveTemplateId(tpl.id);
      const dev = stores?.useDevelopStore?.getState?.();
      const prev = dev && dev.paramBag && dev.paramBag[PRIMARY_KEY];
      if (dev && dev.photoId && prev && prev.on !== false && prev.templateId) {
        writeBag({ [PRIMARY_KEY]: { ...prev, on: true, templateId: tpl.id } }, "Watermark", true);
      }
    };

    const update = (key, val) => {
      setTemplates(prev => {
        const next = prev.map((x, i) => i === activeIdx ? { ...x, [key]: val } : x);
        saveTemplates(next);
        return next;
      });
    };

    const addPanel = () => {
      const dev = stores?.useDevelopStore?.getState?.();
      if (!dev || !dev.photoId || !t) return;
      const ids = readInstanceIds(dev.paramBag);
      const id = Math.max(1, ...ids, 1) + 1;
      const mark = emptyMark(`Watermark ${id}`);
      if (!writeBag({
        [INSTANCES_KEY]: [...ids, id],
        [markKey(id)]: mark,
      }, `Watermark ${id}`, true)) return;
      syncInstancePanels(false);
      openNewPanel(id);
    };

    const removePanel = (id) => {
      const dev = stores?.useDevelopStore?.getState?.();
      if (!dev || !dev.photoId) return;
      const ids = readInstanceIds(dev.paramBag).filter(n => n !== id);
      writeBag({
        [INSTANCES_KEY]: ids,
        [markKey(id)]: null,
      }, `Watermark ${id}`, true);
      syncInstancePanels(false);
    };

    const currentLook = () => ({
      ...t,
      position: placeOf.position === "free" ? t.position : (placeOf.position || t.position),
      offsetX: placeOf.offsetX != null ? placeOf.offsetX : t.offsetX,
      offsetY: placeOf.offsetY != null ? placeOf.offsetY : t.offsetY,
      rotation: markRotation(placeOf),
    });

    const overwriteTemplate = () => {
      if (!t) return;
      const look = currentLook();
      setTemplates(prev => {
        const next = prev.map((x, i) => i === activeIdx ? { ...look, id: x.id, name: x.name } : x);
        saveTemplates(next);
        return next;
      });
    };

    const saveAsTemplate = (name) => {
      const n = (name || "").trim();
      if (!n || !t) return;
      setShowNew(false);
      setNewName("");
      const look = currentLook();
      const existing = templates.find(x => x.name === n);
      if (existing) {
        setTemplates(prev => {
          const next = prev.map(x => x.id === existing.id ? { ...look, id: existing.id, name: existing.name } : x);
          saveTemplates(next);
          return next;
        });
        const i = templates.findIndex(x => x.id === existing.id);
        if (i >= 0) setActiveIdx(i);
        saveActiveTemplateId(existing.id);
        if (primaryOn) {
          const dev = stores?.useDevelopStore?.getState?.();
          const prev = dev && dev.paramBag && dev.paramBag[PRIMARY_KEY];
          if (prev && prev.on !== false) writeBag({ [PRIMARY_KEY]: { ...prev, on: true, templateId: existing.id } }, "Watermark", true);
        }
        return;
      }
      const id = Date.now().toString();
      const created = { ...look, id, name: n };
      setTemplates(prev => {
        const next = [...prev, created];
        saveTemplates(next);
        return next;
      });
      setActiveIdx(templates.length);
      saveActiveTemplateId(id);
      if (primaryOn) {
        const dev = stores?.useDevelopStore?.getState?.();
        const prev = dev && dev.paramBag && dev.paramBag[PRIMARY_KEY];
        if (prev && prev.on !== false) writeBag({ [PRIMARY_KEY]: { ...prev, on: true, templateId: id } }, "Watermark", true);
      }
    };

    const resetEverything = () => {
      const fresh = { ...DEFAULT_TEMPLATE };
      saveTemplates([fresh]);
      saveDefaultId("");
      saveActiveTemplateId(fresh.id);
      setTemplates([fresh]);
      setActiveIdx(0);
      setDefId("");
      setShowNew(false);
      setNewName("");
      const dev = stores?.useDevelopStore?.getState?.();
      if (!dev || !dev.photoId) return;
      const patch = { [PRIMARY_KEY]: { on: false }, [INSTANCES_KEY]: [] };
      for (const id of readInstanceIds(dev.paramBag)) patch[markKey(id)] = null;
      writeBag(patch, "Reset Watermark", true);
      syncInstancePanels(false);
    };

    const renameTemplate = () => {
      const n = newName.trim();
      setShowNew(false);
      setNewName("");
      if (!n) return;
      setTemplates(prev => {
        const next = prev.map((x, i) => i === activeIdx ? { ...x, name: n } : x);
        saveTemplates(next);
        return next;
      });
    };

    const deleteTemplate = () => {
      if (templates.length <= 1 || !t) return;
      const removedId = t.id;
      if (loadDefaultId() === removedId) {
        saveDefaultId("");
        setDefId("");
      }
      setTemplates(prev => {
        const next = prev.filter(x => x.id !== removedId);
        saveTemplates(next);
        const newIdx = Math.max(0, Math.min(activeIdx, next.length - 1));
        setActiveIdx(newIdx);
        if (next[newIdx]) saveActiveTemplateId(next[newIdx].id);
        return next;
      });
      if (primary && primary.templateId === removedId) {
        writeBag({ [PRIMARY_KEY]: { ...primary, on: false } }, "Watermark", true);
      }
    };

    const loadImage = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => update("imageDataUrl", ev.target.result);
      reader.readAsDataURL(file);
    };

    useEffect(() => {
      const devStore = stores?.useDevelopStore;
      if (!devStore) return undefined;
      const sync = state => {
        const ids = readInstanceIds(state && state.paramBag);
        const raw = state && state.paramBag && state.paramBag[PRIMARY_KEY];
        const nextPrimary = raw && raw.on !== false && raw.templateId ? raw : null;
        setDevelopPhotoId(state && state.photoId || null);
        setInstanceIds(prev => (prev.length === ids.length && prev.every((n, i) => n === ids[i]) ? prev : ids));
        setPrimary(prev => (JSON.stringify(prev) === JSON.stringify(nextPrimary) ? prev : nextPrimary));
      };
      sync(devStore.getState());
      return devStore.subscribe(sync);
    }, []);

    useEffect(() => () => { flushMarks(); }, []);

    const primaryOn = !!(primary && primary.templateId);
    const placeOf = primaryOn ? {
      position: primary.position || t.position,
      rotation: primary.rotation != null ? primary.rotation : t.rotation,
      offsetX: primary.offsetX != null ? primary.offsetX : t.offsetX,
      offsetY: primary.offsetY != null ? primary.offsetY : t.offsetY,
    } : t;

    const setPrimaryPlacement = (patch, immediate) => {
      const dev = stores?.useDevelopStore?.getState?.();
      if (!dev || !dev.photoId) return;
      const prev = (dev.paramBag && dev.paramBag[PRIMARY_KEY]) || {};
      writeBag({
        [PRIMARY_KEY]: {
          on: true,
          templateId: prev.templateId || t.id,
          position: prev.position || t.position,
          posX: prev.posX ?? null,
          posY: prev.posY ?? null,
          rotation: prev.rotation || 0,
          offsetX: prev.offsetX != null ? prev.offsetX : t.offsetX,
          offsetY: prev.offsetY != null ? prev.offsetY : t.offsetY,
          ...patch,
        },
      }, "Watermark", immediate === "live" ? "live" : immediate !== false);
    };

    const togglePrimary = (on) => {
      const dev = stores?.useDevelopStore?.getState?.();
      if (!dev || !dev.photoId) return;
      const prev = (dev.paramBag && dev.paramBag[PRIMARY_KEY]) || {};
      if (!on) {
        writeBag({ [PRIMARY_KEY]: { ...prev, on: false, templateId: prev.templateId || t.id } }, "Watermark", true);
        return;
      }
      setPrimaryPlacement({
        on: true,
        templateId: t.id,
        position: prev.position || t.position,
        posX: prev.posX ?? null,
        posY: prev.posY ?? null,
        rotation: prev.rotation || 0,
        offsetX: prev.offsetX != null ? prev.offsetX : t.offsetX,
        offsetY: prev.offsetY != null ? prev.offsetY : t.offsetY,
      }, true);
    };

    const setPhotoType = (v) => {
      if (v === "empty") {
        togglePrimary(false);
        return;
      }
      update("mode", v);
      if (!primaryOn) {
        setPrimaryPlacement({
          on: true,
          templateId: t.id,
          position: t.position,
          rotation: t.rotation || 0,
          offsetX: t.offsetX,
          offsetY: t.offsetY,
        }, true);
      }
    };

    const photoType = !primaryOn ? "empty" : (t.mode === "image" ? "image" : "text");
    const storedDefault = defId && templates.some(x => x.id === defId) ? defId : "";
    const starTpl = templates.find(x => x.id === storedDefault) || resolveDefault(templates, "default");
    const isDefault = !!(t && starTpl && t.id === starTpl.id);

    const setDefault = () => {
      if (!t) return;
      const next = storedDefault === t.id ? "" : t.id;
      saveDefaultId(next);
      setDefId(next);
    };

    const addWatermark = () => {
      const def = starTpl;
      if (!def) return;
      const i = templates.findIndex(x => x.id === def.id);
      if (i >= 0) selectTemplate(i);
      const dev = stores?.useDevelopStore?.getState?.();
      if (!dev || !dev.photoId) return;
      const prev = (dev.paramBag && dev.paramBag[PRIMARY_KEY]) || {};
      writeBag({
        [PRIMARY_KEY]: {
          on: true,
          templateId: def.id,
          position: prev.position || def.position,
          posX: prev.posX ?? null,
          posY: prev.posY ?? null,
          rotation: prev.rotation || 0,
          offsetX: prev.offsetX != null ? prev.offsetX : def.offsetX,
          offsetY: prev.offsetY != null ? prev.offsetY : def.offsetY,
        },
      }, "Watermark", true);
    };

    const placeValue = (key, fallback) => {
      const v = placeOf[key];
      return v != null && v !== "" ? v : fallback;
    };

    return ce("div", { style: wrapStyle },
      ce("div", { style: labelStyle }, "Templates"),
      ce("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" } },
        ...templates.map((tp, i) =>
          ce("button", {
            key: tp.id, type: "button", style: chipStyle(i === activeIdx),
            onClick: () => selectTemplate(i),
            onDoubleClick: () => {
              selectTemplate(i);
              setNewName(tp.name);
              setShowNew("rename");
            },
            title: "Click to select · Double-click to rename",
          }, `${starTpl && tp.id === starTpl.id ? "★ " : ""}${tp.name}`)
        )
      ),
      showNew === "reset"
        ? ce("div", { style: { display: "flex", gap: 6, alignItems: "center", justifyContent: "flex-end" } },
            ce("span", { style: hintStyle }, "Delete all templates?"),
            ce("button", { type: "button", style: smallBtn, onClick: resetEverything }, "Reset"),
            ce("button", { type: "button", style: smallBtn, onClick: () => setShowNew(false) }, "Cancel"),
          )
        : showNew
        ? ce("div", { style: { display: "flex", gap: 6, alignItems: "center" } },
            ce("input", {
              style: { ...fieldInput, flex: 1 },
              type: "text", value: newName, autoFocus: true,
              placeholder: "Template name",
              onChange: e => setNewName(e.target.value),
              onKeyDown: e => {
                stopKeys(e);
                if (e.key === "Enter") (showNew === "rename" ? renameTemplate() : saveAsTemplate(newName));
                if (e.key === "Escape") { setShowNew(false); setNewName(""); }
              },
            }),
            ce("button", { type: "button", style: smallBtn, onClick: () => showNew === "rename" ? renameTemplate() : saveAsTemplate(newName) }, "Save"),
            ce("button", { type: "button", style: smallBtn, onClick: () => { setShowNew(false); setNewName(""); } }, "Cancel"),
          )
        : ce("div", { style: { display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" } },
            developPhotoId && !primaryOn && starTpl
              ? ce("button", { type: "button", style: { ...smallBtn, borderColor: "var(--color-accent)" }, onClick: addWatermark }, `Add watermark (★ ${starTpl.name})`)
              : null,
            t ? ce("button", { type: "button", style: smallBtn, onClick: setDefault }, isDefault ? "★ Default" : "☆ Set as default") : null,
            t ? ce("button", { type: "button", style: smallBtn, onClick: () => { setNewName(t.name); setShowNew("rename"); } }, "Rename") : null,
            t ? ce("button", { type: "button", style: smallBtn, onClick: overwriteTemplate }, "Overwrite") : null,
            ce("button", {
              type: "button", style: smallBtn,
              onClick: () => { setNewName(t ? `${t.name} copy` : "Watermark"); setShowNew("save"); },
            }, "Save as template"),
            templates.length > 1 ? ce("button", { type: "button", style: smallBtn, onClick: deleteTemplate }, "Delete") : null,
            ce("button", { type: "button", style: smallBtn, onClick: () => setShowNew("reset") }, "Reset all"),
          ),

      developPhotoId && instanceIds.map(id => ce("div", {
        key: id, style: { display: "flex", gap: 6, justifyContent: "flex-end" },
      },
        ce("button", { type: "button", style: smallBtn, onClick: () => openNewPanel(id) }, `Watermark ${id}`),
        ce("button", { type: "button", style: smallBtn, onClick: () => removePanel(id) }, "Remove"),
      )),
      ce("div", { style: { display: "flex", justifyContent: "flex-end" } },
        ce("button", { type: "button", style: { ...smallBtn, opacity: developPhotoId ? 1 : 0.5 }, disabled: !developPhotoId, onClick: addPanel }, "Add extra watermark"),
      ),
      !developPhotoId ? ce("div", { style: hintStyle }, "Open a photo in Develop to add a watermark.") : null,

      ce(SelectRow, {
        label: "Type", value: photoType, options: TYPE_OPTIONS,
        onChange: setPhotoType,
      }),
      photoType === "text" && ce("div", { style: rowStyle },
        ce("span", { style: labelStyle }, "Text"),
        ce("div", { style: { flex: "0 1 60%" } },
          ce("input", {
            style: fieldInput, type: "text", value: t.text || "",
            onKeyDown: stopKeys,
            onChange: e => update("text", e.target.value),
          }),
        ),
      ),
      photoType === "text" && ce(SelectRow, {
        label: "Font", value: t.fontFamily || "sans-serif", options: FONT_OPTIONS,
        onChange: v => update("fontFamily", v),
      }),
      photoType === "text" && ce(ColorRow, {
        label: "Color", value: t.color || "#ffffff",
        onChange: v => update("color", v),
      }),
      photoType === "image" && ce("div", { style: { display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" } },
        ce("button", { type: "button", style: smallBtn, onClick: () => fileRef.current && fileRef.current.click() },
          t.imageDataUrl ? "Replace PNG" : "Choose PNG"),
        ce("input", { ref: fileRef, type: "file", accept: "image/png", style: { display: "none" }, onChange: loadImage }),
        t.imageDataUrl ? ce("img", {
          src: t.imageDataUrl,
          style: { maxHeight: 22, maxWidth: 44, borderRadius: 4, border: "1px solid var(--color-border)" },
        }) : null,
      ),

      photoType !== "empty" && ce(NumSlider, {
        label: "Size", min: 0.5, max: 40, step: 0.5, defaultValue: 2.5,
        value: Number(t.fontSize),
        onChange: v => update("fontSize", v),
        onCommit: () => {},
      }),
      photoType !== "empty" && ce(NumSlider, {
        label: "Opacity", min: 0, max: 100, step: 1, defaultValue: 80,
        value: Number(t.opacity),
        onChange: v => update("opacity", v),
        onCommit: () => {},
      }),
      photoType !== "empty" && ce(SelectRow, {
        label: "Anchor", value: placeOf.position === "free" ? "free" : (placeOf.position || "bottom-right"),
        options: anchorOptions(placeOf.position),
        onChange: v => {
          if (v === "free") return;
          if (primaryOn) setPrimaryPlacement({ position: v, posX: null, posY: null }, true);
          else update("position", v);
        },
      }),
      photoType !== "empty" && ce(NumSlider, {
        label: "Rotate", min: -180, max: 180, step: 1, defaultValue: 0,
        value: markRotation(placeOf),
        onChange: v => primaryOn ? setPrimaryPlacement({ rotation: v }, "live") : update("rotation", v),
        onCommit: () => { if (primaryOn) commitBag("Watermark"); },
      }),
      photoType !== "empty" && ce(NumSlider, {
        label: "Offset X", min: 0, max: 20, step: 0.5, defaultValue: 2,
        value: Number(placeValue("offsetX", 2)),
        onChange: v => primaryOn ? setPrimaryPlacement({ offsetX: v }, "live") : update("offsetX", v),
        onCommit: () => { if (primaryOn) commitBag("Watermark"); },
      }),
      photoType !== "empty" && ce(NumSlider, {
        label: "Offset Y", min: 0, max: 20, step: 0.5, defaultValue: 2,
        value: Number(placeValue("offsetY", 2)),
        onChange: v => primaryOn ? setPrimaryPlacement({ offsetY: v }, "live") : update("offsetY", v),
        onCommit: () => { if (primaryOn) commitBag("Watermark"); },
      }),
      ce("div", { style: hintStyle }, "Drag a watermark on the photo to move it. The dot on it rotates."),
    );
  }

  // ── Develop-canvas overlay ───────────────────────────────────────────────────
  // Draws the actual watermark (text or PNG) directly over the live Develop
  // canvas as you edit — so what you see while developing already matches
  // what export will produce. Unlike e.g. the Print Mat overlay, this can
  // afford to render the *real* watermark (not a simplified guide): text/PNG
  // compositing is cheap, there's no texture/bevel/shadow recompute involved.
  function DevelopOverlay() {
    const [tpls, setTpls] = useState(loadTemplates);
    const [imagePx, setImagePx] = useState({});
    const [selected, setSelected] = useState(null);
    const [gesture, setGesture] = useState(null);
    const gestureRef = useRef(null);
    const bag = stores.useDevelopStore(s => s.paramBag);
    const bypassed = stores.useDevelopStore(s => s.bypassedPanels);
    const noteImage = (url, img) => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (!url || !w || !h) return;
      setImagePx(prev => (prev[url] && prev[url].w === w && prev[url].h === h ? prev : { ...prev, [url]: { w, h } }));
    };

    // Template edits happen in the panel (a separate React tree), so poll the
    // saved template. Extra panels are read from the develop store above, so
    // holding a panel's eye hides that overlay on the same frame.
    useEffect(() => {
      const id = setInterval(() => {
        const next = loadTemplates();
        setTpls(prev => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      }, 500);
      return () => clearInterval(id);
    }, []);

    const liveMark = (item) => {
      if (!gesture || gesture.key !== item.key) return item.mark;
      return { ...item.mark, position: "free", posX: gesture.posX, posY: gesture.posY, rotation: gesture.rotation };
    };

    const beginGesture = (e, item, mode) => {
      if (e.button != null && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const markEl = mode === "rotate" ? e.currentTarget.parentElement : e.currentTarget;
      const box = markEl.parentElement.getBoundingClientRect();
      const root = markEl.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const posX = ((root.left + root.width / 2) - box.left) / box.width * 100;
      const posY = ((root.top + root.height / 2) - box.top) / box.height * 100;
      const rotation = markRotation(liveMark(item));
      const g = {
        key: item.key, source: item.source, instanceId: item.instanceId,
        mode, posX, posY, rotation,
        originX: posX, originY: posY, originRot: rotation,
        px: e.clientX, py: e.clientY,
        cx: root.left + root.width / 2, cy: root.top + root.height / 2,
        boxW: box.width, boxH: box.height,
      };
      if (mode === "rotate") g.a0 = Math.atan2(e.clientY - g.cy, e.clientX - g.cx);
      gestureRef.current = g;
      setGesture({ key: g.key, posX, posY, rotation });
      setSelected(item.key);
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* already captured */ }
    };

    const moveGesture = (e) => {
      const g = gestureRef.current;
      if (!g) return;
      if (g.mode === "move") {
        g.posX = g.originX + (e.clientX - g.px) / g.boxW * 100;
        g.posY = g.originY + (e.clientY - g.py) / g.boxH * 100;
      } else {
        const a1 = Math.atan2(e.clientY - g.cy, e.clientX - g.cx);
        g.rotation = g.originRot + (a1 - g.a0) * 180 / Math.PI;
      }
      setGesture({ key: g.key, posX: g.posX, posY: g.posY, rotation: g.rotation });
    };

    const endGesture = (e) => {
      const g = gestureRef.current;
      if (!g) return;
      e.stopPropagation();
      gestureRef.current = null;
      setGesture(null);
      const moved = Math.hypot(e.clientX - g.px, e.clientY - g.py) >= 3;
      if (g.mode === "move" && !moved) return;
      if (g.mode === "rotate" && Math.abs(g.rotation - g.originRot) < 0.4) return;
      const patch = {
        position: "free",
        posX: Math.round(g.posX * 100) / 100,
        posY: Math.round(g.posY * 100) / 100,
        rotation: Math.round(markRotation({ rotation: g.rotation }) * 10) / 10,
      };
      if (g.source === "primary") {
        const dev = stores?.useDevelopStore?.getState?.();
        const prev = (dev && dev.paramBag && dev.paramBag[PRIMARY_KEY]) || {};
        const active = resolveExportTemplate(loadTemplates());
        writeBag({
          [PRIMARY_KEY]: {
            ...prev,
            on: true,
            templateId: prev.templateId || (active && active.id),
            ...patch,
          },
        }, "Watermark", true);
        return;
      }
      const dev = stores?.useDevelopStore?.getState?.();
      const base = readMark(dev && dev.paramBag, g.instanceId);
      if (!base) return;
      writeBag({ [markKey(g.instanceId)]: { ...base, ...patch } }, `Watermark ${g.instanceId}`, true);
    };

    const markNode = (item, boxW, boxH, long) => {
      const mark = liveMark(item);
      if (mark.mode === "empty" || (mark.mode === "image" && !mark.imageDataUrl)) return null;
      const on = selected === item.key;
      const fitted = mark.mode === "image" ? fitImagePx(imagePx[mark.imageDataUrl], long, mark.fontSize) : null;
      return ce("div", {
        key: item.key,
        onPointerDown: e => beginGesture(e, item, "move"),
        onPointerMove: moveGesture,
        onPointerUp: endGesture,
        style: {
          ...getWatermarkBoxStyle(mark, boxW, boxH),
          pointerEvents: "auto", cursor: "grab", touchAction: "none", userSelect: "none",
          color: mark.color, fontFamily: mark.fontFamily,
          fontSize: mark.mode === "text" ? long * ((Number(mark.fontSize) || 0) / 100) : undefined,
          whiteSpace: "nowrap", lineHeight: 1,
          zIndex: on ? 3 : 1,
          boxShadow: on ? "0 0 0 1px #fff" : undefined,
        },
      },
        mark.mode === "image"
          ? ce("img", {
            src: mark.imageDataUrl, alt: "", draggable: false,
            onLoad: e => noteImage(mark.imageDataUrl, e.currentTarget),
            style: { display: "block", width: fitted ? fitted.width : 0, height: fitted ? fitted.height : 0, pointerEvents: "none" },
          })
          : ce("span", { style: { pointerEvents: "none" } }, mark.text || ""),
        on && ce("div", {
          onPointerDown: e => beginGesture(e, item, "rotate"),
          onPointerMove: moveGesture,
          onPointerUp: endGesture,
          style: {
            position: "absolute", left: "50%", top: 0, width: 12, height: 12,
            transform: "translate(-50%, -50%)", borderRadius: 6,
            background: "var(--color-on-accent, #fff)", border: "2px solid var(--color-accent)",
            cursor: "grab", pointerEvents: "auto", touchAction: "none",
          },
        }),
      );
    };

    const overlay = api.develop?.useDevelopOverlay ? api.develop.useDevelopOverlay() : { rect: null };
    const view = overlay?.rect;
    if (!view) return null;
    const full = overlay.imageRect;
    const frame = full && full.w > 0 && full.h > 0 ? full : view;

    const long = Math.max(frame.w, frame.h);
    const marks = instanceMarks(bag, bypassed);
    const primary = mainHeld(bypassed) ? null : readPrimary(bag, tpls);
    const onPhoto = [];
    if (primary && primary.place !== "strip") onPhoto.push({ key: "primary", source: "primary", mark: primary });
    for (const m of marks) {
      if (m.place === "strip") continue;
      onPhoto.push({ key: `instance:${m.instanceId}`, source: "instance", instanceId: m.instanceId, mark: m });
    }
    const strips = [
      ...(primary && primary.place === "strip" ? [primary] : []),
      ...marks.filter(m => m.place === "strip"),
    ];
    if (!onPhoto.length && !strips.length) return null;
    let stripTop = frame.y + frame.h;
    const stripNodes = strips.map(m => {
      const h = Math.max(8, frame.h * ((Number(m.stripHeight) || 8) / 100));
      const top = stripTop;
      stripTop += h;
      const item = { key: `strip:${m.instanceId}`, source: "instance", instanceId: m.instanceId, mark: m };
      return ce("div", {
        key: `strip-box-${m.id}`,
        style: {
          position: "absolute", left: frame.x, top, width: frame.w, height: h,
          background: m.stripColor || "#111111", pointerEvents: "none", overflow: "hidden",
        },
      }, markNode(item, frame.w, h, long));
    });
    return ce("div", {
      style: { position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" },
    },
      ce("div", {
        style: {
          position: "absolute", left: frame.x, top: frame.y, width: frame.w, height: frame.h,
          pointerEvents: "none", overflow: "hidden",
        },
      }, ...onPhoto.map(item => markNode(item, frame.w, frame.h, long))),
      ...stripNodes,
    );
  }

  function InstancePanel({ instanceId }) {
    const [mark, setMark] = useState(null);
    const [templates, setTemplates] = useState(loadTemplates);
    const [defId, setDefId] = useState(loadDefaultId);
    const [naming, setNaming] = useState(false);
    const [newName, setNewName] = useState("");
    const fileRef = useRef(null);
    useEffect(() => {
      const devStore = stores?.useDevelopStore;
      if (!devStore) return undefined;
      const sync = state => {
        const next = readMark(state && state.paramBag, instanceId);
        setMark(prev => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      };
      sync(devStore.getState());
      return devStore.subscribe(sync);
    }, [instanceId]);
    useEffect(() => {
      const sync = () => {
        const next = loadTemplates();
        setTemplates(prev => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
        setDefId(loadDefaultId());
      };
      window.addEventListener("safelight-watermark-templates", sync);
      return () => window.removeEventListener("safelight-watermark-templates", sync);
    }, []);

    const updateMark = (key, val, mode) => {
      setMark(prev => {
        const base = prev || emptyMark(`Watermark ${instanceId}`);
        const next = { ...base, [key]: val, id: base.id };
        const how = mode === "live" ? "live" : (key === "text" ? false : true);
        writeBag({ [markKey(instanceId)]: next }, `Watermark ${instanceId}`, how);
        return next;
      });
    };
    const commitMark = () => commitBag(`Watermark ${instanceId}`);

    const applyTemplate = (tpl) => {
      if (!tpl) return;
      setMark(prev => {
        const base = prev || emptyMark(`Watermark ${instanceId}`);
        const next = stampFromTemplate({
          ...tpl,
          name: base.name || `Watermark ${instanceId}`,
          enabled: true,
          place: base.place === "strip" ? "strip" : "on",
        }, true);
        next.id = base.id;
        next.templateId = tpl.id;
        writeBag({ [markKey(instanceId)]: next }, `Watermark ${instanceId}`, true);
        return next;
      });
    };

    const markLook = (name, id) => {
      const created = {
        ...mark,
        id,
        name,
        enabled: true,
        position: mark.position === "free" ? "bottom-right" : mark.position,
      };
      delete created.templateId;
      return created;
    };

    const saveMarkAsTemplate = () => {
      const n = newName.trim();
      if (!n || !mark || mark.mode === "empty") return;
      const existing = templates.find(x => x.name === n);
      const next = existing
        ? templates.map(x => x.id === existing.id ? markLook(existing.name, existing.id) : x)
        : [...templates, markLook(n, Date.now().toString())];
      saveTemplates(next);
      setTemplates(next);
      setNaming(false);
      setNewName("");
      if (existing) updateMark("templateId", existing.id);
    };

    const renamePicked = () => {
      const n = newName.trim();
      setNaming(false);
      setNewName("");
      if (!n || !picked) return;
      const next = templates.map(x => x.id === picked.id ? { ...x, name: n } : x);
      saveTemplates(next);
      setTemplates(next);
    };

    const overwritePicked = () => {
      if (!picked || !mark || mark.mode === "empty") return;
      const next = templates.map(x => x.id === picked.id ? markLook(x.name, x.id) : x);
      saveTemplates(next);
      setTemplates(next);
    };

    const resetEverything = () => {
      const fresh = { ...DEFAULT_TEMPLATE };
      saveTemplates([fresh]);
      saveDefaultId("");
      saveActiveTemplateId(fresh.id);
      setTemplates([fresh]);
      setDefId("");
      setNaming(false);
      setNewName("");
      const dev = stores?.useDevelopStore?.getState?.();
      if (!dev || !dev.photoId) return;
      const patch = { [PRIMARY_KEY]: { on: false }, [INSTANCES_KEY]: [] };
      for (const id of readInstanceIds(dev.paramBag)) patch[markKey(id)] = null;
      writeBag(patch, "Reset Watermark", true);
      syncInstancePanels(false);
    };

    const loadImage = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => updateMark("imageDataUrl", ev.target.result);
      reader.readAsDataURL(file);
    };

    if (!mark) {
      return ce("div", { style: wrapStyle },
        ce("div", { style: hintStyle }, "This overlay is not on the open photo."));
    }

    const markType = mark.mode === "image" ? "image" : mark.mode === "empty" ? "empty" : "text";
    const storedDefault = defId && templates.some(x => x.id === defId) ? defId : "";
    const starTpl = templates.find(x => x.id === storedDefault) || resolveDefault(templates, "default");
    const picked = templates.find(x => x.id === mark.templateId) || null;

    return ce("div", { style: wrapStyle },
      ce("div", { style: labelStyle }, "Templates"),
      ce("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" } },
        ...templates.map(tp =>
          ce("button", {
            key: tp.id, type: "button",
            style: chipStyle(!!picked && picked.id === tp.id),
            onClick: () => applyTemplate(tp),
            title: starTpl && tp.id === starTpl.id ? `${tp.name} (default)` : tp.name,
          }, `${starTpl && tp.id === starTpl.id ? "★ " : ""}${tp.name}`)
        )
      ),
      naming === "reset"
        ? ce("div", { style: { display: "flex", gap: 6, alignItems: "center", justifyContent: "flex-end" } },
            ce("span", { style: hintStyle }, "Delete all templates?"),
            ce("button", { type: "button", style: smallBtn, onClick: resetEverything }, "Reset"),
            ce("button", { type: "button", style: smallBtn, onClick: () => setNaming(false) }, "Cancel"),
          )
        : naming
        ? ce("div", { style: { display: "flex", gap: 6, alignItems: "center" } },
            ce("input", {
              style: { ...fieldInput, flex: 1 },
              type: "text", value: newName, autoFocus: true, placeholder: "Template name",
              onChange: e => setNewName(e.target.value),
              onKeyDown: e => {
                stopKeys(e);
                if (e.key === "Enter") (naming === "rename" ? renamePicked() : saveMarkAsTemplate());
                if (e.key === "Escape") { setNaming(false); setNewName(""); }
              },
            }),
            ce("button", { type: "button", style: smallBtn, onClick: () => naming === "rename" ? renamePicked() : saveMarkAsTemplate() }, "Save"),
            ce("button", { type: "button", style: smallBtn, onClick: () => { setNaming(false); setNewName(""); } }, "Cancel"),
          )
        : ce("div", { style: { display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" } },
            picked ? ce("button", {
              type: "button", style: smallBtn,
              onClick: () => {
                const next = storedDefault === picked.id ? "" : picked.id;
                saveDefaultId(next);
                setDefId(next);
              },
            }, storedDefault === picked.id ? "★ Default" : "☆ Set as default") : null,
            picked ? ce("button", { type: "button", style: smallBtn, onClick: () => { setNewName(picked.name); setNaming("rename"); } }, "Rename") : null,
            picked && markType !== "empty" ? ce("button", { type: "button", style: smallBtn, onClick: overwritePicked }, "Overwrite") : null,
            markType !== "empty" ? ce("button", {
              type: "button", style: smallBtn,
              onClick: () => { setNewName(`${picked ? picked.name : mark.name || "Watermark"} copy`); setNaming("save"); },
            }, "Save as template") : null,
            picked && templates.length > 1 ? ce("button", {
              type: "button", style: smallBtn,
              onClick: () => {
                if (loadDefaultId() === picked.id) { saveDefaultId(""); setDefId(""); }
                const next = templates.filter(x => x.id !== picked.id);
                saveTemplates(next);
                setTemplates(next);
              },
            }, "Delete") : null,
            ce("button", { type: "button", style: smallBtn, onClick: () => setNaming("reset") }, "Reset all"),
          ),

      ce(SelectRow, {
        label: "Type", value: markType, options: TYPE_OPTIONS,
        onChange: v => updateMark("mode", v),
      }),
      markType === "text" && ce("div", { style: rowStyle },
        ce("span", { style: labelStyle }, "Text"),
        ce("div", { style: { flex: "0 1 60%" } },
          ce("input", {
            style: fieldInput, type: "text", value: mark.text || "",
            onKeyDown: stopKeys, onBlur: flushMarks,
            onChange: e => updateMark("text", e.target.value),
          }),
        ),
      ),
      markType === "text" && ce(SelectRow, {
        label: "Font", value: mark.fontFamily || "sans-serif", options: FONT_OPTIONS,
        onChange: v => updateMark("fontFamily", v),
      }),
      markType === "text" && ce(ColorRow, {
        label: "Color", value: mark.color || "#ffffff",
        onChange: v => updateMark("color", v, "live"),
        onCommit: commitMark,
      }),
      markType === "image" && ce("div", { style: { display: "flex", gap: 6, justifyContent: "flex-end", alignItems: "center" } },
        ce("button", { type: "button", style: smallBtn, onClick: () => fileRef.current && fileRef.current.click() },
          mark.imageDataUrl ? "Replace PNG" : "Choose PNG"),
        ce("input", { ref: fileRef, type: "file", accept: "image/png", style: { display: "none" }, onChange: loadImage }),
      ),
      markType !== "empty" && ce(NumSlider, {
        label: "Size", min: 0.5, max: 40, step: 0.5, defaultValue: 2.5,
        value: Number(mark.fontSize),
        onChange: v => updateMark("fontSize", v, "live"),
        onCommit: commitMark,
      }),
      markType !== "empty" && ce(NumSlider, {
        label: "Opacity", min: 0, max: 100, step: 1, defaultValue: 80,
        value: Number(mark.opacity),
        onChange: v => updateMark("opacity", v, "live"),
        onCommit: commitMark,
      }),
      markType !== "empty" && ce(SelectRow, {
        label: "Place", value: mark.place === "strip" ? "strip" : "on", options: PLACE_OPTIONS,
        onChange: v => updateMark("place", v),
      }),
      markType !== "empty" && mark.place === "strip" && ce(ColorRow, {
        label: "Strip color", value: mark.stripColor || "#111111",
        onChange: v => updateMark("stripColor", v, "live"),
        onCommit: commitMark,
      }),
      markType !== "empty" && mark.place === "strip" && ce(NumSlider, {
        label: "Strip height", min: 2, max: 40, step: 1, defaultValue: 8,
        value: Number(mark.stripHeight || 8),
        onChange: v => updateMark("stripHeight", v, "live"),
        onCommit: commitMark,
      }),
      markType !== "empty" && ce(SelectRow, {
        label: "Anchor", value: mark.position === "free" ? "free" : (mark.position || "bottom-right"),
        options: anchorOptions(mark.position),
        onChange: v => { if (v !== "free") updateMark("position", v); },
      }),
      markType !== "empty" && ce(NumSlider, {
        label: "Rotate", min: -180, max: 180, step: 1, defaultValue: 0,
        value: markRotation(mark),
        onChange: v => updateMark("rotation", v, "live"),
        onCommit: commitMark,
      }),
      markType !== "empty" && ce(NumSlider, {
        label: "Offset X", min: 0, max: 20, step: 0.5, defaultValue: 2,
        value: Number(mark.offsetX),
        onChange: v => updateMark("offsetX", v, "live"),
        onCommit: commitMark,
      }),
      markType !== "empty" && ce(NumSlider, {
        label: "Offset Y", min: 0, max: 20, step: 0.5, defaultValue: 2,
        value: Number(mark.offsetY),
        onChange: v => updateMark("offsetY", v, "live"),
        onCommit: commitMark,
      }),
      ce("div", { style: { display: "flex", justifyContent: "flex-end" } },
        ce("button", { type: "button", style: smallBtn, onClick: () => removeInstance(instanceId) }, "Remove"),
      ),
      ce("div", { style: hintStyle }, markType === "empty"
        ? "Empty draws nothing. Choose Text, PNG Image, or a template."
        : "Drag this watermark on the photo to move it. Hold its eye to hide this one."),
    );
  }

  const registeredPanels = new Set();
  const pendingPlace = new Set();
  let shownPanels = null;
  let panelsAlive = true;
  let syncingPanels = false;
  const MAIN_PANEL = "safelight-watermark.panel";

  function inDevelop() {
    const ui = stores?.useUIStore?.getState?.();
    return !ui || ui.activeModule === "develop";
  }

  function openNewPanel(id) {
    const pid = panelId(id);
    try {
      if (api.dock && typeof api.dock.isPanelOpen === "function" && typeof api.dock.togglePanel === "function" && !api.dock.isPanelOpen(pid)) {
        api.dock.togglePanel(pid);
      }
    } catch (err) {
      console.warn("[safelight-watermark] open panel", err);
    }
  }

  // togglePanel can only append to the first rail on a side, so a new panel
  // opens at the top of another column. Place it in the original panel's
  // column, directly under Watermark (and under panels already stacked there).
  function dockUnderOriginal(ids) {
    if (!ids.length || !api.layouts || typeof api.layouts.capture !== "function" || typeof api.layouts.show !== "function") return false;
    let layout;
    try { layout = api.layouts.capture(); } catch (err) { return false; }
    if (!layout || !Array.isArray(layout.rails)) return false;
    const moving = new Set(ids.map(panelId));
    const rails = layout.rails.map(rail => ({
      ...rail,
      panels: (rail.panels || []).filter(id => !moving.has(id)),
    })).filter(rail => rail.panels.length > 0);
    const railIndex = rails.findIndex(rail => rail.panels.includes(MAIN_PANEL));
    if (railIndex < 0) return false;
    const rail = rails[railIndex];
    let at = rail.panels.indexOf(MAIN_PANEL) + 1;
    while (at < rail.panels.length && String(rail.panels[at]).startsWith(`${MAIN_PANEL}.`)) at += 1;
    const ordered = [...moving].sort((a, b) => Number(a.slice(MAIN_PANEL.length + 1)) - Number(b.slice(MAIN_PANEL.length + 1)));
    const panels = rail.panels.slice();
    panels.splice(at, 0, ...ordered);
    rails[railIndex] = { ...rail, panels };
    const floating = { ...(layout.floating || {}) };
    for (const id of moving) delete floating[id];
    const next = { ...layout, rails };
    if (Object.keys(floating).length) next.floating = floating;
    else delete next.floating;
    try { api.layouts.show(next); } catch (err) {
      console.warn("[safelight-watermark] dock panel", err);
      return false;
    }
    return true;
  }

  function syncInstancePanels(openId) {
    if (syncingPanels || typeof api.registerPanel !== "function" || !panelsAlive) return;
    syncingPanels = true;
    try { syncInstancePanelsNow(openId); } finally { syncingPanels = false; }
  }

  function syncInstancePanelsNow(openId) {
    const dev = stores?.useDevelopStore?.getState?.();
    const ids = readInstanceIds(dev && dev.paramBag);
    const key = ids.join(",");
    if (key === shownPanels && typeof openId !== "number") return;
    for (const id of [...registeredPanels]) {
      if (ids.includes(id)) continue;
      const pid = panelId(id);
      try {
        if (api.dock && typeof api.dock.isPanelOpen === "function" && api.dock.isPanelOpen(pid) && typeof api.dock.togglePanel === "function") {
          api.dock.togglePanel(pid);
        }
      } catch (err) { /* the dock may already have dropped it */ }
      try { if (typeof api.unregisterPanel === "function") api.unregisterPanel(pid); } catch (err) {
        console.warn("[safelight-watermark] unregister panel", err);
      }
      registeredPanels.delete(id);
      pendingPlace.delete(id);
    }
    ids.forEach((id, index) => {
      if (registeredPanels.has(id)) return;
      api.registerPanel({
        id: panelId(id),
        title: `Watermark ${id}`,
        component: function WatermarkInstance() { return ce(InstancePanel, { instanceId: id }); },
        defaultLocation: "right",
        defaultDock: { module: "develop", direction: "right", order: 210 + index },
        order: 210 + index,
        headerAccessory: instanceHeaderDot(id),
        ownsBag: [markKey(id)],
        onReset: () => {
          writeBag({ [markKey(id)]: emptyMark(`Watermark ${id}`) }, `Watermark ${id}`, true);
        },
      });
      registeredPanels.add(id);
      pendingPlace.add(id);
    });
    if (!inDevelop()) return;
    const toPlace = ids.filter(id => pendingPlace.has(id));
    if (toPlace.length) {
      const placed = dockUnderOriginal(toPlace);
      if (!placed) {
        for (const id of toPlace) openNewPanel(id);
      }
      for (const id of toPlace) pendingPlace.delete(id);
    }
    if (typeof openId === "number" && !toPlace.includes(openId)) openNewPanel(openId);
    shownPanels = key;
  }

  function removeInstance(id) {
    const dev = stores?.useDevelopStore?.getState?.();
    if (!dev || !dev.photoId) return;
    const ids = readInstanceIds(dev.paramBag).filter(n => n !== id);
    writeBag({
      [INSTANCES_KEY]: ids,
      [markKey(id)]: null,
    }, `Watermark ${id}`, true);
    syncInstancePanels(null);
  }

  closeInstancePanels = () => {
    panelsAlive = false;
    for (const id of [...registeredPanels]) {
      try { if (typeof api.unregisterPanel === "function") api.unregisterPanel(panelId(id)); } catch (err) {}
      registeredPanels.delete(id);
      pendingPlace.delete(id);
    }
    shownPanels = null;
  };

  const devStore = stores?.useDevelopStore;
  if (devStore && typeof devStore.subscribe === "function") {
    devStore.subscribe(() => syncInstancePanels(null));
    syncInstancePanels(null);
  }
  const uiStore = stores?.useUIStore;
  if (uiStore && typeof uiStore.subscribe === "function") {
    uiStore.subscribe(() => {
      if (inDevelop()) syncInstancePanels(null);
    });
  }

  function ThumbWatermark({ photo }) {
    const portal = api.reactDom && api.reactDom.createPortal;
    const [host, setHost] = useState(null);
    const [box, setBox] = useState(null);
    const [bag, setBag] = useState(null);
    const [tpls, setTpls] = useState(loadTemplates);
    const [imagePx, setImagePx] = useState({});

    useEffect(() => {
      const sync = () => setTpls(loadTemplates());
      window.addEventListener("safelight-watermark-templates", sync);
      return () => window.removeEventListener("safelight-watermark-templates", sync);
    }, []);

    useLayoutEffect(() => {
      if (!photo || photo.id == null) { setHost(null); return; }
      const id = window.CSS && CSS.escape ? CSS.escape(String(photo.id)) : String(photo.id).replace(/"/g, "");
      setHost(document.querySelector(`[data-photo-id="${id}"]`));
    }, [photo && photo.id]);

    useEffect(() => {
      if (!host) return undefined;
      const measure = () => {
        setBox(containedRect(host.clientWidth, host.clientHeight, photo.width, photo.height));
      };
      measure();
      if (typeof ResizeObserver !== "function") return undefined;
      const ro = new ResizeObserver(measure);
      ro.observe(host);
      return () => ro.disconnect();
    }, [host, photo && photo.width, photo && photo.height]);

    const editedAt = typeof catalogApi.useEditedAt === "function" ? catalogApi.useEditedAt(photo && photo.id) : undefined;
    useEffect(() => {
      let alive = true;
      const pull = () => {
        bagForPhoto(photo).then(b => { if (alive) setBag((b && b.bag) || {}); });
      };
      pull();
      const dev = stores?.useDevelopStore;
      if (!dev || typeof dev.subscribe !== "function") return () => { alive = false; };
      const unsub = dev.subscribe((state, prev) => {
        if (!state || !photo || state.photoId !== photo.id) return;
        if (prev && prev.paramBag === state.paramBag && prev.photoId === state.photoId) return;
        pull();
      });
      return () => { alive = false; unsub(); };
    }, [photo && photo.id, editedAt]);

    if (!portal || !host || !box || !box.w || !bag) return null;
    const marks = instanceMarks(bag, {});
    const primary = readPrimary(bag, tpls);
    const onPhoto = [];
    if (primary && primary.place !== "strip" && thumbMarkVisible(primary)) onPhoto.push(primary);
    for (const m of marks) if (m.place !== "strip" && thumbMarkVisible(m)) onPhoto.push(m);
    const strips = marks.filter(m => m.place === "strip" && thumbMarkVisible(m));
    if (!onPhoto.length && !strips.length) return null;
    const long = Math.max(box.w, box.h);
    const noteImage = (url, img) => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (!url || !w || !h) return;
      setImagePx(prev => (prev[url] && prev[url].w === w && prev[url].h === h ? prev : { ...prev, [url]: { w, h } }));
    };
    const node = (mark, boxW, boxH, key) => {
      const fitted = mark.mode === "image" ? fitImagePx(imagePx[mark.imageDataUrl], long, mark.fontSize) : null;
      return ce("div", {
        key,
        style: {
          ...getWatermarkBoxStyle(mark, boxW, boxH),
          pointerEvents: "none",
          color: mark.color, fontFamily: mark.fontFamily,
          fontSize: mark.mode === "text" ? long * ((Number(mark.fontSize) || 0) / 100) : undefined,
          whiteSpace: "nowrap", lineHeight: 1,
        },
      }, mark.mode === "image"
        ? ce("img", {
          src: mark.imageDataUrl, alt: "", draggable: false,
          onLoad: e => noteImage(mark.imageDataUrl, e.currentTarget),
          style: { display: "block", width: fitted ? fitted.width : 0, height: fitted ? fitted.height : 0 },
        })
        : (mark.text || ""));
    };
    let stripTop = box.y + box.h;
    const stripNodes = strips.map(m => {
      const h = Math.max(2, box.h * ((Number(m.stripHeight) || 8) / 100));
      const top = stripTop;
      stripTop += h;
      return ce("div", {
        key: `thumb-strip-${m.instanceId || m.id}`,
        style: {
          position: "absolute", left: box.x, top, width: box.w, height: h,
          background: m.stripColor || "#111111", overflow: "hidden", pointerEvents: "none",
        },
      }, node(m, box.w, h, `thumb-strip-mark-${m.instanceId || m.id}`));
    });
    return portal(ce("div", {
      style: { position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" },
    },
      ce("div", {
        style: {
          position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h,
          overflow: "hidden", pointerEvents: "none",
        },
      }, ...onPhoto.map((m, i) => node(m, box.w, box.h, `thumb-${m.instanceId || m.id || i}`))),
      ...stripNodes,
    ), host);
  }

  api.registerSlot({
    id: "safelight-watermark.develop-overlay",
    slot: "develop-canvas-overlay",
    component: DevelopOverlay,
  });

  function activeDot(label) {
    return ce("span", {
      title: label,
      "aria-label": label,
      role: "img",
      style: {
        width: 8, height: 8, borderRadius: "50%", display: "inline-block",
        background: "var(--color-success, #3fb950)",
        boxShadow: "0 0 0 1px rgba(0,0,0,0.35)",
      },
    });
  }

  function ActiveDot() {
    const module = useUIStore ? useUIStore(s => s.activeModule) : "develop";
    const selected = useCatalogStore ? useCatalogStore(s => s.selectedIds) : null;
    const map = useMarkMap ? useMarkMap(s => s.map) : null;
    const bag = stores.useDevelopStore(s => s.paramBag);
    const key = module === "library" && selected ? Array.from(selected).join("|") : "";
    useEffect(() => {
      if (!key) return;
      for (const id of key.split("|")) if (!map || map[id] === undefined) void refreshMark(id);
    }, [key]);
    if (module === "library") {
      const ids = key ? key.split("|") : [];
      const on = ids.filter(id => map && map[id]);
      if (!on.length) return null;
      const names = Array.from(new Set(on.map(id => map[id].name || "Watermark")));
      return activeDot(`Watermark on ${on.length} of ${ids.length} selected: ${names.join(", ")}`);
    }
    const primary = readPrimary(bag, loadTemplates());
    if (!primary) return null;
    return activeDot(`Watermark on: ${primary.name || "Watermark"}`);
  }

  function instanceHeaderDot(id) {
    return function InstanceDot() {
      const bag = stores.useDevelopStore(s => s.paramBag);
      const mark = readMark(bag, id);
      if (!mark || mark.mode === "empty") return null;
      return activeDot(`Watermark on: ${mark.name || `Watermark ${id}`}`);
    };
  }

  api.registerPanel({
    id: "safelight-watermark.panel",
    title: "Watermark",
    component: WatermarkPanel,
    defaultLocation: "right",
    headerAccessory: ActiveDot,
    ownsBag: [PRIMARY_KEY],
    onReset: () => {
      if (!inDevelop()) return;
      writeBag({ [PRIMARY_KEY]: { on: false } }, "Reset Watermark", true);
    },
  });

  if (typeof api.registerThumbnailBadge === "function") {
    api.registerThumbnailBadge({
      id: "safelight-watermark.thumb",
      order: 20,
      component: ThumbWatermark,
    });
  }
}

export function deactivate() { closeInstancePanels(); }
