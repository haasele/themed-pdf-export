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
    const tmp = document.createElement("div");
    tmp.classList.add("theme-pdf-export-tmp");
    document.body.appendChild(tmp);
    const renderOwner = new import_obsidian.Component();
    renderOwner.load();
    let overlay;
    try {
      const content = await this.app.vault.read(file);
      await import_obsidian.MarkdownRenderer.render(this.app, content, tmp, file.path, renderOwner);
      await sleep(800);
      if (this.settings.includeTitle) {
        const title = resolveExportTitle(this.app, file);
        const h1 = tmp.createEl("h1", { cls: "inline-title", text: title });
        tmp.prepend(h1);
      }
      overlay = document.createElement("div");
      overlay.id = "theme-pdf-overlay";
      const themeClass = document.body.classList.contains("theme-dark") ? "theme-dark" : "theme-light";
      overlay.classList.add("markdown-preview-view", "markdown-rendered", themeClass);
      for (const c of printPageClassNames(this.settings.pageSize, this.settings.orientation)) {
        overlay.classList.add(c);
      }
      while (tmp.firstChild) {
        overlay.appendChild(tmp.firstChild);
      }
      document.body.removeChild(tmp);
      document.body.appendChild(overlay);
      const marginSpec = this.settings.margins.trim();
      const overlayPadding = /\s/.test(marginSpec) ? marginSpec : `calc(${marginSpec} * 1.4) ${marginSpec}`;
      overlay.setCssProps({ "--theme-pdf-overlay-padding": overlayPadding });
      await sleep(100);
      new import_obsidian.Notice('Choose "Save as PDF" in the print dialog');
      window.print();
      document.body.removeChild(overlay);
      overlay = void 0;
    } finally {
      if (overlay == null ? void 0 : overlay.isConnected) {
        overlay.remove();
      }
      if (tmp.isConnected) {
        tmp.remove();
      }
      renderOwner.unload();
    }
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
    new import_obsidian.Setting(containerEl).setName("Export Settings").setHeading();
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
    new import_obsidian.Setting(containerEl).setName("Include title").setDesc("Add the note title (Properties title, or file name) above the note body in the PDF.").addToggle(
      (t) => t.setValue(this.plugin.settings.includeTitle).onChange((v) => {
        this.plugin.settings.includeTitle = v;
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
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
