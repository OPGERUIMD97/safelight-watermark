// Safelight Watermark Extension v1.1.0
// Adds a text or transparent PNG watermark to exported photos.
// Supports multiple saved templates with position, opacity and size.
// Live in Develop: the watermark is drawn directly over the Develop canvas
// as you edit, and the panel preview auto-refreshes via api.develop.captureFrame.

const STORAGE_KEY = "safelight-watermark-templates";
const ACTIVE_KEY  = "safelight-watermark-active-id";

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
    background: "var(--color-surface-0)", color: "var(--color-text-primary)",
    fontFamily: "system-ui, -apple-system, sans-serif",
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
    border: "1px solid #C15F3C", background: "var(--color-accent)", color: "var(--color-text-primary)",
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
}

function loadActiveTemplateId() {
  try { return localStorage.getItem(ACTIVE_KEY) || null; } catch (e) { return null; }
}

function saveActiveTemplateId(id) {
  try { localStorage.setItem(ACTIVE_KEY, id); } catch (e) {}
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
function getWatermarkBoxStyle(t, boxW, boxH) {
  const pos = t.position;
  const isCenter  = pos === "center";
  const isCenterH = pos.includes("center") && !isCenter; // bottom-center / top-center
  const padX = boxW * (t.offsetX / 100);
  const padY = boxH * (t.offsetY / 100);
  return {
    position: "absolute", pointerEvents: "none",
    bottom: pos.includes("bottom") ? padY : isCenter ? "50%" : undefined,
    top:    pos.includes("top")    ? padY : undefined,
    left:   pos.includes("left")   ? padX : (isCenterH || isCenter) ? "50%" : undefined,
    right:  pos.includes("right")  ? padX : undefined,
    transform: isCenter ? "translate(-50%, 50%)" : isCenterH ? "translateX(-50%)" : undefined,
    opacity: t.opacity / 100,
  };
}

// ── Watermark draw helper ─────────────────────────────────────────────────────
async function drawWatermark(ctx, W, H, t) {
  ctx.globalAlpha = t.opacity / 100;

  if (t.mode === "text") {
    const fontSize = Math.round(Math.max(W, H) * (t.fontSize / 100));
    ctx.font      = `${fontSize}px ${t.fontFamily}`;
    ctx.fillStyle = t.color;
    ctx.textBaseline = "alphabetic";
    const metrics = ctx.measureText(t.text);
    const tw = metrics.width;
    const th = fontSize;
    const padX = W * (t.offsetX / 100);
    const padY = H * (t.offsetY / 100);
    let x, y;
    const pos = t.position;
    x = pos.includes("right")  ? W - tw - padX
      : pos.includes("left")   ? padX
      : (W - tw) / 2;
    y = pos.includes("bottom") ? H - padY
      : pos.includes("top")    ? padY + th
      : H / 2 + th / 2;
    ctx.fillText(t.text, x, y);

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
    const padX = W * (t.offsetX / 100);
    const padY = H * (t.offsetY / 100);
    const pos = t.position;
    const x = pos.includes("right")  ? W - iW - padX
             : pos.includes("left")  ? padX
             : (W - iW) / 2;
    const y = pos.includes("bottom") ? H - iH - padY
             : pos.includes("top")   ? padY
             : (H - iH) / 2;
    ctx.drawImage(img, x, y, iW, iH);
  }

  ctx.globalAlpha = 1;
}

async function applyWatermark(blob, template) {
  if (!template.enabled) return blob;
  const bitmap = await createImageBitmap(blob);
  const W = bitmap.width, H = bitmap.height;
  const canvas = new OffscreenCanvas(W, H);
  const ctx    = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);
  await drawWatermark(ctx, W, H, template);
  return canvas.convertToBlob({ type: blob.type || "image/jpeg", quality: 0.95 });
}

// ── Export panel settings fields ──────────────────────────────────────────────
// Builds the field list shown in Safelight's core Export panel (under
// "Watermark"), so it no longer just says "No settings." — lets you see and
// override, per export, which template is used and whether it's applied at
// all, without having to open this extension's own panel first.
function getProcessorFields(tpls) {
  if (!tpls || !tpls.length) return [];
  const active = resolveExportTemplate(tpls);
  return [
    {
      key: "enabled", type: "boolean", label: "Apply watermark",
      default: active ? active.enabled !== false : true,
    },
    {
      key: "template", type: "select", label: "Template",
      options: tpls.map(t => ({ value: t.id, label: t.name })),
      default: active ? active.id : tpls[0].id,
    },
  ];
}

// ── Panel ─────────────────────────────────────────────────────────────────────
export function activate(api) {
  const { react: React, stores } = api;
  const { useState, useEffect, useRef, useCallback } = React;
  const ce = (type, props, ...ch) => React.createElement(type, props, ...ch);

  function WatermarkPanel() {
    const [templates, setTemplates] = useState(loadTemplates);
    const [activeIdx, setActiveIdx] = useState(() => {
      const tpls = loadTemplates();
      const activeId = loadActiveTemplateId();
      const idx = tpls.findIndex(x => x.id === activeId);
      return idx >= 0 ? idx : 0;
    });
    const [newName,    setNewName]    = useState("");
    const [showNew,    setShowNew]    = useState(false);
    const fileRef = useRef(null);

    const t = templates[activeIdx] || templates[0];

    const selectTemplate = (i) => {
      setActiveIdx(i);
      const tpl = templates[i];
      if (tpl) saveActiveTemplateId(tpl.id);
    };

    const update = (key, val) => {
      setTemplates(prev => {
        const next = prev.map((x, i) => i === activeIdx ? { ...x, [key]: val } : x);
        saveTemplates(next);
        return next;
      });
    };

    const addTemplate = (name) => {
      if (!name || !name.trim()) return;
      setShowNew(false);
      setNewName("");
      setTemplates(prev => {
        const next = [...prev, { ...DEFAULT_TEMPLATE, id: Date.now().toString(), name: name.trim() }];
        saveTemplates(next);
        setActiveIdx(next.length - 1);
        saveActiveTemplateId(next[next.length - 1].id);
        return next;
      });
    };

    const deleteTemplate = () => {
      if (templates.length <= 1) { alert("Cannot delete the last template."); return; }
      // confirm() not available in Electron — delete directly
      setTemplates(prev => {
        const next = prev.filter((_, i) => i !== activeIdx);
        saveTemplates(next);
        const newIdx = Math.max(0, activeIdx - 1);
        setActiveIdx(newIdx);
        if (next[newIdx]) saveActiveTemplateId(next[newIdx].id);
        return next;
      });
    };

    const loadImage = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => update("imageDataUrl", ev.target.result);
      reader.readAsDataURL(file);
    };

    // ── Live state from the app (active photo, Develop edit state) ────────────
    const [activePhoto,   setActivePhoto]   = useState(null);
    const [developParams, setDevelopParams] = useState(null);
    const [activeModule,  setActiveModule]  = useState("library");

    useEffect(() => {
      const store = stores?.useCatalogStore;
      if (!store) return;
      const sync = state => {
        const id = state.activePhotoId;
        setActivePhoto(id ? state.photos.find(p => p.id === id) : null);
      };
      const unsub = store.subscribe(sync);
      sync(store.getState());
      return unsub;
    }, []);

    useEffect(() => {
      const devStore = stores?.useDevelopStore;
      const uiStore  = stores?.useUIStore;
      if (!devStore || !uiStore) return;
      const syncDev = state => setDevelopParams(state.params || null);
      const syncUI  = state => setActiveModule(state.activeModule);
      const unsubDev = devStore.subscribe(syncDev);
      const unsubUI  = uiStore.subscribe(syncUI);
      syncDev(devStore.getState());
      syncUI(uiStore.getState());
      return () => { unsubDev(); unsubUI(); };
    }, []);

    // ── Live preview while editing ─────────────────────────────────────────────
    // In Develop, render through the exact same captureFrame the WebGL renderer
    // uses, so the preview always matches what export actually produces.
    const [previewUrl, setPreviewUrl] = useState(null);
    const [previewing, setPreviewing] = useState(false);

    const buildBaseBlob = useCallback(async () => {
      if (activeModule === "develop" && developParams && api.develop?.captureFrame) {
        const bitmap = await api.develop.captureFrame(developParams);
        const cv = new OffscreenCanvas(bitmap.width, bitmap.height);
        cv.getContext("2d").drawImage(bitmap, 0, 0);
        return cv.convertToBlob({ type: "image/jpeg", quality: 0.92 });
      }
      // Library (or no live session): fall back to the catalog thumbnail.
      // Note: thumbnails don't carry develop edits, so this preview shows
      // the unedited photo even though the actual export applies edits.
      if (activePhoto?.thumbnailUrl) {
        const resp = await fetch(activePhoto.thumbnailUrl);
        return resp.blob();
      }
      const canvas = new OffscreenCanvas(800, 533);
      const ctx = canvas.getContext("2d");
      const grad = ctx.createLinearGradient(0, 0, 800, 533);
      grad.addColorStop(0, "#3C3836"); grad.addColorStop(1, "#1C1917");
      ctx.fillStyle = grad; ctx.fillRect(0, 0, 800, 533);
      ctx.fillStyle = "#B1ADA1"; ctx.font = "32px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("Sample Photo", 400, 266);
      return canvas.convertToBlob({ type: "image/jpeg" });
    }, [activeModule, developParams, activePhoto]);

    const generatePreview = useCallback(async () => {
      setPreviewing(true);
      try {
        const blob = await buildBaseBlob();
        const resultBlob = await applyWatermark(blob, t);
        setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(resultBlob); });
      } catch (err) {
        console.error("[safelight-watermark] preview error:", err);
      } finally {
        setPreviewing(false);
      }
    }, [t, buildBaseBlob]);

    // Auto-refresh while actively editing in Develop, debounced so a slider
    // drag doesn't re-render on every tick. Library keeps the placeholder
    // mock preview below (no live edit state to react to there).
    const liveTimerRef = useRef(null);
    useEffect(() => {
      if (activeModule !== "develop" || !developParams || !api.develop?.captureFrame) return;
      if (liveTimerRef.current) clearTimeout(liveTimerRef.current);
      liveTimerRef.current = setTimeout(() => { generatePreview(); }, 400);
      return () => clearTimeout(liveTimerRef.current);
      // eslint-disable-next-line
    }, [developParams, activeModule, t]);

    useEffect(() => {
      return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
    }, [previewUrl]);

    // Register export processor — settings fields populate the "Watermark"
    // section in Safelight's core Export panel (instead of "No settings."),
    // and re-register whenever the template list changes so the "Template"
    // dropdown there always reflects the current templates.
    useEffect(() => {
      return api.registerExportProcessor({
        id:    "safelight-watermark.processor",
        label: "Watermark",
        settings: getProcessorFields(templates),
        async process(blob, settings) {
          const tpls = loadTemplates();
          let tpl = resolveExportTemplate(tpls);
          if (settings?.template) {
            const picked = tpls.find(x => x.id === settings.template);
            if (picked) tpl = picked;
          }
          if (!tpl) return blob;
          if (settings?.enabled === false) return blob;
          return applyWatermark(blob, tpl);
        },
      });
    }, [templates]);

    return ce("div", { style: S.container },

      // Templates
      ce("div", { style: S.sectionTitle }, "Templates"),
      ce("div", { style: { marginBottom: 6 } },
        ...templates.map((tp, i) =>
          ce("span", {
            key: tp.id, style: i === activeIdx ? S.tagActive : S.tag,
            onClick: () => selectTemplate(i),
            onDoubleClick: () => {
              selectTemplate(i);
              const name = tp.name;
              setNewName(name);
              setShowNew("rename");
            },
            title: "Click to select · Double-click to rename"
          }, tp.name)
        )
      ),
      showNew === "rename" && ce("div", { style: { display: "flex", gap: 6, marginBottom: 10, alignItems: "center" } },
        ce("span", { style: { ...S.label, flexShrink: 0 } }, "Rename:"),
        ce("input", {
          style: { ...S.input, width: 120, padding: "4px 8px" },
          type: "text", value: newName, autoFocus: true,
          onChange: e => setNewName(e.target.value),
          onKeyDown: e => {
            if (e.key === "Enter") {
              if (newName.trim()) {
                setTemplates(prev => {
                  const next = prev.map((x, i) => i === activeIdx ? { ...x, name: newName.trim() } : x);
                  saveTemplates(next);
                  return next;
                });
              }
              setShowNew(false); setNewName("");
            }
            if (e.key === "Escape") { setShowNew(false); setNewName(""); }
          }
        }),
        ce("button", { style: S.modeBtnActive, onClick: () => {
          if (newName.trim()) {
            setTemplates(prev => {
              const next = prev.map((x, i) => i === activeIdx ? { ...x, name: newName.trim() } : x);
              saveTemplates(next);
              return next;
            });
          }
          setShowNew(false); setNewName("");
        }}, "Save"),
        ce("button", { style: S.btn, onClick: () => { setShowNew(false); setNewName(""); } }, "Cancel"),
      ),
      showNew === true
        ? ce("div", { style: { display: "flex", gap: 6, marginBottom: 10, alignItems: "center" } },
            ce("input", {
              style: { ...S.input, width: 130, padding: "4px 8px" },
              type: "text", placeholder: "Template name…",
              value: newName,
              autoFocus: true,
              onChange: e => setNewName(e.target.value),
              onKeyDown: e => {
                if (e.key === "Enter") addTemplate(newName);
                if (e.key === "Escape") { setShowNew(false); setNewName(""); }
              }
            }),
            ce("button", { style: S.modeBtnActive, onClick: () => addTemplate(newName) }, "Save"),
            ce("button", { style: S.btn, onClick: () => { setShowNew(false); setNewName(""); } }, "Cancel"),
          )
        : ce("div", { style: { display: "flex", gap: 6, marginBottom: 10 } },
            ce("button", { style: S.btn, onClick: () => { setNewName(`Watermark ${templates.length + 1}`); setShowNew(true); } }, "+ New"),
            ce("button", { style: S.btnDanger, onClick: deleteTemplate }, "Delete"),
          ),

      ce("hr", { style: S.divider }),

      // Enable
      ce("div", { style: S.row },
        ce("label", { style: { ...S.label, cursor: "pointer", display: "flex", alignItems: "center" } },
          ce("input", { type: "checkbox", style: S.checkbox,
                        checked: t.enabled, onChange: e => update("enabled", e.target.checked) }),
          "Enable watermark"
        )
      ),

      ce("hr", { style: S.divider }),

      // Mode toggle
      ce("div", { style: S.sectionTitle }, "Type"),
      ce("div", { style: { display: "flex", gap: 0, borderRadius: 3, overflow: "hidden", marginBottom: 8 } },
        ce("button", {
          style: t.mode === "text" ? S.modeBtnActive : S.modeBtn,
          onClick: () => update("mode", "text")
        }, "Text"),
        ce("button", {
          style: t.mode === "image" ? S.modeBtnActive : S.modeBtn,
          onClick: () => update("mode", "image")
        }, "PNG Image"),
      ),

      // Text settings
      t.mode === "text" && ce("div", null,
        ce("div", { style: S.row },
          ce("span", { style: S.label }, "Text"),
          ce("input", { style: S.input, type: "text", value: t.text,
                        onChange: e => update("text", e.target.value) })
        ),
        ce("div", { style: S.row },
          ce("span", { style: S.label }, "Font"),
          ce("select", { style: S.select, value: t.fontFamily,
                         onChange: e => update("fontFamily", e.target.value) },
            ce("option", { value: "sans-serif" },     "Sans-serif"),
            ce("option", { value: "serif" },          "Serif"),
            ce("option", { value: "monospace" },      "Monospace"),
            ce("option", { value: "Georgia" },        "Georgia"),
            ce("option", { value: "Helvetica Neue" }, "Helvetica Neue"),
          )
        ),
        ce("div", { style: S.row },
          ce("span", { style: S.label }, "Color"),
          ce("input", { type: "color", style: S.colorInput,
                        value: t.color, onChange: e => update("color", e.target.value) })
        ),
      ),

      // Image settings
      t.mode === "image" && ce("div", null,
        ce("div", { style: { marginBottom: 6 } },
          ce("button", { style: S.btn, onClick: () => fileRef.current?.click() },
            t.imageDataUrl ? "Replace PNG…" : "Choose PNG…"),
          ce("input", { ref: fileRef, type: "file", accept: "image/png",
                        style: { display: "none" }, onChange: loadImage }),
        ),
        t.imageDataUrl && ce("div", { style: { marginBottom: 6 } },
          ce("img", { src: t.imageDataUrl, style: { maxHeight: 40, maxWidth: "100%",
                                                    borderRadius: 3, border: "1px solid var(--color-border-subtle)" } })
        ),
      ),

      ce("hr", { style: S.divider }),

      // Size & opacity
      ce("div", { style: S.sectionTitle }, "Size & Opacity"),
      ce("div", { style: S.row },
        ce("span", { style: S.label }, "Size (% of long edge)"),
        ce("input", { style: S.inputSmall, type: "number", min: 0.5, max: 50, step: 0.5,
                      value: t.fontSize, onChange: e => update("fontSize", Number(e.target.value)) })
      ),
      ce("div", { style: S.row },
        ce("span", { style: S.label }, "Opacity (%)"),
        ce("input", { style: S.inputSmall, type: "number", min: 0, max: 100,
                      value: t.opacity, onChange: e => update("opacity", Number(e.target.value)) })
      ),

      ce("hr", { style: S.divider }),

      // Position
      ce("div", { style: S.sectionTitle }, "Position"),
      ce("div", { style: S.row },
        ce("span", { style: S.label }, "Anchor"),
        ce("select", { style: S.select, value: t.position,
                       onChange: e => update("position", e.target.value) },
          ...POSITIONS.map(p => ce("option", { key: p, value: p },
            p.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())))
        )
      ),
      ce("div", { style: S.row },
        ce("span", { style: S.label }, "Offset X (%)"),
        ce("input", { style: S.inputSmall, type: "number", min: 0, max: 20, step: 0.5,
                      value: t.offsetX, onChange: e => update("offsetX", Number(e.target.value)) })
      ),
      ce("div", { style: S.row },
        ce("span", { style: S.label }, "Offset Y (%)"),
        ce("input", { style: S.inputSmall, type: "number", min: 0, max: 20, step: 0.5,
                      value: t.offsetY, onChange: e => update("offsetY", Number(e.target.value)) })
      ),

      ce("hr", { style: S.divider }),

      // Live preview
      ce("div", { style: S.sectionTitle }, "Preview"),
      ce("div", { style: { display: "flex", gap: 6, marginBottom: 6 } },
        ce("button", { style: S.btn, onClick: generatePreview, disabled: previewing },
          previewing ? "Rendering…" : "Generate Preview"),
      ),
      ce("div", { style: S.preview },
        previewUrl
          ? ce("img", { src: previewUrl, style: {
              maxWidth: "100%", maxHeight: 160, borderRadius: 2, display: "block",
            }})
          : ce("div", { style: {
              width: 160, height: 100, borderRadius: 2,
              background: "linear-gradient(135deg, var(--color-surface-1) 0%, var(--color-surface-3) 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--color-border)", fontSize: 10,
            }}, "Click \u201CGenerate Preview\u201D"),
      ),
      ce("div", { style: { color: "var(--color-text-secondary)", fontSize: 10, marginTop: 6, textAlign: "center" } },
        activeModule === "develop" && developParams && api.develop?.captureFrame
          ? "Live preview — follows your edits in Develop"
          : activePhoto ? "Using selected photo (unedited thumbnail)" : "No photo selected — using sample image")
    );
  }

  // ── Develop-canvas overlay ───────────────────────────────────────────────────
  // Draws the actual watermark (text or PNG) directly over the live Develop
  // canvas as you edit — so what you see while developing already matches
  // what export will produce. Unlike e.g. the Print Mat overlay, this can
  // afford to render the *real* watermark (not a simplified guide): text/PNG
  // compositing is cheap, there's no texture/bevel/shadow recompute involved.
  function DevelopOverlay() {
    const [tpl, setTpl] = useState(() => resolveExportTemplate(loadTemplates()));

    // Template edits happen in the panel (a separate React tree/instance),
    // so — consistent with the other Safelight extensions that share state
    // this way — poll the persisted template rather than relying on React
    // state shared across trees.
    useEffect(() => {
      const id = setInterval(() => {
        const next = resolveExportTemplate(loadTemplates());
        setTpl(prev => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      }, 500);
      return () => clearInterval(id);
    }, []);

    const overlay = api.develop?.useDevelopOverlay ? api.develop.useDevelopOverlay() : { rect: null };
    const rect = overlay?.rect;

    if (!rect || !tpl || tpl.enabled === false) return null;

    const long = Math.max(rect.w, rect.h);
    const boxStyle = getWatermarkBoxStyle(tpl, rect.w, rect.h);

    return ce("div", { style: { position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h, pointerEvents: "none" } },
      tpl.mode === "text" && ce("div", {
        style: { ...boxStyle, color: tpl.color, fontFamily: tpl.fontFamily,
                fontSize: long * (tpl.fontSize / 100), whiteSpace: "nowrap", lineHeight: 1 },
      }, tpl.text),
      tpl.mode === "image" && tpl.imageDataUrl && ce("img", {
        src: tpl.imageDataUrl,
        style: { ...boxStyle, maxHeight: `${tpl.fontSize}%`, maxWidth: `${tpl.fontSize * 4}%` },
      }),
    );
  }

  api.registerSlot({
    id: "safelight-watermark.develop-overlay",
    slot: "develop-canvas-overlay",
    component: DevelopOverlay,
  });

  api.registerPanel({
    id: "safelight-watermark.panel",
    title: "Watermark",
    component: WatermarkPanel,
    defaultLocation: "right",
  });
}

export function deactivate() {}
