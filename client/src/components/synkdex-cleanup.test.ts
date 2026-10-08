import assert from "node:assert/strict";
import { removeSynkdexElements } from "./synkdex-cleanup";

const node = (textContent = "") => ({ textContent, removed: false, remove() { this.removed = true; } });
const appStyle = node("@media print { .sdx-widget-btn { display: none } }");
const widgetScript = node();
const widget = node();
const overlay = node();
const button = node();
const unrelated = node();
const doc = {
  getElementById: (id: string) => id === "synkdex-widget" ? widget : null,
  querySelectorAll: (selector: string) => {
    if (selector === 'script[data-api-key]') return [widgetScript];
    if (selector === ".sdx-overlay, .sdx-widget-btn") return [overlay, button];
    if (selector === "style") return [appStyle];
    return [unrelated];
  },
} as unknown as Pick<Document, "querySelectorAll" | "getElementById">;

removeSynkdexElements(doc);
assert.equal(appStyle.removed, false, "app stylesheet must survive widget cleanup");
assert.equal(unrelated.removed, false, "unrelated elements must survive cleanup");
for (const element of [widgetScript, widget, overlay, button]) assert.equal(element.removed, true);
removeSynkdexElements(doc);
assert.equal(appStyle.removed, false, "repeated cleanup must preserve the app stylesheet");
console.log("Widget cleanup regression checks passed");
