import {
	App,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	Notice,
	MarkdownRenderer,
	MarkdownView,
} from "obsidian";

type PageOrientation = "portrait" | "landscape";

interface ThemePdfSettings {
	pageSize: string;
	margins: string;
	orientation: PageOrientation;
}

const DEFAULT_SETTINGS: ThemePdfSettings = {
	pageSize: "A4",
	margins: "20mm",
	orientation: "portrait",
};

export default class ThemedPdfExport extends Plugin {
	settings!: ThemePdfSettings;

	async onload() {
		await this.loadSettings();

		this.addRibbonIcon("file-down", "Export as PDF with theme", () => {
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (view?.file) {
				this.exportNote(view.file);
			} else {
				new Notice("Open a Markdown note first.");
			}
		});

		this.addCommand({
			id: "theme-pdf-export-current",
			name: "Export current note as PDF (with theme)",
			checkCallback: (checking) => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (view?.file) {
					if (!checking) this.exportNote(view.file);
					return true;
				}
				return false;
			},
		});

		this.addSettingTab(new ThemePdfSettingTab(this.app, this));
	}

	async exportNote(file: TFile) {
		new Notice(`Rendering "${file.basename}"…`);

		const tmp = document.createElement("div");
		tmp.style.cssText = "position:absolute;left:-99999px;top:0;width:800px;";
		document.body.appendChild(tmp);

		const content = await this.app.vault.read(file);
		await MarkdownRenderer.render(this.app, content, tmp, file.path, this as any);
		await sleep(800);

		const overlay = document.createElement("div");
		overlay.id = "theme-pdf-overlay";
		const themeClass = document.body.classList.contains("theme-dark") ? "theme-dark" : "theme-light";
		overlay.className = `markdown-preview-view markdown-rendered ${themeClass}`;
		overlay.innerHTML = tmp.innerHTML;
		document.body.removeChild(tmp);
		document.body.appendChild(overlay);

		const pageSizeCss =
			this.settings.orientation === "landscape"
				? `${this.settings.pageSize} landscape`
				: this.settings.pageSize;

		const marginSpec = this.settings.margins.trim();
		const overlayPadding = /\s/.test(marginSpec)
			? marginSpec
			: `calc(${marginSpec} * 1.4) ${marginSpec}`;

		const style = document.createElement("style");
		style.id = "theme-pdf-print-style";
		style.textContent = `
      @media screen {
        #theme-pdf-overlay { display: none !important; }
      }
      @media print {
        /* Page margin boxes stay unstyled (white) in Chromium — use 0 and inset content via overlay padding */
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
         * only the last gets padding-bottom — middle pages look tight vs page 1.
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
		new Notice('📄 Choose "Save as PDF" in the print dialog');
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
}

class ThemePdfSettingTab extends PluginSettingTab {
	plugin: ThemedPdfExport;

	constructor(app: App, plugin: ThemedPdfExport) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "Theme PDF Export" });

		new Setting(containerEl)
			.setName("Page size")
			.addDropdown((d) =>
				d
					.addOption("A4", "A4")
					.addOption("Letter", "Letter")
					.addOption("A3", "A3")
					.setValue(this.plugin.settings.pageSize)
					.onChange(async (v) => {
						this.plugin.settings.pageSize = v;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Orientation")
			.addDropdown((d) =>
				d
					.addOption("portrait", "Portrait")
					.addOption("landscape", "Landscape")
					.setValue(this.plugin.settings.orientation)
					.onChange(async (v) => {
						this.plugin.settings.orientation = v as PageOrientation;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Page margins")
			.setDesc("CSS value, e.g. 20mm or 1in")
			.addText((t) =>
				t
					.setValue(this.plugin.settings.margins)
					.onChange(async (v) => {
						this.plugin.settings.margins = v;
						await this.plugin.saveSettings();
					})
			);
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}
