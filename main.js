var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => ThemedPdfExport
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");

// cloneExportDom.ts
var SCROLL_STEP_PX = 50;
var MATERIALIZE_PAUSE_MS = 16;
var CODE_BLOCK_SELECTOR = [
  "pre",
  ".HyperMD-codeblock",
  ".markdown-rendered pre"
].join(", ");
var CODE_WRAPPER_SELECTOR = [".code-block", ".cm-embed-block", 'div[class*="block-language-"]'].join(
  ", "
);
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
async function cloneActiveNoteDom(view) {
  const saved = saveViewState(view);
  try {
    await materializeFullDocument(view);
    const liveSource = findLiveMarkdownRoot(view);
    if (!liveSource)
      return null;
    const cloned = liveSource.cloneNode(true);
    freezeCodeColors(liveSource, cloned);
    const wrapper = document.createElement("div");
    wrapper.classList.add("theme-pdf-cloned-content", "theme-pdf-colors-frozen");
    if (view.getMode() === "source") {
      wrapper.classList.add("is-live-preview", "mod-cm6");
    }
    wrapper.appendChild(sanitizeClone(cloned));
    return wrapper;
  } finally {
    restoreViewState(view, saved);
  }
}
function saveViewState(view) {
  return {
    editorScroll: view.editor.getScrollInfo(),
    previewScroll: view.previewMode.getScroll()
  };
}
function getCmEditor(view) {
  const cm = view.editor.cm;
  return cm != null ? cm : null;
}
function restoreViewState(view, saved) {
  const cm = getCmEditor(view);
  if (cm == null ? void 0 : cm.viewState.printing) {
    cm.viewState.printing = false;
    cm.measure();
  }
  view.editor.scrollTo(saved.editorScroll.left, saved.editorScroll.top);
  view.previewMode.applyScroll(saved.previewScroll);
}
async function materializeFullDocument(view) {
  var _a, _b;
  if (view.getMode() === "preview") {
    const preview = view.previewMode;
    (_a = preview.unfoldAll) == null ? void 0 : _a.call(preview);
  }
  const cm = getCmEditor(view);
  if (cm) {
    cm.viewState.printing = true;
    cm.measure();
  }
  const lineCount = view.editor.lineCount();
  for (let i = 0; i < lineCount; i++) {
    view.editor.scrollTo(0, i * SCROLL_STEP_PX);
    view.previewMode.applyScroll(i * SCROLL_STEP_PX);
    await sleep(MATERIALIZE_PAUSE_MS);
  }
  const lastLine = Math.max(0, lineCount - 1);
  view.editor.scrollTo(0, lastLine * SCROLL_STEP_PX);
  view.previewMode.applyScroll(Number.MAX_SAFE_INTEGER);
  await sleep(MATERIALIZE_PAUSE_MS);
  (_b = getCmEditor(view)) == null ? void 0 : _b.measure();
}
function findLiveMarkdownRoot(view) {
  if (view.getMode() === "preview") {
    const sizer = view.previewMode.containerEl.querySelector(".markdown-preview-sizer");
    return sizer;
  }
  const sourceView = view.contentEl.querySelector(".markdown-source-view");
  if (sourceView) {
    return sourceView;
  }
  const readingSizer = view.contentEl.querySelector(
    ".markdown-reading-view .markdown-preview-sizer"
  );
  if (readingSizer == null ? void 0 : readingSizer.childElementCount) {
    return readingSizer;
  }
  return null;
}
function freezeCodeColors(liveRoot, cloneRoot) {
  const liveBlocks = collectColorFreezeRoots(liveRoot);
  const cloneBlocks = collectColorFreezeRoots(cloneRoot);
  const count = Math.min(liveBlocks.length, cloneBlocks.length);
  for (let i = 0; i < count; i++) {
    freezeSubtreeStyles(liveBlocks[i], cloneBlocks[i]);
    freezePseudoDecorations(liveBlocks[i], cloneBlocks[i]);
  }
}
function collectColorFreezeRoots(root) {
  const seen = /* @__PURE__ */ new Set();
  const blocks = [];
  const add = (el) => {
    if (!el || !(el instanceof HTMLElement) || seen.has(el))
      return;
    seen.add(el);
    blocks.push(el);
  };
  root.querySelectorAll(CODE_BLOCK_SELECTOR).forEach((el) => {
    var _a, _b;
    const html = el;
    add(html);
    add(html.closest(CODE_WRAPPER_SELECTOR));
    add((_b = (_a = html.parentElement) == null ? void 0 : _a.closest(CODE_WRAPPER_SELECTOR)) != null ? _b : null);
  });
  root.querySelectorAll(CODE_WRAPPER_SELECTOR).forEach((el) => {
    if (el.querySelector("pre, .HyperMD-codeblock, code")) {
      add(el);
    }
  });
  root.querySelectorAll("code").forEach((el) => {
    if (!el.closest("pre")) {
      add(el);
    }
  });
  return blocks;
}
function freezeSubtreeStyles(liveEl, cloneEl) {
  const liveNodes = [liveEl, ...Array.from(liveEl.querySelectorAll("*"))];
  const cloneNodes = [cloneEl, ...Array.from(cloneEl.querySelectorAll("*"))];
  if (liveNodes.length !== cloneNodes.length) {
    freezeElementStyle(liveEl, cloneEl);
    return;
  }
  for (let i = 0; i < liveNodes.length; i++) {
    freezeElementStyle(liveNodes[i], cloneNodes[i]);
  }
}
function freezeElementStyle(live, clone) {
  const cs = getComputedStyle(live);
  const color = cs.color;
  if (color) {
    clone.style.setProperty("color", color, "important");
  }
  const bg = cs.backgroundColor;
  if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
    clone.style.setProperty("background-color", bg, "important");
  }
  const fill = cs.webkitTextFillColor;
  if (fill && fill !== color) {
    clone.style.setProperty("-webkit-text-fill-color", fill, "important");
  }
  freezeBorderAndOutline(live, clone, cs);
}
var BORDER_SIDES = ["top", "right", "bottom", "left"];
function freezeBorderAndOutline(live, clone, cs) {
  for (const side of BORDER_SIDES) {
    const width = cs.getPropertyValue(`border-${side}-width`);
    const style = cs.getPropertyValue(`border-${side}-style`);
    const color = cs.getPropertyValue(`border-${side}-color`);
    if (style === "none" || width === "0px")
      continue;
    clone.style.setProperty(`border-${side}-width`, width, "important");
    clone.style.setProperty(`border-${side}-style`, style, "important");
    clone.style.setProperty(`border-${side}-color`, color, "important");
  }
  const outlineWidth = cs.outlineWidth;
  const outlineStyle = cs.outlineStyle;
  if (outlineStyle !== "none" && outlineWidth !== "0px") {
    clone.style.setProperty("outline-width", outlineWidth, "important");
    clone.style.setProperty("outline-style", outlineStyle, "important");
    clone.style.setProperty("outline-color", cs.outlineColor, "important");
    const offset = cs.outlineOffset;
    if (offset && offset !== "0px") {
      clone.style.setProperty("outline-offset", offset, "important");
    }
  }
  const shadow = cs.boxShadow;
  if (shadow && shadow !== "none") {
    clone.style.setProperty("box-shadow", shadow, "important");
  }
  const radius = cs.borderRadius;
  if (radius && radius !== "0px") {
    clone.style.setProperty("border-radius", radius, "important");
  }
}
function freezePseudoDecorations(live, clone) {
  for (const pseudo of ["::before", "::after"]) {
    const cs = getComputedStyle(live, pseudo);
    if (cs.content === "none" && cs.borderWidth === "0px" && cs.backgroundColor === "rgba(0, 0, 0, 0)") {
      continue;
    }
    if (!hasVisiblePseudoDecoration(cs))
      continue;
    const deco = document.createElement("span");
    deco.classList.add("theme-pdf-pseudo-freeze");
    deco.setAttribute("aria-hidden", "true");
    applyPseudoComputedStyle(deco, cs, pseudo);
    deco.style.setProperty("pointer-events", "none", "important");
    if (pseudo === "::before") {
      clone.style.setProperty("position", getComputedStyle(live).position === "static" ? "relative" : getComputedStyle(live).position, "important");
      clone.insertBefore(deco, clone.firstChild);
    } else {
      clone.appendChild(deco);
    }
  }
}
function hasVisiblePseudoDecoration(cs) {
  if (cs.display === "none" || cs.visibility === "hidden")
    return false;
  if (cs.borderStyle !== "none" && cs.borderWidth !== "0px")
    return true;
  const bg = cs.backgroundColor;
  if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent")
    return true;
  const w = parseFloat(cs.width);
  const h = parseFloat(cs.height);
  return w > 0 && !Number.isNaN(w) || h > 0 && !Number.isNaN(h);
}
function applyPseudoComputedStyle(el, cs, pseudo) {
  el.style.setProperty("content", '""', "important");
  el.style.setProperty("display", cs.display === "inline" ? "block" : cs.display, "important");
  el.style.setProperty("position", "absolute", "important");
  el.style.setProperty("box-sizing", "border-box", "important");
  const positionProps = ["top", "right", "bottom", "left", "width", "height", "inset"];
  for (const prop of positionProps) {
    const val = cs.getPropertyValue(prop);
    if (val && val !== "auto") {
      el.style.setProperty(prop, val, "important");
    }
  }
  for (const side of BORDER_SIDES) {
    const width = cs.getPropertyValue(`border-${side}-width`);
    const style = cs.getPropertyValue(`border-${side}-style`);
    const color = cs.getPropertyValue(`border-${side}-color`);
    if (style === "none" || width === "0px")
      continue;
    el.style.setProperty(`border-${side}-width`, width, "important");
    el.style.setProperty(`border-${side}-style`, style, "important");
    el.style.setProperty(`border-${side}-color`, color, "important");
  }
  const bg = cs.backgroundColor;
  if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
    el.style.setProperty("background-color", bg, "important");
  }
  const radius = cs.borderRadius;
  if (radius && radius !== "0px") {
    el.style.setProperty("border-radius", radius, "important");
  }
  if (pseudo === "::before") {
    el.style.setProperty("z-index", "0", "important");
  } else {
    el.style.setProperty("z-index", "1", "important");
  }
}
function sanitizeClone(root) {
  root.querySelectorAll(".collapse-indicator").forEach((el) => el.remove());
  root.querySelectorAll(".search-result-file-matches").forEach((el) => el.remove());
  root.querySelectorAll(".obsidian-search-match-highlight").forEach((el) => {
    const parent = el.parentNode;
    if (!parent)
      return;
    while (el.firstChild)
      parent.insertBefore(el.firstChild, el);
    el.remove();
  });
  root.querySelectorAll("[style]").forEach((el) => {
    if (el.style.display === "none") {
      el.style.removeProperty("display");
    }
  });
  return root;
}

// main.ts
var DEFAULT_SETTINGS = {
  pageSize: "A4",
  margins: "20mm",
  orientation: "portrait",
  includeTitle: false,
  accentCodeBlocks: false
};
var ThemedPdfExport = class extends import_obsidian.Plugin {
  async onload() {
    await this.loadSettings();
    this.addRibbonIcon("file-down", "Export as PDF with theme", () => {
      const view = this.app.workspace.getActiveViewOfType(import_obsidian.MarkdownView);
      if (view == null ? void 0 : view.file) {
        void this.exportNote(view.file);
      } else {
        new import_obsidian.Notice("Open a Markdown note first.");
      }
    });
    this.addCommand({
      id: "theme-pdf-export-current",
      name: "Export current note as PDF (with theme)",
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(import_obsidian.MarkdownView);
        if (view == null ? void 0 : view.file) {
          if (!checking)
            void this.exportNote(view.file);
          return true;
        }
        return false;
      }
    });
    this.addSettingTab(new ThemePdfSettingTab(this.app, this));
  }
  async exportNote(file) {
    new import_obsidian.Notice(`Rendering "${file.basename}"\u2026`);
    let overlay;
    let buildCleanup;
    try {
      const { root, cleanup, usedFallbackRender } = await this.buildExportRoot(file);
      buildCleanup = cleanup;
      if (usedFallbackRender) {
        new import_obsidian.Notice(
          "Exported with re-rendered code blocks (open this note to match on-screen colors).",
          5e3
        );
      }
      if (this.settings.includeTitle) {
        const title = resolveExportTitle(this.app, file);
        const h1 = root.createEl("h1", { cls: "inline-title", text: title });
        root.prepend(h1);
      }
      overlay = document.createElement("div");
      overlay.id = "theme-pdf-overlay";
      const themeClass = document.body.classList.contains("theme-dark") ? "theme-dark" : "theme-light";
      overlay.classList.add("markdown-preview-view", "markdown-rendered", themeClass);
      if (root.classList.contains("is-live-preview")) {
        overlay.classList.add("is-live-preview", "mod-cm6");
      }
      if (root.classList.contains("theme-pdf-colors-frozen")) {
        overlay.classList.add("theme-pdf-colors-frozen");
      }
      for (const c of printPageClassNames(this.settings.pageSize, this.settings.orientation)) {
        overlay.classList.add(c);
      }
      while (root.firstChild) {
        overlay.appendChild(root.firstChild);
      }
      document.body.appendChild(overlay);
      const marginSpec = this.settings.margins.trim();
      const overlayPadding = /\s/.test(marginSpec) ? marginSpec : `calc(${marginSpec} * 1.4) ${marginSpec}`;
      overlay.setCssProps({ "--theme-pdf-overlay-padding": overlayPadding });
      await sleep2(100);
      new import_obsidian.Notice('Choose "Save as PDF" in the print dialog.');
      window.print();
      document.body.removeChild(overlay);
      overlay = void 0;
    } finally {
      if (overlay == null ? void 0 : overlay.isConnected) {
        overlay.remove();
      }
      buildCleanup == null ? void 0 : buildCleanup();
    }
  }
  async buildExportRoot(file) {
    if (!this.settings.accentCodeBlocks) {
      const view = this.app.workspace.getActiveViewOfType(import_obsidian.MarkdownView);
      if ((view == null ? void 0 : view.file) === file) {
        const cloned = await cloneActiveNoteDom(view);
        if (cloned) {
          return { root: cloned, usedFallbackRender: false };
        }
      }
    }
    return this.renderExportRoot(file);
  }
  async renderExportRoot(file) {
    const tmp = document.createElement("div");
    tmp.classList.add("theme-pdf-export-tmp");
    document.body.appendChild(tmp);
    const renderOwner = new import_obsidian.Component();
    renderOwner.load();
    const content = await this.app.vault.read(file);
    await import_obsidian.MarkdownRenderer.render(this.app, content, tmp, file.path, renderOwner);
    await sleep2(800);
    return {
      root: tmp,
      usedFallbackRender: !this.settings.accentCodeBlocks,
      cleanup: () => {
        renderOwner.unload();
        if (tmp.isConnected) {
          tmp.remove();
        }
      }
    };
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
};
var ThemePdfSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian.Setting(containerEl).setName("Export").setHeading();
    new import_obsidian.Setting(containerEl).setName("Page size").addDropdown(
      (d) => d.addOption("A4", "A4").addOption("Letter", "Letter").addOption("A3", "A3").setValue(this.plugin.settings.pageSize).onChange((v) => {
        this.plugin.settings.pageSize = v;
        void this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Orientation").addDropdown(
      (d) => d.addOption("portrait", "Portrait").addOption("landscape", "Landscape").setValue(this.plugin.settings.orientation).onChange((v) => {
        this.plugin.settings.orientation = v;
        void this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Include title").setDesc("Add the note title (properties title, or file name) above the note body in the PDF.").addToggle(
      (t) => t.setValue(this.plugin.settings.includeTitle).onChange((v) => {
        this.plugin.settings.includeTitle = v;
        void this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Accent-colored code blocks").setDesc(
      "When enabled, code blocks are re-rendered and may pick up your accent color. When disabled (default), export matches the note as shown."
    ).addToggle(
      (t) => t.setValue(this.plugin.settings.accentCodeBlocks).onChange((v) => {
        this.plugin.settings.accentCodeBlocks = v;
        void this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Page margins").setDesc("CSS value, e.g. 20mm or 1in").addText(
      (t) => t.setValue(this.plugin.settings.margins).onChange((v) => {
        this.plugin.settings.margins = v;
        void this.plugin.saveSettings();
      })
    );
  }
};
function printPageClassNames(pageSize, orientation) {
  const slug = pageSize === "Letter" ? "letter" : pageSize.toLowerCase();
  return [`theme-pdf-page-${slug}`, `theme-pdf-orient-${orientation}`];
}
function resolveExportTitle(app, file) {
  var _a;
  const fm = (_a = app.metadataCache.getFileCache(file)) == null ? void 0 : _a.frontmatter;
  if (fm != null && fm.title != null) {
    const s = String(fm.title).trim();
    if (s)
      return s;
  }
  return file.basename.replace(/\.md$/i, "");
}
function sleep2(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
