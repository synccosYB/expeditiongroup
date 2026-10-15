import { copyPrintStyles, waitForPrintFonts, waitForPrintImages } from "./printAssets";

const WIDGET_SELECTORS = [
  ".sdx-widget-btn",
  ".sdx-overlay",
  ".sdx-modal",
  ".sdx-body",
  "#synkdex-widget",
  "[class*='sdx-']",
  "[id*='synkdex']",
  "[id*='sdx']",
  "script[data-api-key]",
  "iframe[src*='synkdex']",
  "iframe[id*='synkdex']",
  "iframe[id*='sdx']",
  "iframe[class*='sdx']",
];

export function installPrintListeners(): () => void {
  return () => {};
}

function stripWidgetFromClone(root: HTMLElement): void {
  WIDGET_SELECTORS.forEach((selector) => {
    root.querySelectorAll(selector).forEach((el) => el.remove());
  });
  root.querySelectorAll("script").forEach((el) => el.remove());
  root.querySelectorAll("iframe").forEach((el) => el.remove());
}

function copyHeadAssets(targetDoc: Document): Promise<void> {
  const head = targetDoc.head;
  const baseHref = document.baseURI;
  if (baseHref) {
    const base = targetDoc.createElement("base");
    base.setAttribute("href", baseHref);
    head.insertBefore(base, head.firstChild);
  }

  const stylesReady = copyPrintStyles(document, targetDoc);

  const meta = targetDoc.createElement("meta");
  meta.setAttribute("name", "viewport");
  meta.setAttribute("content", "width=device-width, initial-scale=1");
  head.appendChild(meta);

  const charset = targetDoc.createElement("meta");
  charset.setAttribute("charset", "utf-8");
  head.insertBefore(charset, head.firstChild);

  const printOnly = targetDoc.createElement("style");
  printOnly.textContent = `
    @page { margin: 0.5in; }
    html, body {
      background: #fff !important;
      color: #111 !important;
      margin: 0 !important;
      padding: 0 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-scheme: light !important;
    }
    .print\\:hidden,
    [data-sidebar],
    [data-testid="button-sidebar-toggle"],
    aside,
    header {
      display: none !important;
    }
  `;
  head.appendChild(printOnly);
  return stylesReady;
}

export function handlePrintWithWidgetRemoval(options: {
  documentTitle?: string;
  onError?: () => void;
}): void {
  const originalTitle = document.title;
  if (options.documentTitle) {
    document.title = options.documentTitle;
  }

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.setAttribute("title", options.documentTitle || "Print");
  iframe.style.cssText = [
    "position:fixed",
    "right:0",
    "bottom:0",
    "width:0",
    "height:0",
    "border:0",
    "opacity:0",
    "pointer-events:none",
    "z-index:-1",
  ].join(";");

  let cleanedUp = false;
  let cleanupTimer: ReturnType<typeof setTimeout> | undefined;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    clearTimeout(cleanupTimer);
    try {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    } catch {
      // ignore
    }
    document.title = originalTitle;
  };

  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    cleanup();
    return;
  }

  doc.open();
  doc.write("<!DOCTYPE html><html><head></head><body></body></html>");
  doc.close();

  const stylesReady = copyHeadAssets(doc);

  if (options.documentTitle) {
    const titleEl = doc.createElement("title");
    titleEl.textContent = options.documentTitle;
    doc.head.appendChild(titleEl);
  }

  doc.documentElement.classList.remove("dark");
  doc.documentElement.style.colorScheme = "light";

  const bodyClone = document.body.cloneNode(true) as HTMLElement;
  stripWidgetFromClone(bodyClone);
  bodyClone.classList.remove("dark");

  Array.from(bodyClone.attributes).forEach((attr) => {
    doc.body.setAttribute(attr.name, attr.value);
  });
  doc.body.classList.remove("dark");
  while (bodyClone.firstChild) {
    doc.body.appendChild(bodyClone.firstChild);
  }

  const onAfterPrint = () => {
    win.removeEventListener("afterprint", onAfterPrint);
    setTimeout(cleanup, 200);
  };
  win.addEventListener("afterprint", onAfterPrint);
  cleanupTimer = setTimeout(cleanup, 60000);

  // doc.close() can precede the dynamically copied stylesheet's load event.
  stylesReady
    .then(() => Promise.all([waitForPrintImages(doc), waitForPrintFonts(doc)]))
    .then(() => new Promise<void>((resolve) => setTimeout(resolve, 100)))
    .then(() => {
      if (cleanedUp) return;
      win.focus();
      win.print();
    })
    .catch(() => {
      cleanup();
      win.removeEventListener("afterprint", onAfterPrint);
      if (options.onError) options.onError();
      else window.alert("The print layout could not load. Please try printing again.");
    });
}
