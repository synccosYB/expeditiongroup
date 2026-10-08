import { build } from "esbuild";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cache = join(root, "node_modules", ".cache");
await mkdir(cache, { recursive: true });
const temp = await mkdtemp(join(cache, "overview-check-"));
try {
  const outfile = join(temp, "test.cjs");
  await build({ entryPoints: [join(root, "script/__tests__/overview-workspace.test.tsx")], outfile,
    bundle: true, platform: "node", format: "cjs", packages: "external", jsx: "automatic",
    alias: { "@": join(root, "client/src"), "@shared": join(root, "shared") },
    loader: { ".svg": "text" }, logLevel: "silent" });
  execFileSync(process.execPath, [outfile], { stdio: "inherit", env: { ...process.env, NODE_ENV: "production" } });
} finally {
  await rm(temp, { recursive: true, force: true });
}
