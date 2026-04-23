/**
 * Production bundle — `pnpm run build` from this package.
 * Resolves workspace packages via pnpm `node_modules` links.
 */
import * as esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await esbuild.build({
  entryPoints: [path.join(__dirname, "src/index.ts")],
  outfile: path.join(__dirname, "dist/index.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  sourcemap: true,
  logLevel: "info",
  /** Native / WASM drivers — resolve at runtime from node_modules */
  external: ["pg", "@electric-sql/pglite"],
});

console.log("Built dist/index.mjs");
