import type { DocumentTextResult } from "./objectStorage";

type Document = { id: number; storagePath: string | null; fileName: string };
export async function readProjectDocument(
  documents: Document[],
  documentId: number,
  extract: (path: string, name: string) => Promise<DocumentTextResult>,
): Promise<{ status: 200; name: string; text: string } | { status: 404 | 422; error: string }> {
  const doc = documents.find((item) => item.id === documentId);
  if (!doc?.storagePath) return { status: 404, error: "Document not found in this project" };
  const result = await extract(doc.storagePath, doc.fileName);
  if (result.status !== "success" || !result.text.trim()) {
    return { status: 422, error: "This document could not be read. Try a clearer PDF, JPG, or PNG scan." };
  }
  return { status: 200, name: doc.fileName, text: result.text.slice(0, 30000) + (result.text.length > 30000 ? "\n[Document text truncated]" : "") };
}
