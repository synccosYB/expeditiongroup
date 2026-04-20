# CSS Readiness in Automated Tests

## The problem we hit (task #41)

While verifying the FR-0022 reconciliation layout (task #38), the e2e testing
harness repeatedly returned screenshots in which the app rendered without
Tailwind styles — sidebar items as bulleted plain links, cards without
backgrounds, the responsive grid not triggering — even though:

- The dev server's compiled CSS contained the expected utilities
  (`.md\:grid-cols-2` inside `@media (min-width: 768px)`).
- A direct manual screenshot of the dev preview showed the page fully styled.
- `document.styleSheets.length` inside the testing browser was non-zero with
  hundreds of CSS rules.

## Root cause

In Vite dev, `client/src/index.css` (which contains `@tailwind base/components/utilities`)
is delivered as a **JavaScript module** that injects its compiled CSS into the
DOM via a `<style>` tag at runtime. Several things load CSS earlier and faster:

- The `<link>` to Google Fonts in `client/index.html`
- Replit dev plugins: `@replit/vite-plugin-runtime-error-modal`,
  `@replit/vite-plugin-dev-banner`, `@replit/vite-plugin-cartographer` —
  each injects its own `<style>` tag
- shadcn portals, the Vite client overlay, etc.

When the first request after a dev-server restart triggers Tailwind to
compile (which can take a few seconds on cold cache), the app's React tree
mounts and renders before `index.css`'s injected `<style>` is in the DOM. The
testing browser sees ~30 stylesheets and "hundreds of rules" (from the dev
plugins, fonts, and partial chunks) but **no Tailwind** — so the screenshot
looks unstyled.

Playwright's `networkidle` does not help here: the CSS arrives as a JS module
that finishes after `networkidle` fires, and the actual `<style>` insertion
happens inside an `import.meta.hot` callback that doesn't issue further HTTP.

## The reliable pattern: `--css-ready`

`client/src/index.css` defines `--css-ready: 1` on `:root`. Because the
variable lives inside our app stylesheet, it is only present once that
stylesheet has been compiled, served, and applied. It costs nothing at
runtime and gives a single, deterministic readiness signal.

### Use it from a Playwright / e2e test

A reusable helper lives at `docs/testing-helpers/wait-for-css-ready.ts`:

```ts
import { waitForCssReady } from "../docs/testing-helpers/wait-for-css-ready";

await page.goto("/reconciliation");
await waitForCssReady(page);            // unblocks once Tailwind has applied
await expect(page).toHaveScreenshot();  // now safe
```

If you don't want the import, the inline form is:

```ts
await page.waitForFunction(
  () =>
    getComputedStyle(document.documentElement)
      .getPropertyValue('--css-ready')
      .trim() === '1',
  null,
  { timeout: 10_000 },
);
await page.evaluate(() => (document as any).fonts?.ready);
```

### Use it from the testing skill (`runTest`)

When writing a test plan, add this step right after navigation and before any
visual / layout `[Verify]`:

```
[Browser] Wait until the document's computed style for `--css-ready` equals
"1" (indicates that client/src/index.css has been applied). Use a
page.waitForFunction with up to a 10s timeout. Then wait for document.fonts.ready.
```

## What this is not

- It is not a substitute for `await page.waitForLoadState('networkidle')` — use
  both. `networkidle` covers data fetches, `--css-ready` covers Tailwind.
- It does not guarantee that *every* component's lazy chunk has loaded; only
  that the global Tailwind base/utilities are applied. Components that own
  no CSS of their own (which is essentially all of ours, since we're
  Tailwind-only) are fine. If you ever introduce a route-level CSS module,
  add a route-specific data attribute or repeat the same readiness trick for
  that module.
