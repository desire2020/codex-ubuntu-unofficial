#!/usr/bin/env node
"use strict";

const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ELECTRON_VERSION = "42.0.1";
const OFFICIAL_VERSION = "26.513.31313";
const LINUX_APPLICATION_MENU_ID = "__codex-linux-application-menu";
const LINUX_CLOSE_WINDOW_ID = "__codex-linux-close-window";

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

function linuxWebviewChromeFallbackCss() {
  return String.raw`
/* Linux Electron does not provide macOS window material behind these transparent surfaces. */
:root[data-codex-window-type="electron"][data-codex-os="linux"] {
  --font-sans-default: "Ubuntu Sans", "Ubuntu", "Noto Sans CJK SC", "Noto Sans SC", "Noto Sans", "DejaVu Sans", sans-serif;
}

:root[data-codex-window-type="electron"][data-codex-os="linux"] {
  background: transparent !important;
}

:root[data-codex-window-type="electron"][data-codex-os="linux"] body {
  background: transparent !important;
  overflow: hidden;
}

:root[data-codex-window-type="electron"][data-codex-os="linux"] #root {
  min-block-size: 100vh;
  background: var(--color-background-surface-under) !important;
  border-radius: var(--radius-2xl);
  clip-path: inset(0 round var(--radius-2xl));
  overflow: hidden;
}

:root[data-codex-window-type="electron"][data-codex-os="linux"] .window-fx-sidebar-surface {
  background: var(--color-background-surface-under) !important;
}

:root[data-codex-window-type="electron"][data-codex-os="linux"] header.app-header-tint {
  box-sizing: border-box;
  padding-inline-end: 64px;
}

:root[data-codex-window-type="electron"][data-codex-os="linux"] #codex-linux-close-button {
  position: fixed;
  inset-block-start: 9px;
  inset-inline-end: 8px;
  z-index: 2147483000;
}

:root[data-codex-window-type="electron"][data-codex-os="linux"] #codex-linux-app-menu-button,
:root[data-codex-window-type="electron"][data-codex-os="linux"] #codex-linux-close-button {
  inline-size: 28px;
  block-size: 28px;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  color: var(--color-token-icon-foreground);
  background: var(--color-background-button-tertiary);
  font: inherit;
  pointer-events: auto;
  -webkit-app-region: no-drag;
}

:root[data-codex-window-type="electron"][data-codex-os="linux"] #codex-linux-app-menu-button:hover,
:root[data-codex-window-type="electron"][data-codex-os="linux"] #codex-linux-close-button:hover {
  background: var(--color-token-list-hover-background);
}

:root[data-codex-window-type="electron"][data-codex-os="linux"] #codex-linux-app-menu-button:active,
:root[data-codex-window-type="electron"][data-codex-os="linux"] #codex-linux-close-button:active {
  background: var(--color-token-list-selected-background);
}

:root[data-codex-window-type="electron"][data-codex-os="linux"] #codex-linux-close-button:hover {
  color: #fff;
  background: #c42b1c;
  border-color: #c42b1c;
}

:root[data-codex-window-type="electron"][data-codex-os="linux"] #codex-linux-app-menu-button svg,
:root[data-codex-window-type="electron"][data-codex-os="linux"] #codex-linux-close-button svg {
  inline-size: 17px;
  block-size: 17px;
  display: block;
}
`;
}

function linuxWebviewChromeScript() {
  return `
(() => {
  const menuId = ${JSON.stringify(LINUX_APPLICATION_MENU_ID)};
  const closeWindowId = ${JSON.stringify(LINUX_CLOSE_WINDOW_ID)};
  const buttonId = "codex-linux-app-menu-button";
  const closeButtonId = "codex-linux-close-button";
  let observer = null;

  const shouldInstall = () =>
    document.documentElement?.dataset?.codexWindowType === "electron" &&
    document.documentElement?.dataset?.codexOs === "linux" &&
    window.electronBridge?.showApplicationMenu;

  const menuLabel = () => {
    const lang = (document.documentElement.lang || navigator.language || "").toLowerCase();
    return lang.startsWith("zh") ? "应用菜单" : "Application menu";
  };

  const closeLabel = () => {
    const lang = (document.documentElement.lang || navigator.language || "").toLowerCase();
    return lang.startsWith("zh") ? "关闭" : "Close";
  };

  const buttonRect = button => {
    const rect = button.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 ? rect : null;
  };

  const findHeaderActions = () => {
    const header = document.querySelector("header.app-header-tint");
    if (!header) {
      return null;
    }

    const headerRect = header.getBoundingClientRect();
    const headerButtons = [...header.querySelectorAll("button")].filter(button => {
      const rect = buttonRect(button);
      return rect && rect.top >= headerRect.top - 1 && rect.bottom <= headerRect.bottom + 1;
    });

    const terminalButton = headerButtons.find(button => {
      const label = (button.getAttribute("aria-label") || "").toLowerCase();
      return label.includes("terminal") || label.includes("终端");
    });
    if (terminalButton?.parentElement) {
      return { container: terminalButton.parentElement, before: terminalButton };
    }

    const groups = [...header.querySelectorAll("div")].map(element => {
      const rect = element.getBoundingClientRect();
      return { element, rect, style: getComputedStyle(element) };
    }).filter(({ rect, style }) =>
      rect.width > 0 &&
      rect.height > 0 &&
      rect.top >= headerRect.top - 1 &&
      rect.bottom <= headerRect.bottom + 1 &&
      rect.right > window.innerWidth - 240 &&
      style.display.includes("flex")
    ).sort((a, b) => b.rect.right - a.rect.right || a.rect.width - b.rect.width);

    return groups[0] ? { container: groups[0].element, before: null } : null;
  };

  const createButton = () => {
    const button = document.createElement("button");
    button.id = buttonId;
    button.type = "button";
    button.setAttribute("aria-label", menuLabel());
    button.title = menuLabel();
    button.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path fill="currentColor" d="M4 6.5a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H4.75A.75.75 0 0 1 4 6.5Zm0 3.5a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H4.75A.75.75 0 0 1 4 10Zm.75 2.75a.75.75 0 0 0 0 1.5h10.5a.75.75 0 0 0 0-1.5H4.75Z"/></svg>';
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      const rect = button.getBoundingClientRect();
      window.electronBridge.showApplicationMenu(menuId, rect.left, rect.bottom + 4).catch(() => {});
    });
    return button;
  };

  const createCloseButton = () => {
    const button = document.createElement("button");
    button.id = closeButtonId;
    button.type = "button";
    button.setAttribute("aria-label", closeLabel());
    button.title = closeLabel();
    button.innerHTML = '<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path fill="currentColor" d="M5.72 5.72a.75.75 0 0 1 1.06 0L10 8.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L11.06 10l3.22 3.22a.75.75 0 1 1-1.06 1.06L10 11.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L8.94 10 5.72 6.78a.75.75 0 0 1 0-1.06Z"/></svg>';
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      window.electronBridge.showApplicationMenu(closeWindowId, 0, 0).catch(() => {});
    });

    return button;
  };

  const installCloseButton = () => {
    if (!document.body) {
      return;
    }

    const button = document.getElementById(closeButtonId) || createCloseButton();
    if (button.parentElement !== document.body) {
      document.body.append(button);
    }
  };

  const install = () => {
    if (!shouldInstall() || !document.body) {
      return;
    }

    const target = findHeaderActions();
    if (target) {
      const button = document.getElementById(buttonId) || createButton();
      if (button.parentElement !== target.container || button.nextElementSibling !== target.before) {
        target.container.insertBefore(button, target.before);
      }
    }

    installCloseButton();
  };

  const startObserver = () => {
    if (observer || !document.body) {
      return;
    }
    observer = new MutationObserver(install);
    observer.observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startObserver, { once: true });
  } else {
    startObserver();
  }

  new MutationObserver(install).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-codex-os", "data-codex-window-type"],
  });
  setTimeout(install, 50);
  setTimeout(install, 250);
})();
`;
}

function patchWebviewCss(root) {
  const assetsDir = path.join(root, "webview", "assets");
  const cssBundleName = fs
    .readdirSync(assetsDir)
    .find(name => /^app-main-.*\.css$/.test(name));
  if (!cssBundleName) {
    fail("Could not find the expected app-main CSS bundle in the official asar.");
  }

  const cssBundle = path.join(assetsDir, cssBundleName);
  ensureFile(cssBundle);
  let contents = fs.readFileSync(cssBundle, "utf8");
  if (!contents.includes("Linux Electron does not provide macOS window material")) {
    contents += `\n${linuxWebviewChromeFallbackCss()}\n`;
    fs.writeFileSync(cssBundle, contents);
  }
}

function patchWebviewIndex(root) {
  const indexPath = path.join(root, "webview", "index.html");
  const chromeScriptPath = path.join(root, "webview", "codex-linux-chrome.js");
  ensureFile(indexPath);
  fs.writeFileSync(chromeScriptPath, linuxWebviewChromeScript());

  let contents = fs.readFileSync(indexPath, "utf8");
  if (contents.includes("codex-linux-chrome.js")) {
    return;
  }

  contents = replaceRegexOnce(
    contents,
    /<\/head>/,
    `  <script defer src="./codex-linux-chrome.js"></script>\n</head>`,
    "webview head close tag",
  );
  fs.writeFileSync(indexPath, contents);
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
  contents = replaceRegexOnce(
    contents,
    /\.\.\.process\.platform===`win32`\?\{autoHideMenuBar:!0\}:\{\},/,
    "...process.platform===`linux`?{autoHideMenuBar:!0,frame:!1,transparent:!0,backgroundColor:`#00000000`}:process.platform===`win32`?{autoHideMenuBar:!0}:{},",
    "Linux menu bar auto-hide option",
  );
  contents = replaceRegexOnce(
    contents,
    /process\.platform===`win32`&&M\.removeMenu\(\),/,
    "process.platform===`win32`&&M.removeMenu(),process.platform===`linux`&&M.setMenuBarVisibility(!1),",
    "Linux menu bar visibility call",
  );
  contents = replaceRegexOnce(
    contents,
    /let i=n\.BrowserWindow\.fromWebContents\(t\.sender\),a=n\.Menu\.getApplicationMenu\(\)\?\.getMenuItemById\(r\.menuId\)\?\.submenu;if\(a\)return new Promise\(e=>\{a\.popup\(\{window:i\?\?void 0,x:Math\.round\(r\.x\),y:Math\.round\(r\.y\),callback:e\}\)\}\)/,
    `let i=n.BrowserWindow.fromWebContents(t.sender),s=n.Menu.getApplicationMenu();if(r.menuId===\`${LINUX_CLOSE_WINDOW_ID}\`&&process.platform===\`linux\`){i?.hide();return}let a=r.menuId===\`${LINUX_APPLICATION_MENU_ID}\`&&process.platform===\`linux\`?n.Menu.buildFromTemplate((s?.items??[]).filter(e=>e.visible!==!1&&e.submenu).map(e=>({label:e.label,enabled:e.enabled,submenu:e.submenu}))):s?.getMenuItemById(r.menuId)?.submenu;if(a)return new Promise(e=>{a.popup({window:i??void 0,x:Math.round(r.x),y:Math.round(r.y),callback:e})})`,
    "Linux application menu popup bridge",
  );
  fs.writeFileSync(mainBundle, contents);

  const preloadBundle = path.join(workDir, ".vite", "build", "preload.js");
  ensureFile(preloadBundle);
  patchWebviewCss(workDir);
  patchWebviewIndex(workDir);

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
