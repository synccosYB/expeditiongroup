export function removeSynkdexElements(doc: Pick<Document, "querySelectorAll" | "getElementById">) {
  doc.querySelectorAll('script[data-api-key]').forEach(element => element.remove());
  doc.getElementById("synkdex-widget")?.remove();
  doc.querySelectorAll(".sdx-overlay, .sdx-widget-btn").forEach(element => element.remove());
  // Shared app styles include widget selectors in their print rules.
  // Never delete stylesheets by matching text; only remove widget elements.
}
