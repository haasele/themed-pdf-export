import { App, Plugin, PluginSettingTab, Setting, TFile, Notice, MarkdownView } from "obsidian";

interface ThemePdfSettings {
	margins: string;
	pageSize: string;
	includeFilename: boolean;
}

const DEFAULT_SETTINGS: ThemePdfSettings = {
	margins: "20mm",
	pageSize: "A4",
	includeFilename: true,
};

export default class ThemePdfExport extends Plugin {
	settings: ThemePdfSettings;

	async onload() {
		await this.loadSettings();

		// Command: Export current note
		this.addCommand({
			id: "export-current-note-pdf",
			name: "Export current note as PDF (with theme)",
			checkCallback: (checking) => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (view) {
					if (!checking) this.exportNote(view.file!);
					return true;
				}
				return false;
			},
		});

		// Ribbon icon
		this.addRibbonIcon("file-down", "Export as PDF with theme", () => {
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (view?.file) {
				this.exportNote(view.file);
			} else {
				new Notice("Open a Markdown note first.");
			}
		});

		this.addSettingTab(new ThemePdfSettingTab(this.app, this));
	}

	async exportNote(file: TFile) {
		new Notice(`Exporting "${file.basename}"…`);

		try {
			// 1. Render the note using Obsidian's own renderer into a hidden container
			const container = document.createElement("div");
			container.style.cssText = "position:absolute;left:-9999px;top:-9999px;width:860px;";
			document.body.appendChild(container);

			// Apply the same classes Obsidian uses for its preview pane
			const themeClass = document.body.classList.contains("theme-dark") ? "theme-dark" : "theme-light";
			container.className = `markdown-preview-view markdown-rendered ${themeClass}`;

			// Use Obsidian's internal renderer — this gives us callouts, embeds, tasks, etc.
			await (this.app as any).internalPlugins?.plugins?.["markdown-importer"]?.instance;

			// MarkdownRenderer is the correct API
			const { MarkdownRenderer } = await import("obsidian");
			const content = await this.app.vault.read(file);

			await MarkdownRenderer.render(
				this.app,
				content,
				container,
				file.path,
				this as any
			);

			// Small delay to let async embeds/callouts settle
			await sleep(400);

			// 2. Grab ALL stylesheets currently loaded in Obsidian (theme + snippets + plugins)
			const allCSS = this.collectAllCSS();

			// 3. Build a self-contained HTML document
			const html = this.buildHTML(file.basename, container.innerHTML, allCSS, themeClass);

			// 4. Print via a hidden iframe — this stays inside Electron so all CSS is live
			await this.printHTMLAsPDF(html, file.basename);

			document.body.removeChild(container);
		} catch (e) {
			console.error("[ThemePDF] Export failed:", e);
			new Notice("Export failed — check the console (Ctrl+Shift+I) for details.");
		}
	}

	collectAllCSS(): string {
		const parts: string[] = [];

		for (const sheet of Array.from(document.styleSheets)) {
			try {
				// Skip external sheets we can't read (CORS)
				const rules = sheet.cssRules;
				if (!rules) continue;

				const sheetCSS = Array.from(rules)
					.map((r) => r.cssText)
					.join("\n");

				parts.push(sheetCSS);
			} catch {
				// cross-origin stylesheet, skip
			}
		}

		return parts.join("\n\n");
	}

	buildHTML(title: string, body: string, css: string, themeClass: string): string {
		return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    ${css}

    /* PDF/print overrides */
    @media print {
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      body { margin: 0 !important; }
    }

    body {
      max-width: 100%;
      padding: ${this.settings.margins};
      box-sizing: border-box;
    }

    /* Make sure page background comes through */
    html, body {
      background-color: var(--background-primary) !important;
      color: var(--text-normal) !important;
    }
  </style>
</head>
<body class="${themeClass}">
  <div class="markdown-preview-view markdown-rendered ${themeClass}">
    ${body}
  </div>
</body>
</html>`;
	}

	async printHTMLAsPDF(html: string, filename: string): Promise<void> {
		return new Promise((resolve, reject) => {
			// Create a hidden iframe inside Electron — inherits the full CSS context
			const iframe = document.createElement("iframe");
			iframe.style.cssText = "position:fixed;left:-9999px;top:0;width:210mm;height:297mm;border:none;";
			document.body.appendChild(iframe);

			const iframeDoc = iframe.contentDocument!;
			iframeDoc.open();
			iframeDoc.write(html);
			iframeDoc.close();

			iframe.onload = async () => {
				try {
					await sleep(300); // let fonts/images settle

					const iframeWindow = iframe.contentWindow as any;

					// Electron exposes window.print() which triggers the native print-to-PDF dialog
					// We hook it via webContents if available, otherwise fall back to window.print()
					const { remote } = (window as any).require?.("electron") ?? {};

					if (remote) {
						// Electron remote API: save directly without dialog
						const webContents = remote.getCurrentWebContents();
						const pdfData: Buffer = await webContents.printToPDF({
							printBackground: true,
							pageSize: this.settings.pageSize,
							margins: {
								marginType: "custom",
								top: 0.5,
								bottom: 0.5,
								left: 0.5,
								right: 0.5,
							},
						} as any);

						// Write via Vault adapter so we stay inside the vault or pick a path
						const outputPath = file_suggestPath(this.app, filename);
						await this.app.vault.adapter.writeBinary(outputPath, pdfData);
						new Notice(`✓ PDF saved: ${outputPath}`);
					} else {
						// Fallback: trigger browser print dialog
						// The user can then "Save as PDF" from the native dialog
						iframeWindow.focus();
						iframeWindow.print();
						new Notice('Use "Save as PDF" in the print dialog that opened.');
					}

					document.body.removeChild(iframe);
					resolve();
				} catch (err) {
					document.body.removeChild(iframe);
					reject(err);
				}
			};
		});
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

/** Suggest an output path next to the note, avoiding overwrites */
function file_suggestPath(app: App, basename: string): string {
	const base = `${basename}.pdf`;
	// Check if a file with that name exists and increment
	let i = 1;
	let candidate = base;
	while (app.vault.getAbstractFileByPath(candidate)) {
		candidate = `${basename} (${i++}).pdf`;
	}
	return candidate;
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

class ThemePdfSettingTab extends PluginSettingTab {
	plugin: ThemePdfExport;

	constructor(app: App, plugin: ThemePdfExport) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "Theme PDF Export" });

		new Setting(containerEl)
			.setName("Page size")
			.setDesc("Paper format for the PDF")
			.addDropdown((drop) =>
				drop
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
			.setName("Margins")
			.setDesc("CSS margin value, e.g. 20mm or 1in")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.margins)
					.onChange(async (v) => {
						this.plugin.settings.margins = v;
						await this.plugin.saveSettings();
					})
			);
	}
}
