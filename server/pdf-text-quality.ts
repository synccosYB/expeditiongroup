// pdf-parse inserts page counters even when a scan has no text layer.
export function hasReadablePdfText(text: string): boolean {
  const content = text.replace(/^\s*--\s*\d+\s+of\s+\d+\s*--\s*$/gm, "").trim();
  return content.length >= 20 && /[\p{L}]/u.test(content);
}
