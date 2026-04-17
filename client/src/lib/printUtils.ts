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

function copyHeadAssets(targetDoc: Document): void {
  const head = targetDoc.head;
  document
    .querySelectorAll<HTMLLinkElement | HTMLStyleElement>(
      'link[rel="stylesheet"], link[rel="preload"][as="style"], style'
    )
    .forEach((node) => {
      if (
        node.tagName === "STYLE" &&
        (node.textContent?.includes("sdx-widget-btn") ||
          node.textContent?.includes("synkdex-widget"))
      ) {
        return;
      }
      head.appendChild(node.cloneNode(true));
    });

  const baseHref = document.baseURI;
  if (baseHref) {
    const base = targetDoc.createElement("base");
    base.setAttribute("href", baseHref);
    head.insertBefore(base, head.firstChild);
  }

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
}

function waitForImages(doc: Document): Promise<void> {
  const images = Array.from(doc.images);
  if (images.length === 0) return Promise.resolve();
  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => {
            img.removeEventListener("load", done);
            img.removeEventListener("error", done);
            resolve();
          };
          img.addEventListener("load", done);
          img.addEventListener("error", done);
        })
    )
  ).then(() => undefined);
}

function waitForFonts(doc: Document): Promise<void> {
  const fonts = (doc as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
  if (fonts && fonts.ready) {
    return fonts.ready.then(() => undefined).catch(() => undefined);
  }
  return Promise.resolve();
}

export function handlePrintWithWidgetRemoval(options: {
  documentTitle?: string;
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
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
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

  copyHeadAssets(doc);

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

  let didTriggerPrint = false;
  let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

  const triggerPrint = () => {
    if (didTriggerPrint) return;
    didTriggerPrint = true;
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }

    const onAfterPrint = () => {
      win.removeEventListener("afterprint", onAfterPrint);
      setTimeout(cleanup, 200);
    };
    win.addEventListener("afterprint", onAfterPrint);
    setTimeout(cleanup, 60000);

    waitForImages(doc)
      .then(() => waitForFonts(doc))
      .then(() => new Promise<void>((r) => setTimeout(r, 100)))
      .then(() => {
        try {
          win.focus();
          win.print();
        } catch {
          // ignore
        }
      });
  };

  if (doc.readyState === "complete") {
    triggerPrint();
  } else {
    win.addEventListener("load", triggerPrint, { once: true });
    fallbackTimer = setTimeout(triggerPrint, 1500);
  }
}
