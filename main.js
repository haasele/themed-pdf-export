"use strict";

const { Plugin, PluginSettingTab, Setting, Notice, MarkdownRenderer, MarkdownView } = require("obsidian");
const DEFAULT_SETTINGS = { pageSize: "A4", margins: "20mm" };

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

class ThemedPdfExport extends Plugin {
  async onload() {
    await this.loadSettings();

    this.addRibbonIcon("file-down", "Export as PDF with theme", () => {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (view?.file) this.exportNote(view.file);
      else new Notice("Open a Markdown note first.");
    });

    this.addCommand({
      id: "theme-pdf-export-current",
      name: "Export current note as PDF (with theme)",
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view?.file) { if (!checking) this.exportNote(view.file); return true; }
        return false;
      },
    });

    this.addSettingTab(new ThemePdfSettingTab(this.app, this));
  }

  async exportNote(file) {
    new Notice(`Rendering "${file.basename}"…`);

    const tmp = document.createElement("div");
    tmp.style.cssText = "position:absolute;left:-99999px;top:0;width:800px;";
    document.body.appendChild(tmp);

    const content = await this.app.vault.read(file);
    await MarkdownRenderer.render(this.app, content, tmp, file.path, this);
    await sleep(800);

    const overlay = document.createElement("div");
    overlay.id = "theme-pdf-overlay";
    const themeClass = document.body.classList.contains("theme-dark") ? "theme-dark" : "theme-light";
    overlay.className = `markdown-preview-view markdown-rendered ${themeClass}`;
    overlay.innerHTML = tmp.innerHTML;
    document.body.removeChild(tmp);
    document.body.appendChild(overlay);

    const style = document.createElement("style");
    style.id = "theme-pdf-print-style";
    style.textContent = `
      @media screen {
        #theme-pdf-overlay { display: none !important; }
      }
      @media print {
        /* Zero out ALL browser/Electron default page margins */
        @page {
          size: ${this.settings.pageSize};
          margin: 0 !important;
        }

        /* html and body: theme background edge-to-edge, no gaps */
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

        /* Overlay: fixed fills full page, padding provides the readable margins */
        #theme-pdf-overlay {
          display: block !important;
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          margin: 0 !important;
          padding: ${this.settings.margins} !important;
          box-sizing: border-box !important;
          overflow: visible !important;
          background-color: var(--background-primary) !important;
          color: var(--text-normal) !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
    `;
    document.head.appendChild(style);

    await sleep(100);
    new Notice('📄 Choose "Save as PDF" in the print dialog');
    window.print();

    document.head.removeChild(style);
    document.body.removeChild(overlay);
  }

  async loadSettings() { this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()); }
  async saveSettings() { await this.saveData(this.settings); }
}

class ThemePdfSettingTab extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Theme PDF Export" });

    new Setting(containerEl)
      .setName("Page size")
      .addDropdown((d) =>
        d.addOption("A4","A4").addOption("Letter","Letter").addOption("A3","A3")
         .setValue(this.plugin.settings.pageSize)
         .onChange(async (v) => { this.plugin.settings.pageSize = v; await this.plugin.saveSettings(); })
      );

    new Setting(containerEl)
      .setName("Page margins")
      .setDesc("CSS value, e.g. 20mm or 1in")
      .addText((t) =>
        t.setValue(this.plugin.settings.margins)
         .onChange(async (v) => { this.plugin.settings.margins = v; await this.plugin.saveSettings(); })
      );
  }
}

module.exports = ThemedPdfExport;
