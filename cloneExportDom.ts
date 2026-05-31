import { MarkdownView } from "obsidian";

/** Obsidian editor CM6 instance (not in public API types). */
type CmEditor = {
	viewState: { printing: boolean };
	measure: () => void;
};

const SCROLL_STEP_PX = 50;
const MATERIALIZE_PAUSE_MS = 16;

const CODE_BLOCK_SELECTOR = [
	"pre",
	".HyperMD-codeblock",
	".markdown-rendered pre",
].join(", ");

const CODE_WRAPPER_SELECTOR = [".code-block", ".cm-embed-block", 'div[class*="block-language-"]'].join(
	", ",
);

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

/** Deep-clone visible markdown DOM from the active view (WYSIWYG export). */
export async function cloneActiveNoteDom(view: MarkdownView): Promise<HTMLElement | null> {
	const saved = saveViewState(view);
	try {
		await materializeFullDocument(view);
		const liveSource = findLiveMarkdownRoot(view);
		if (!liveSource) return null;

		const cloned = liveSource.cloneNode(true) as HTMLElement;
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

type SavedViewState = {
	editorScroll: { left: number; top: number };
	previewScroll: number;
};

function saveViewState(view: MarkdownView): SavedViewState {
	return {
		editorScroll: view.editor.getScrollInfo(),
		previewScroll: view.previewMode.getScroll(),
	};
}

function getCmEditor(view: MarkdownView): CmEditor | null {
	const cm = (view.editor as unknown as { cm?: CmEditor }).cm;
	return cm ?? null;
}

function restoreViewState(view: MarkdownView, saved: SavedViewState): void {
	const cm = getCmEditor(view);
	if (cm?.viewState.printing) {
		cm.viewState.printing = false;
		cm.measure();
	}
	view.editor.scrollTo(saved.editorScroll.left, saved.editorScroll.top);
	view.previewMode.applyScroll(saved.previewScroll);
}

async function materializeFullDocument(view: MarkdownView): Promise<void> {
	if (view.getMode() === "preview") {
		const preview = view.previewMode as MarkdownView["previewMode"] & {
			unfoldAll?: () => void;
		};
		preview.unfoldAll?.();
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
	getCmEditor(view)?.measure();
}

/** Live DOM node to clone — must match what the user sees, not a hidden reading copy. */
function findLiveMarkdownRoot(view: MarkdownView): HTMLElement | null {
	if (view.getMode() === "preview") {
		const sizer = view.previewMode.containerEl.querySelector(".markdown-preview-sizer");
		return sizer as HTMLElement | null;
	}

	// Live Preview: prefer the editor surface the user sees
	const sourceView = view.contentEl.querySelector(".markdown-source-view");
	if (sourceView) {
		return sourceView as HTMLElement;
	}

	const readingSizer = view.contentEl.querySelector(
		".markdown-reading-view .markdown-preview-sizer",
	);
	if (readingSizer?.childElementCount) {
		return readingSizer as HTMLElement;
	}

	return null;
}

/**
 * Snapshot computed syntax colors from the live tree onto the clone so export
 * does not re-resolve --code-* / accent CSS variables at print time.
 */
function freezeCodeColors(liveRoot: HTMLElement, cloneRoot: HTMLElement): void {
	const liveBlocks = collectColorFreezeRoots(liveRoot);
	const cloneBlocks = collectColorFreezeRoots(cloneRoot);

	const count = Math.min(liveBlocks.length, cloneBlocks.length);
	for (let i = 0; i < count; i++) {
		freezeSubtreeStyles(liveBlocks[i], cloneBlocks[i]);
		freezePseudoDecorations(liveBlocks[i], cloneBlocks[i]);
	}
}

function collectColorFreezeRoots(root: HTMLElement): HTMLElement[] {
	const seen = new Set<HTMLElement>();
	const blocks: HTMLElement[] = [];

	const add = (el: Element | null | undefined) => {
		if (!el || !(el instanceof HTMLElement) || seen.has(el)) return;
		seen.add(el);
		blocks.push(el);
	};

	root.querySelectorAll(CODE_BLOCK_SELECTOR).forEach((el) => {
		const html = el as HTMLElement;
		add(html);
		add(html.closest(CODE_WRAPPER_SELECTOR));
		add(html.parentElement?.closest(CODE_WRAPPER_SELECTOR) ?? null);
	});

	root.querySelectorAll(CODE_WRAPPER_SELECTOR).forEach((el) => {
		if (el.querySelector("pre, .HyperMD-codeblock, code")) {
			add(el);
		}
	});

	// Inline code outside pre
	root.querySelectorAll<HTMLElement>("code").forEach((el) => {
		if (!el.closest("pre")) {
			add(el);
		}
	});

	return blocks;
}

function freezeSubtreeStyles(liveEl: HTMLElement, cloneEl: HTMLElement): void {
	const liveNodes = [liveEl, ...Array.from(liveEl.querySelectorAll<HTMLElement>("*"))];
	const cloneNodes = [cloneEl, ...Array.from(cloneEl.querySelectorAll<HTMLElement>("*"))];

	if (liveNodes.length !== cloneNodes.length) {
		freezeElementStyle(liveEl, cloneEl);
		return;
	}

	for (let i = 0; i < liveNodes.length; i++) {
		freezeElementStyle(liveNodes[i], cloneNodes[i]);
	}
}

function freezeElementStyle(live: HTMLElement, clone: HTMLElement): void {
	const cs = getComputedStyle(live);

	const color = cs.color;
	if (color) {
		clone.style.setProperty("color", color, "important");
	}

	const bg = cs.backgroundColor;
	if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
		clone.style.setProperty("background-color", bg, "important");
	}

	// Shiki / some themes set -webkit-text-fill-color
	const fill = cs.webkitTextFillColor;
	if (fill && fill !== color) {
		clone.style.setProperty("-webkit-text-fill-color", fill, "important");
	}

	freezeBorderAndOutline(live, clone, cs);
}

const BORDER_SIDES = ["top", "right", "bottom", "left"] as const;

function freezeBorderAndOutline(live: HTMLElement, clone: HTMLElement, cs: CSSStyleDeclaration): void {
	for (const side of BORDER_SIDES) {
		const width = cs.getPropertyValue(`border-${side}-width`);
		const style = cs.getPropertyValue(`border-${side}-style`);
		const color = cs.getPropertyValue(`border-${side}-color`);
		if (style === "none" || width === "0px") continue;
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

/** Materialize ::before / ::after accent borders as a real element (pseudo styles cannot be inlined). */
function freezePseudoDecorations(live: HTMLElement, clone: HTMLElement): void {
	for (const pseudo of ["::before", "::after"] as const) {
		const cs = getComputedStyle(live, pseudo);
		if (cs.content === "none" && cs.borderWidth === "0px" && cs.backgroundColor === "rgba(0, 0, 0, 0)") {
			continue;
		}
		if (!hasVisiblePseudoDecoration(cs)) continue;

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

function hasVisiblePseudoDecoration(cs: CSSStyleDeclaration): boolean {
	if (cs.display === "none" || cs.visibility === "hidden") return false;
	if (cs.borderStyle !== "none" && cs.borderWidth !== "0px") return true;
	const bg = cs.backgroundColor;
	if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") return true;
	const w = parseFloat(cs.width);
	const h = parseFloat(cs.height);
	return (w > 0 && !Number.isNaN(w)) || (h > 0 && !Number.isNaN(h));
}

function applyPseudoComputedStyle(el: HTMLElement, cs: CSSStyleDeclaration, pseudo: "::before" | "::after"): void {
	el.style.setProperty("content", '""', "important");
	el.style.setProperty("display", cs.display === "inline" ? "block" : cs.display, "important");
	el.style.setProperty("position", "absolute", "important");
	el.style.setProperty("box-sizing", "border-box", "important");

	const positionProps = ["top", "right", "bottom", "left", "width", "height", "inset"] as const;
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
		if (style === "none" || width === "0px") continue;
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

function sanitizeClone(root: HTMLElement): HTMLElement {
	root.querySelectorAll(".collapse-indicator").forEach((el) => el.remove());
	root.querySelectorAll(".search-result-file-matches").forEach((el) => el.remove());
	root.querySelectorAll(".obsidian-search-match-highlight").forEach((el) => {
		const parent = el.parentNode;
		if (!parent) return;
		while (el.firstChild) parent.insertBefore(el.firstChild, el);
		el.remove();
	});

	root.querySelectorAll<HTMLElement>("[style]").forEach((el) => {
		if (el.style.display === "none") {
			el.style.removeProperty("display");
		}
	});

	return root;
}
