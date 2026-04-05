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
var DEFAULT_SETTINGS = {
  pageSize: "A4",
  margins: "20mm",
  orientation: "portrait",
  includeTitle: false
};
var ThemedPdfExport = class extends import_obsidian.Plugin {
  async onload() {
    await this.loadSettings();
    this.addRibbonIcon("file-down", "Export as PDF with theme", () => {
      const view = this.app.workspace.getActiveViewOfType(import_obsidian.MarkdownView);
      if (view == null ? void 0 : view.file) {
        this.exportNote(view.file);
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
            this.exportNote(view.file);
          return true;
        }
        return false;
      }
    });
    this.addSettingTab(new ThemePdfSettingTab(this.app, this));
  }
  async exportNote(file) {
    new import_obsidian.Notice(`Rendering "${file.basename}"\u2026`);
    const tmp = document.createElement("div");
    tmp.style.cssText = "position:absolute;left:-99999px;top:0;width:800px;";
    document.body.appendChild(tmp);
    const content = await this.app.vault.read(file);
    await import_obsidian.MarkdownRenderer.render(this.app, content, tmp, file.path, this);
    await sleep(800);
    if (this.settings.includeTitle) {
      const title = resolveExportTitle(this.app, file);
      const h1 = tmp.createEl("h1", { cls: "inline-title", text: title });
      tmp.prepend(h1);
    }
    const overlay = document.createElement("div");
    overlay.id = "theme-pdf-overlay";
    const themeClass = document.body.classList.contains("theme-dark") ? "theme-dark" : "theme-light";
    overlay.className = `markdown-preview-view markdown-rendered ${themeClass}`;
    overlay.innerHTML = tmp.innerHTML;
    document.body.removeChild(tmp);
    document.body.appendChild(overlay);
    const pageSizeCss = this.settings.orientation === "landscape" ? `${this.settings.pageSize} landscape` : this.settings.pageSize;
    const marginSpec = this.settings.margins.trim();
    const overlayPadding = /\s/.test(marginSpec) ? marginSpec : `calc(${marginSpec} * 1.4) ${marginSpec}`;
    const style = document.createElement("style");
    style.id = "theme-pdf-print-style";
    style.textContent = `
      @media screen {
        #theme-pdf-overlay { display: none !important; }
      }
      @media print {
        /* Page margin boxes stay unstyled (white) in Chromium \u2014 use 0 and inset content via overlay padding */
        @page {
          size: ${pageSizeCss};
          margin: 0 !important;
        }

        /* Full-bleed theme to sheet edges */
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background-color: var(--background-primary) !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        body > *:not(#theme-pdf-overlay) {
          display: none !important;
          visibility: hidden !important;
        }

        /*
         * Without box-decoration-break: clone, only the first fragment gets padding-top and
         * only the last gets padding-bottom \u2014 middle pages look tight vs page 1.
         * Clone repeats padding (and background) on every fragment so all sheets match.
         * Slightly taller vertical padding approximates Obsidian preview space above/below content.
         */
        #theme-pdf-overlay {
          display: block !important;
          position: static !important;
          width: 100% !important;
          margin: 0 !important;
          padding: ${overlayPadding} !important;
          box-sizing: border-box !important;
          box-decoration-break: clone !important;
          -webkit-box-decoration-break: clone !important;
          overflow: visible !important;
          background-color: var(--background-primary) !important;
          color: var(--text-normal) !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        #theme-pdf-overlay img,
        #theme-pdf-overlay video,
        #theme-pdf-overlay svg {
          max-width: 100% !important;
        }
      }
    `;
    document.head.appendChild(style);
    await sleep(100);
    new import_obsidian.Notice('\u{1F4C4} Choose "Save as PDF" in the print dialog');
    window.print();
    document.head.removeChild(style);
    document.body.removeChild(overlay);
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
    containerEl.createEl("h2", { text: "Theme PDF Export" });
    new import_obsidian.Setting(containerEl).setName("Page size").addDropdown(
      (d) => d.addOption("A4", "A4").addOption("Letter", "Letter").addOption("A3", "A3").setValue(this.plugin.settings.pageSize).onChange(async (v) => {
        this.plugin.settings.pageSize = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Orientation").addDropdown(
      (d) => d.addOption("portrait", "Portrait").addOption("landscape", "Landscape").setValue(this.plugin.settings.orientation).onChange(async (v) => {
        this.plugin.settings.orientation = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Include title").setDesc("Add the note title (Properties title, or file name) above the note body in the PDF.").addToggle(
      (t) => t.setValue(this.plugin.settings.includeTitle).onChange(async (v) => {
        this.plugin.settings.includeTitle = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Page margins").setDesc("CSS value, e.g. 20mm or 1in").addText(
      (t) => t.setValue(this.plugin.settings.margins).onChange(async (v) => {
        this.plugin.settings.margins = v;
        await this.plugin.saveSettings();
      })
    );
  }
};
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
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
