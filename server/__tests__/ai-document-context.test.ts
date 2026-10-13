import { test } from "node:test";
import assert from "node:assert/strict";
import { readProjectDocument } from "../ai-document-context";
const docs = [{ id: 1, storagePath: "/objects/a", fileName: "scan.pdf" }];
test("passes selected document contents and filename to the answer context", async () => {
  const result = await readProjectDocument(docs, 1, async (path, name) => {
    assert.equal(path, "/objects/a"); assert.equal(name, "scan.pdf");
    return { status: "success", text: "Permit 123", length: 10 };
  });
  assert.deepEqual(result, { status: 200, name: "scan.pdf", text: "Permit 123" });
});
test("rejects a document outside the project before extraction", async () => {
  const result = await readProjectDocument(docs, 2, async () => { throw new Error("must not run"); });
  assert.equal(result.status, 404);
});
test("rejects documents without a storage path", async () => {
  const result = await readProjectDocument([{...docs[0], storagePath: null}], 1, async () => { throw new Error("must not run"); });
  assert.equal(result.status, 404);
});
test("reports empty and failed extraction instead of inventing document access", async () => {
  for (const extraction of [{ status: "empty" }, { status: "error", error: "unavailable" }] as const) {
    assert.equal((await readProjectDocument(docs, 1, async () => extraction)).status, 422);
  }
});
test("marks truncated document text", async () => {
  const result = await readProjectDocument(docs, 1, async () => ({ status: "success", text: "x".repeat(30001), length: 30001 }));
  assert.equal(result.status, 200);
  if (result.status === 200) assert.equal(result.text, "x".repeat(30000) + "\n[Document text truncated]");
});
