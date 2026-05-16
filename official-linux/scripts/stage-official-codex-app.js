#!/usr/bin/env node
"use strict";

const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ELECTRON_VERSION = "42.0.1";
const OFFICIAL_VERSION = "26.513.31313";

const repoRoot = path.resolve(__dirname, "..", "..");
const harnessRoot = path.join(repoRoot, "official-linux");
const defaultOfficialApp = [
  process.env.CODEX_MAC_APP,
  path.join(os.homedir(), "Downloads", "codex-resrc", "Codex.app"),
  path.join(os.homedir(), "Codex.app"),
].find(candidate => candidate && fs.existsSync(candidate));
const officialApp = path.resolve(defaultOfficialApp || path.join(os.homedir(), "Codex.app"));
const sourceResources = path.join(officialApp, "Contents", "Resources");
const distRoot = path.join(repoRoot, "dist", "nocleanroom-official");
const stagedResources = path.join(distRoot, "resources");
const localNodeModules = path.join(harnessRoot, "node_modules");
const asarCli =
  [
    path.join(localNodeModules, "@electron", "asar", "bin", "asar.mjs"),
    path.join(localNodeModules, "@electron", "asar", "bin", "asar.js"),
  ].find(candidate => fs.existsSync(candidate)) ?? path.join(localNodeModules, "@electron", "asar", "bin", "asar.js");

const requiredFiles = [
  path.join(sourceResources, "app.asar"),
  path.join(sourceResources, "app.asar.unpacked"),
  path.join(sourceResources, "codexTemplate.png"),
  path.join(sourceResources, "codexTemplate@2x.png"),
  path.join(sourceResources, "codex-notification.wav"),
  asarCli,
  path.join(localNodeModules, "better-sqlite3", "build", "Release", "better_sqlite3.node"),
  path.join(localNodeModules, "node-pty", "build", "Release", "pty.node"),
  path.join(localNodeModules, "node-pty", "build", "Release", "spawn-helper"),
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function ensureFile(filePath, hint) {
  if (!fs.existsSync(filePath)) {
    fail(`${filePath} is missing.${hint ? ` ${hint}` : ""}`);
  }
}

function ensureExecutable(filePath) {
  ensureFile(filePath);
  fs.chmodSync(filePath, 0o755);
}

function copyFile(source, destination, mode) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  if (mode != null) {
    fs.chmodSync(destination, mode);
  }
}

function copyDirectory(source, destination) {
  fs.cpSync(source, destination, {
    recursive: true,
    force: true,
    verbatimSymlinks: true,
    filter: src => {
      const baseName = path.basename(src);
      return baseName !== ".DS_Store" && !baseName.includes(":com.apple.");
    },
  });
}

function replaceRegexOnce(contents, pattern, replacement, description) {
  if (!pattern.test(contents)) {
    fail(`Could not find the expected ${description} in the official bundle.`);
  }
  return contents.replace(pattern, replacement);
}

function patchOfficialAsar(source, destination) {
  const workDir = path.join(distRoot, "asar-work");
  fs.rmSync(workDir, { recursive: true, force: true });
  fs.mkdirSync(workDir, { recursive: true });

  cp.execFileSync(process.execPath, [asarCli, "extract", source, workDir], { stdio: "inherit" });

  const buildDir = path.join(workDir, ".vite", "build");
  const mainBundleName = fs.readdirSync(buildDir).find(name => /^main-.*\.js$/.test(name));
  if (!mainBundleName) {
    fail("Could not find the expected main bundle in the official asar.");
  }
  const mainBundle = path.join(buildDir, mainBundleName);
  ensureFile(mainBundle);
  let contents = fs.readFileSync(mainBundle, "utf8");
  contents = replaceRegexOnce(
    contents,
    /this\.installNativeContextMenu\(([^)]+)\),!n\.app\.isPackaged\)\{/,
    "this.installNativeContextMenu($1),!n.app.isPackaged&&!process.env.CODEX_ELECTRON_FORCE_BUNDLED_WEBVIEW){",
    "Vite/dev-mode branch",
  );
  fs.writeFileSync(mainBundle, contents);

  const preloadBundle = path.join(workDir, ".vite", "build", "preload.js");
  ensureFile(preloadBundle);

  copyNativeModuleInto(workDir, "better-sqlite3", "better_sqlite3.node");
  copyNativeModuleInto(workDir, "node-pty", "pty.node");
  copyNativeModuleInto(workDir, "node-pty", "spawn-helper");
  pruneForeignBinaries(workDir);

  cp.execFileSync(process.execPath, [asarCli, "pack", workDir, destination], { stdio: "inherit" });
  fs.rmSync(workDir, { recursive: true, force: true });
}

function commandOutput(command, args) {
  try {
    return cp.execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function findExecutable(name, candidates) {
  const fromPath = commandOutput("bash", ["-lc", `command -v ${name} || true`]);
  const allCandidates = [process.env[`${name.toUpperCase()}_BIN`], ...candidates, fromPath].filter(Boolean);
  for (const candidate of allCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  fail(`Could not find a Linux ${name} executable. Install it or set ${name.toUpperCase()}_BIN.`);
}

function findCodexBinary() {
  const envPath = process.env.CODEX_LINUX_CLI_PATH;
  if (envPath && fs.existsSync(envPath)) {
    return path.resolve(envPath);
  }

  const vscodeExtensions = path.join(os.homedir(), ".vscode", "extensions");
  if (fs.existsSync(vscodeExtensions)) {
    const extensionCodexBinaries = fs
      .readdirSync(vscodeExtensions)
      .filter(name => /^openai\.chatgpt-.*-linux-x64$/.test(name))
      .sort()
      .reverse()
      .map(name => path.join(vscodeExtensions, name, "bin", "linux-x86_64", "codex"));
    for (const candidate of extensionCodexBinaries) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }

  const releaseBinary = path.join(repoRoot, "codex-rs", "target", "release", "codex");
  if (fs.existsSync(releaseBinary)) {
    return releaseBinary;
  }

  const pathBinary = commandOutput("bash", ["-lc", "command -v codex || true"]);
  if (pathBinary && fs.existsSync(pathBinary)) {
    return pathBinary;
  }

  fail(
    "Could not find a Linux codex binary. Run `cargo build --release -p codex-cli` from codex-rs, " +
      "or set CODEX_LINUX_CLI_PATH.",
  );
}

function copyNativeModule(packageName, fileName) {
  const destination = path.join(stagedResources, "app.asar.unpacked", "node_modules", packageName, "build", "Release", fileName);
  copyNativeModuleFile(destination, packageName, fileName);
}

function copyNativeModuleInto(root, packageName, fileName) {
  const destination = path.join(root, "node_modules", packageName, "build", "Release", fileName);
  copyNativeModuleFile(destination, packageName, fileName);
}

function copyNativeModuleFile(destination, packageName, fileName) {
  const source = path.join(localNodeModules, packageName, "build", "Release", fileName);
  copyFile(source, destination, fileName === "spawn-helper" ? 0o755 : undefined);
}

function removeMacOnlyFiles() {
  for (const relativePath of [
    "native",
    "app.asar.unpacked/node_modules/better-sqlite3/build/Release/obj.target",
    "app.asar.unpacked/node_modules/node-pty/build/Release/obj.target",
  ]) {
    fs.rmSync(path.join(stagedResources, relativePath), { recursive: true, force: true });
  }
}

function walkFiles(root) {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function pruneForeignBinaries(root) {
  for (const filePath of walkFiles(root)) {
    let description = "";
    try {
      description = cp.execFileSync("file", ["-b", filePath], { encoding: "utf8" });
    } catch {
      continue;
    }
    if (description.includes("Mach-O") || description.includes("PE32")) {
      fs.rmSync(filePath, { force: true });
    }
  }
}

function writeNodeReplWrapper() {
  const wrapperPath = path.join(stagedResources, "node_repl");
  fs.writeFileSync(
    wrapperPath,
    "#!/bin/sh\n" +
      "set -eu\n" +
      'exec "$(dirname "$0")/node" "$@"\n',
  );
  fs.chmodSync(wrapperPath, 0o755);
}

for (const requiredFile of requiredFiles) {
  ensureFile(requiredFile, "Run `npm --prefix official-linux install && npm --prefix official-linux run rebuild-native` first.");
}

const codexBinary = findCodexBinary();
const rgBinary = findExecutable("rg", [
  "/usr/bin/rg",
  "/usr/local/bin/rg",
  path.join(os.homedir(), ".vscode", "extensions", "openai.chatgpt-26.5429.30905-linux-x64", "bin", "linux-x86_64", "rg"),
]);
const nodeBinary = findExecutable("node", [process.execPath, "/usr/bin/node"]);

fs.rmSync(distRoot, { recursive: true, force: true });
fs.mkdirSync(stagedResources, { recursive: true });

patchOfficialAsar(path.join(sourceResources, "app.asar"), path.join(stagedResources, "app.asar"));
copyDirectory(path.join(sourceResources, "app.asar.unpacked"), path.join(stagedResources, "app.asar.unpacked"));

for (const name of [
  "Assets.car",
  "THIRD_PARTY_NOTICES.txt",
  "codex-notification.wav",
  "codexTemplate.png",
  "codexTemplate@2x.png",
  "electron.icns",
]) {
  const source = path.join(sourceResources, name);
  if (fs.existsSync(source)) {
    copyFile(source, path.join(stagedResources, name));
  }
}

const pluginsSource = path.join(sourceResources, "plugins");
if (fs.existsSync(pluginsSource)) {
  copyDirectory(pluginsSource, path.join(stagedResources, "plugins"));
}

removeMacOnlyFiles();
copyNativeModule("better-sqlite3", "better_sqlite3.node");
copyNativeModule("node-pty", "pty.node");
copyNativeModule("node-pty", "spawn-helper");
pruneForeignBinaries(stagedResources);

copyFile(codexBinary, path.join(stagedResources, "codex"), 0o755);
copyFile(rgBinary, path.join(stagedResources, "rg"), 0o755);
copyFile(nodeBinary, path.join(stagedResources, "node"), 0o755);
writeNodeReplWrapper();

ensureExecutable(path.join(stagedResources, "codex"));
ensureExecutable(path.join(stagedResources, "rg"));
ensureExecutable(path.join(stagedResources, "node"));

fs.writeFileSync(
  path.join(distRoot, "metadata.json"),
  JSON.stringify(
    {
      electronVersion: ELECTRON_VERSION,
      officialVersion: OFFICIAL_VERSION,
      sourceApp: officialApp,
      codexBinary,
      rgBinary,
      nodeBinary,
      stagedResources,
      forceBundledWebview: true,
    },
    null,
    2,
  ) + "\n",
);

console.log(`Staged official Codex resources in ${stagedResources}`);
