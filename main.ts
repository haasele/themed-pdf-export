import {
	App,
	Component,
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
	includeTitle: boolean;
}

const DEFAULT_SETTINGS: ThemePdfSettings = {
	pageSize: "A4",
	margins: "20mm",
	orientation: "portrait",
	includeTitle: false,
};

export default class ThemedPdfExport extends Plugin {
	settings!: ThemePdfSettings;

	async onload() {
		await this.loadSettings();

		this.addRibbonIcon("file-down", "Export as PDF with theme", () => {
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (view?.file) {
				void this.exportNote(view.file);
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
					if (!checking) void this.exportNote(view.file);
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
		tmp.classList.add("theme-pdf-export-tmp");
		document.body.appendChild(tmp);

		const renderOwner = new Component();
		renderOwner.load();

		let overlay: HTMLDivElement | undefined;
		try {
			const content = await this.app.vault.read(file);
			await MarkdownRenderer.render(this.app, content, tmp, file.path, renderOwner);
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
			const overlayPadding = /\s/.test(marginSpec)
				? marginSpec
				: `calc(${marginSpec} * 1.4) ${marginSpec}`;
			overlay.setCssProps({ "--theme-pdf-overlay-padding": overlayPadding });

			await sleep(100);
			new Notice('Choose "Save as PDF" in the print dialog');
			window.print();

			document.body.removeChild(overlay);
			overlay = undefined;
		} finally {
			if (overlay?.isConnected) {
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
		new Setting(containerEl)
		.setName("Export Settings")
		.setHeading();

		new Setting(containerEl)
			.setName("Page size")
			.addDropdown((d) =>
				d
					.addOption("A4", "A4")
					.addOption("Letter", "Letter")
					.addOption("A3", "A3")
					.setValue(this.plugin.settings.pageSize)
					.onChange((v) => {
						this.plugin.settings.pageSize = v;
						void this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Orientation")
			.addDropdown((d) =>
				d
					.addOption("portrait", "Portrait")
					.addOption("landscape", "Landscape")
					.setValue(this.plugin.settings.orientation)
					.onChange((v) => {
						this.plugin.settings.orientation = v as PageOrientation;
						void this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Include title")
			.setDesc("Add the note title (Properties title, or file name) above the note body in the PDF.")
			.addToggle((t) =>
				t.setValue(this.plugin.settings.includeTitle).onChange((v) => {
					this.plugin.settings.includeTitle = v;
					void this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Page margins")
			.setDesc("CSS value, e.g. 20mm or 1in")
			.addText((t) =>
				t
					.setValue(this.plugin.settings.margins)
					.onChange((v) => {
						this.plugin.settings.margins = v;
						void this.plugin.saveSettings();
					})
			);
	}
}

/** Maps settings to classes defined in styles.css for named @page rules. */
function printPageClassNames(pageSize: string, orientation: PageOrientation): string[] {
	const slug = pageSize === "Letter" ? "letter" : pageSize.toLowerCase();
	return [`theme-pdf-page-${slug}`, `theme-pdf-orient-${orientation}`];
}

function resolveExportTitle(app: App, file: TFile): string {
	const fm = app.metadataCache.getFileCache(file)?.frontmatter;
	if (fm != null && fm.title != null) {
		const s = String(fm.title).trim();
		if (s) return s;
	}
	return file.basename.replace(/\.md$/i, "");
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}
