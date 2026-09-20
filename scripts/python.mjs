import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const python = resolve(root, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");

if (!existsSync(python)) {
  console.error(`Project virtual environment not found at ${python}. Run npm run setup:python first.`);
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/python.mjs <python arguments>");
  process.exit(1);
}

const result = spawnSync(python, args, {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, PYTHONIOENCODING: process.env.PYTHONIOENCODING ?? "utf-8" },
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
