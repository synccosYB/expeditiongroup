/** Wait for a copied stylesheet before measuring fonts or opening print preview. */
export function waitForPrintStylesheet(
  link: HTMLLinkElement,
  baseUrl: string,
  timeoutMs?: number,
): Promise<void> {
  if (link.sheet) return Promise.resolve();
  const required = new URL(link.getAttribute("href") || "", baseUrl).origin === new URL(baseUrl).origin;
  return new Promise((resolve, reject) => {
    const finish = (failed: boolean) => {
      clearTimeout(timer);
      link.removeEventListener("load", loaded);
      link.removeEventListener("error", failedToLoad);
      if (failed && required) reject(new Error("Print stylesheet unavailable"));
      else resolve();
    };
    const loaded = () => finish(false);
    const failedToLoad = () => finish(true);
    const timer = setTimeout(failedToLoad, timeoutMs ?? (required ? 5000 : 1000));
    link.addEventListener("load", loaded);
    link.addEventListener("error", failedToLoad);
    if (link.sheet) loaded();
  });
}

export function copyPrintStyles(source: Document, target: Document): Promise<void> {
  const pending: Promise<void>[] = [];
  source.querySelectorAll<HTMLLinkElement | HTMLStyleElement>(
    'link[rel="stylesheet"], link[rel="preload"][as="style"], style',
  ).forEach((node) => {
    const clone = node.cloneNode(true) as HTMLLinkElement | HTMLStyleElement;
    // App styles also contain widget-hiding selectors. Keep the stylesheet;
    // the widget elements themselves are removed from the cloned body.
    if (clone.tagName === "LINK" && clone.getAttribute("rel") === "stylesheet") {
      pending.push(waitForPrintStylesheet(clone as HTMLLinkElement, source.baseURI));
    }
    target.head.appendChild(clone);
  });
  return Promise.all(pending).then(() => undefined);
}

export function waitForPrintImages(doc: Document, timeoutMs = 5000): Promise<void> {
  return Promise.all(Array.from(doc.images).map((image) => {
    // A completed broken image has already emitted its error event.
    if (image.complete) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        image.removeEventListener("load", done);
        image.removeEventListener("error", done);
        resolve();
      };
      const timer = setTimeout(done, timeoutMs);
      image.addEventListener("load", done);
      image.addEventListener("error", done);
      if (image.complete) done();
    });
  })).then(() => undefined);
}

export function waitForPrintFonts(doc: Document, timeoutMs = 2000): Promise<void> {
  if (!doc.fonts?.ready) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => { clearTimeout(timer); resolve(); };
    const timer = setTimeout(done, timeoutMs);
    doc.fonts.ready.then(done, done);
  });
}
