import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const venv = resolve(root, ".venv");
const python = resolve(venv, process.platform === "win32" ? "Scripts/python.exe" : "bin/python");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, PYTHONIOENCODING: process.env.PYTHONIOENCODING ?? "utf-8" },
    ...options,
  });
  if (result.error) return { ok: false, status: 1, error: result.error };
  return { ok: result.status === 0, status: result.status ?? 1 };
}

function output(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
  });
  return result.status === 0 ? String(result.stdout ?? "").trim() : "";
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!existsSync(python)) {
  let created = false;
  if (output("uv", ["--version"])) {
    created = run("uv", ["venv", "--python", "3.12", venv]).ok;
  }
  const candidates =
    process.platform === "win32"
      ? [["py", ["-3.12", "-m", "venv", venv]], ["python", ["-m", "venv", venv]]]
      : [["python3.12", ["-m", "venv", venv]], ["python3", ["-m", "venv", venv]], ["python", ["-m", "venv", venv]]];
  for (const [command, args] of candidates) {
    if (created) break;
    created = run(command, args).ok;
  }
  if (!created || !existsSync(python)) {
    fail("Could not create a Python 3.12 virtual environment. Install Python 3.12 or uv, then rerun npm run setup:python.");
  }
}

const version = output(python, ["-c", "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"]);
const [major, minor] = version.split(".").map(Number);
if (major !== 3 || minor < 12) {
  fail(`The project virtual environment uses Python ${version || "unknown"}; Python 3.12+ is required.`);
}

const pipCheck = run(python, ["-m", "pip", "--version"]);
if (!pipCheck.ok) {
  const ensurePip = run(python, ["-m", "ensurepip", "--upgrade"]);
  if (!ensurePip.ok) fail("The project Python has no pip and ensurepip failed.");
}

const pinsAlreadyInstalled = output(python, [
  "-c",
  "import importlib.metadata as m; expected={'genlayer-test':'0.30.0rc2','genlayer-py':'0.19.0rc2','genvm-linter':'0.11.1rc2'}; print('ok' if all(m.version(k)==v for k,v in expected.items()) else 'missing')",
]) === "ok";
if (pinsAlreadyInstalled) {
  console.log("Pinned GenLayer packages already installed; skipping the network install.");
} else {
  const install = run(python, ["-m", "pip", "install", "--requirement", "requirements.txt", "--upgrade", "--upgrade-strategy", "only-if-needed"]);
  if (!install.ok) fail("Installing the pinned Python requirements failed.");
}

const verify = run(python, [
  "-c",
  "import importlib.metadata as m; expected={'genlayer-test':'0.30.0rc2','genlayer-py':'0.19.0rc2','genvm-linter':'0.11.1rc2'}; actual={k:m.version(k) for k in expected}; assert actual == expected, (actual, expected); print('Pinned GenLayer Python toolchain:', actual)",
]);
if (!verify.ok) fail("The project virtual environment does not contain the exact pinned GenLayer toolchain.");
