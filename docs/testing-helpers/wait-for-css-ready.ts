import type { Page } from "@playwright/test";

/**
 * Wait until the app's main Tailwind stylesheet (client/src/index.css) has
 * been compiled by Vite, served, and applied to the document. The signal is
 * the CSS custom property `--css-ready: 1` declared on `:root` inside
 * index.css — it can only be read once that stylesheet is in effect.
 *
 * Use this immediately after page.goto(...) and before any visual or layout
 * assertions / screenshots. See docs/testing-css-readiness.md for context.
 */
export async function waitForCssReady(
  page: Page,
  options: { timeoutMs?: number; waitForFonts?: boolean } = {},
): Promise<void> {
  const { timeoutMs = 10_000, waitForFonts = true } = options;

  await page.waitForFunction(
    () =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--css-ready")
        .trim() === "1",
    null,
    { timeout: timeoutMs },
  );

  if (waitForFonts) {
    await page.evaluate(async () => {
      const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
      if (fonts?.ready) await fonts.ready;
    });
  }
}

/**
 * Inline snippet for use inside a `runTest` test plan when you don't want to
 * import a helper. Paste this as a [Browser] step right after navigation:
 *
 *   [Browser] Run page.waitForFunction(
 *     () => getComputedStyle(document.documentElement)
 *             .getPropertyValue('--css-ready').trim() === '1',
 *     null, { timeout: 10000 }
 *   ); then await document.fonts.ready.
 */
export const CSS_READY_SNIPPET = `await page.waitForFunction(
  () => getComputedStyle(document.documentElement).getPropertyValue('--css-ready').trim() === '1',
  null,
  { timeout: 10000 }
);
await page.evaluate(() => document.fonts && document.fonts.ready);`;
