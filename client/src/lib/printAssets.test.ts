import assert from "node:assert/strict";
import test from "node:test";
import { copyPrintStyles, waitForPrintFonts, waitForPrintImages, waitForPrintStylesheet } from "./printAssets";

class Link extends EventTarget {
  tagName = "LINK";
  textContent = "";
  sheet: CSSStyleSheet | null = null;
  constructor(readonly href: string) { super(); }
  getAttribute(name: string) { return name === "href" ? this.href : name === "rel" ? "stylesheet" : null; }
  cloneNode() { return new Link(this.href); }
  asElement() { return this as unknown as HTMLLinkElement; }
}

const base = "https://example.test/invoices/460";

test("print preparation keeps app CSS with widget-hiding rules and waits for its linked stylesheet", async () => {
  const appCss = ".invoice-header{display:flex}@media print{.sdx-widget-btn{display:none}}";
  const style = { tagName: "STYLE", textContent: appCss, cloneNode() { return { ...this }; } };
  const appended: Array<Link | typeof style> = [];
  const source = { baseURI: base, querySelectorAll: () => [style, new Link("/assets/app.css")] } as unknown as Document;
  const target = { head: { appendChild: (node: Link | typeof style) => appended.push(node) } } as unknown as Document;
  let ready = false;
  const preparation = copyPrintStyles(source, target).then(() => { ready = true; });
  await Promise.resolve();
  assert.equal(ready, false, "preview must not open while app CSS is loading");
  assert.equal(appended[0].textContent, appCss, "shared app styles must survive widget cleanup");
  (appended[1] as Link).dispatchEvent(new Event("load"));
  await preparation;
  assert.equal(ready, true);
});

test("a failed app stylesheet rejects print preparation instead of printing unstyled content", async () => {
  const link = new Link("/assets/app.css");
  const rejected = assert.rejects(waitForPrintStylesheet(link.asElement(), base), /Print stylesheet unavailable/);
  link.dispatchEvent(new Event("error"));
  await rejected;
});

test("a stylesheet timeout rejects print preparation", async () => {
  await assert.rejects(waitForPrintStylesheet(new Link("/assets/app.css").asElement(), base, 1), /Print stylesheet unavailable/);
});

test("an already loaded stylesheet does not wait for another load event", async () => {
  const link = new Link("/assets/app.css");
  link.sheet = {} as CSSStyleSheet;
  await waitForPrintStylesheet(link.asElement(), base);
});

test("an unavailable external font stylesheet does not prevent printing with fallback fonts", async () => {
  const link = new Link("https://fonts.example.test/inter.css");
  const preparation = waitForPrintStylesheet(link.asElement(), base);
  link.dispatchEvent(new Event("error"));
  await preparation;
});

test("completed broken images do not wait forever for an error event that already happened", async () => {
  const doc = { images: [{ complete: true, naturalWidth: 0 }] } as unknown as Document;
  await waitForPrintImages(doc);
});

test("image and font requests that never finish have bounded waits", async () => {
  const image = Object.assign(new EventTarget(), { complete: false });
  const doc = { images: [image], fonts: { ready: new Promise(() => {}) } } as unknown as Document;
  await Promise.all([waitForPrintImages(doc, 1), waitForPrintFonts(doc, 1)]);
});

test("font rejection still permits the loaded layout to print", async () => {
  const doc = { fonts: { ready: Promise.reject(new Error("Font unavailable")) } } as unknown as Document;
  await waitForPrintFonts(doc);
});
