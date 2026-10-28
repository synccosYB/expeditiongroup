import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
const output = "script/.vendor-credit-ui-check.mjs";
try {
  await build({
    entryPoints: ["script/__tests__/vendor-credits-ui.test.tsx"],
    outfile: output,
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    jsx: "automatic",
    logLevel: "warning",
  });
  const result = spawnSync(process.execPath, [output], { stdio: "inherit" });
  if (result.status !== 0) process.exitCode = result.status || 1;
} finally {
  rmSync(output, { force: true });
}
