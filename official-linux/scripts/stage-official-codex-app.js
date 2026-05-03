#!/usr/bin/env node
"use strict";

const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ELECTRON_VERSION = "41.2.0";
const OFFICIAL_VERSION = "26.429.30905";

const repoRoot = path.resolve(__dirname, "..", "..");
const harnessRoot = path.join(repoRoot, "official-linux");
const officialApp = path.resolve(process.env.CODEX_MAC_APP || path.join(os.homedir(), "Codex.app"));
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
  fs.cpSync(source, destination, { recursive: true, force: true, verbatimSymlinks: true });
}

function replaceOnce(contents, oldSnippet, newSnippet, description) {
  if (!contents.includes(oldSnippet)) {
    fail(`Could not find the expected ${description} in the official bundle.`);
  }
  return contents.replace(oldSnippet, newSnippet);
}

function linuxApplicationMenuBridgeSource() {
  if (process.platform !== "linux" || globalThis.__codexLinuxApplicationMenuBridge) {
    return;
  }
  globalThis.__codexLinuxApplicationMenuBridge = true;

  const labelTranslations = {
    File: "文件",
    Edit: "编辑",
    View: "视图",
    Window: "窗口",
    Help: "帮助",
    Settings: "设置",
    "Settings…": "设置…",
    "About Codex": "关于 Codex",
    "Check for Updates…": "检查更新…",
    "Updates Unavailable": "更新不可用",
    "Automatic updates are unavailable right now.": "自动更新当前不可用。",
    "Log Out": "退出登录",
    "New Chat": "新对话",
    "New chat": "新对话",
    "New Thread": "新对话",
    "New Window": "新窗口",
    "Quick Chat": "快速聊天",
    "Close Window": "关闭窗口",
    "Close Tab or Window": "关闭标签页或窗口",
    "Open Folder": "打开文件夹",
    "Open Folder…": "打开文件夹…",
    "Open Command Menu": "打开命令菜单",
    "Open command menu": "打开命令菜单",
    "Search Files": "搜索文件",
    "Search Files…": "搜索文件…",
    "Search Chats": "搜索对话",
    "Search Chats…": "搜索对话…",
    "Copy Conversation Path": "复制对话路径",
    "Toggle Thread Pin": "固定/取消固定对话",
    "Pin Thread": "固定对话",
    "Unpin Thread": "取消固定对话",
    "Rename Thread": "重命名对话",
    "Archive Thread": "归档对话",
    "Copy Working Directory": "复制工作目录",
    "Copy Session ID": "复制会话 ID",
    "Copy Deeplink": "复制深度链接",
    "Toggle Sidebar": "显示/隐藏侧边栏",
    "Toggle Terminal": "显示/隐藏终端",
    "Toggle File Tree Panel": "显示/隐藏文件树面板",
    "Toggle File Tree": "显示/隐藏文件树",
    "Toggle Browser Panel": "显示/隐藏浏览器面板",
    "Open Browser Tab": "打开浏览器标签页",
    "Reload Browser Page": "重新加载浏览器页面",
    "Hard Reload Browser Page": "强制重新加载浏览器页面",
    "Reload Window": "重新加载窗口",
    "Toggle Diff Panel": "显示/隐藏 Diff 面板",
    "Find in Thread": "在对话中查找",
    Find: "查找",
    "Previous Thread": "上一个对话",
    "Previous Chat": "上一个对话",
    "Next Thread": "下一个对话",
    "Next Chat": "下一个对话",
    "Navigate Back": "后退",
    Back: "后退",
    "Navigate Forward": "前进",
    Forward: "前进",
    "Zoom In": "放大",
    "Zoom Out": "缩小",
    "Actual Size": "实际大小",
    "Toggle Full Screen": "切换全屏",
    "Toggle Debug Menu": "切换调试菜单",
    "Open Deeplink from Clipboard": "从剪贴板打开深度链接",
    "Invalid Deeplink": "无效的深度链接",
    "Clipboard does not contain a valid codex:// deeplink.": "剪贴板中没有有效的 codex:// 深度链接。",
    "Copy a codex:// URL to the clipboard and try again.": "复制一个 codex:// URL 到剪贴板后重试。",
    "Toggle Query Devtools": "切换查询开发者工具",
    "Start Performance Trace": "开始性能跟踪",
    "Codex Documentation": "Codex 文档",
    "What's new": "最新变化",
    Automations: "自动化",
    "Local Environments": "本地环境",
    Worktrees: "工作树",
    Skills: "技能",
    "Model Context Protocol": "模型上下文协议",
    Troubleshooting: "故障排除",
    "Send Feedback": "发送反馈",
    "Keyboard Shortcuts": "键盘快捷键",
    Undo: "撤销",
    Redo: "重做",
    Cut: "剪切",
    Copy: "复制",
    Paste: "粘贴",
    "Paste and Match Style": "粘贴并匹配样式",
    Delete: "删除",
    "Select All": "全选",
    Reload: "重新加载",
    "Force Reload": "强制重新加载",
    "Toggle Developer Tools": "切换开发者工具",
    Reset: "重置",
    Services: "服务",
    Hide: "隐藏",
    "Hide Codex": "隐藏 Codex",
    "Hide Others": "隐藏其他",
    Unhide: "显示全部",
    Quit: "退出",
    "Quit Codex": "退出 Codex",
    Minimize: "最小化",
    Zoom: "缩放",
    Close: "关闭",
    Front: "全部置于顶层",
    "Pin/unpin chat": "固定/取消固定对话",
    "Rename chat": "重命名对话",
    "Archive chat": "归档对话",
    "Copy working directory": "复制工作目录",
    "Copy session id": "复制会话 ID",
    "Copy deeplink": "复制深度链接",
  };
  const roleTranslations = {
    about: "关于 Codex",
    services: "服务",
    hide: "隐藏 Codex",
    hideOthers: "隐藏其他",
    unhide: "显示全部",
    quit: "退出 Codex",
    undo: "撤销",
    redo: "重做",
    cut: "剪切",
    copy: "复制",
    paste: "粘贴",
    pasteAndMatchStyle: "粘贴并匹配样式",
    delete: "删除",
    selectAll: "全选",
    reload: "重新加载",
    forceReload: "强制重新加载",
    toggleDevTools: "切换开发者工具",
    resetZoom: "实际大小",
    zoomIn: "放大",
    zoomOut: "缩小",
    togglefullscreen: "切换全屏",
    minimize: "最小化",
    close: "关闭",
    front: "全部置于顶层",
    window: "窗口",
    help: "帮助",
    editMenu: "编辑",
    windowMenu: "窗口",
    appMenu: "Codex",
  };
  const isChineseLocale = locale => String(locale?.locale ?? locale?.lang ?? "").toLowerCase().startsWith("zh");
  const localizeText = (label, role) => {
    const normalized = label?.replace(/&/g, "");
    const chatMatch = normalized?.match(/^Go to Chat ([1-9])$/);
    if (chatMatch) {
      return `跳转到对话 ${chatMatch[1]}`;
    }
    return (normalized && labelTranslations[normalized]) || (role && roleTranslations[role]) || label;
  };
  const cloneMenuItem = item => {
    if (!item) {
      return item;
    }
    return {
      id: item.id,
      type: item.type,
      label: localizeText(item.label, item.role),
      sublabel: localizeText(item.sublabel),
      toolTip: localizeText(item.toolTip),
      role: item.submenu ? undefined : item.role,
      accelerator: item.accelerator,
      acceleratorWorksWhenHidden: item.acceleratorWorksWhenHidden,
      enabled: item.enabled,
      visible: item.visible,
      checked: item.checked,
      registerAccelerator: item.registerAccelerator,
      icon: item.icon,
      submenu: item.submenu ? item.submenu.items.map(cloneMenuItem) : undefined,
      click:
        typeof item.click === "function"
          ? (_menuItem, browserWindow, event) => item.click(item, browserWindow, event)
          : undefined,
    };
  };
  const localizeMenu = (menu, locale) => {
    if (!isChineseLocale(locale)) {
      return menu;
    }
    return n.Menu.buildFromTemplate(menu.items.map(cloneMenuItem));
  };
  const menuLabels = menu =>
    menu.items.map(item => ({
      label: localizeText(item.label, item.role),
      role: item.role,
      type: item.type,
      submenu: item.submenu ? menuLabels(item.submenu) : null,
    }));

  n.ipcMain.handle("codex_linux:show-application-menu", async (event, options) => {
    const window = n.BrowserWindow.fromWebContents(event.sender);
    const menu = n.Menu.getApplicationMenu();
    if (!menu) {
      return;
    }
    return new Promise(resolve => {
      localizeMenu(menu, options).popup({
        window: window ?? undefined,
        x: Math.round(options?.x ?? 0),
        y: Math.round(options?.y ?? 0),
        callback: resolve,
      });
    });
  });
  n.ipcMain.handle("codex_linux:get-application-menu-labels", async (_event, options) => {
    const menu = n.Menu.getApplicationMenu();
    return menu ? menuLabels(localizeMenu(menu, options)) : [];
  });
  n.ipcMain.handle("codex_linux:close-window", async event => {
    const window = n.BrowserWindow.fromWebContents(event.sender);
    if (window && !window.isDestroyed()) {
      window.close();
    }
  });
}

function patchOfficialAsar(source, destination) {
  const workDir = path.join(distRoot, "asar-work");
  fs.rmSync(workDir, { recursive: true, force: true });
  fs.mkdirSync(workDir, { recursive: true });

  cp.execFileSync(process.execPath, [asarCli, "extract", source, workDir], { stdio: "inherit" });

  const mainBundle = path.join(workDir, ".vite", "build", "main-DlFGMsC6.js");
  ensureFile(mainBundle);
  const oldMainPreamble =
    "const e=require(`./app-session-DB19JxBs.js`),t=require(`./workspace-root-drop-handler-B4gQVO2J.js`);let n=require(`electron`);n=e.gr(n);";
  const linuxApplicationMenuBridge = `(${linuxApplicationMenuBridgeSource.toString()})();`;
  const oldSnippet = "this.installNativeContextMenu(j),!n.app.isPackaged){let e=new URL(wM());";
  const newSnippet =
    "this.installNativeContextMenu(j),!n.app.isPackaged&&!process.env.CODEX_ELECTRON_FORCE_BUNDLED_WEBVIEW){let e=new URL(wM());";
  let contents = fs.readFileSync(mainBundle, "utf8");
  contents = replaceOnce(contents, oldMainPreamble, `${oldMainPreamble}${linuxApplicationMenuBridge}`, "Linux application menu bridge");
  contents = replaceOnce(contents, oldSnippet, newSnippet, "Vite/dev-mode branch");

  const oldMenuBarSnippet = "...process.platform===`win32`?{autoHideMenuBar:!0}:{},";
  const newMenuBarSnippet = "...process.platform===`win32`||process.platform===`linux`?{autoHideMenuBar:!0}:{},";
  contents = replaceOnce(contents, oldMenuBarSnippet, newMenuBarSnippet, "window menu bar options");

  const oldTitleBarOverlaySnippet =
    "n===`win32`?{titleBarStyle:`hidden`,titleBarOverlay:xM()}:{titleBarStyle:`default`};case`secondary`";
  const newTitleBarOverlaySnippet =
    "n===`win32`?{titleBarStyle:`hidden`,titleBarOverlay:xM()}:n===`linux`?{frame:!1,transparent:!0,backgroundColor:`#00000000`,hasShadow:!0}:{titleBarStyle:`default`};case`secondary`";
  contents = replaceOnce(contents, oldTitleBarOverlaySnippet, newTitleBarOverlaySnippet, "Linux frameless titlebar options");

  const oldRemoveMenuSnippet = "let P=this.installWindowsTitleBarOverlaySync(j,l);process.platform===`win32`&&j.removeMenu(),";
  const newRemoveMenuSnippet =
    "let P=this.installWindowsTitleBarOverlaySync(j,l);process.platform===`win32`&&j.removeMenu(),process.platform===`linux`&&j.setMenuBarVisibility?.(!1),";
  contents = replaceOnce(contents, oldRemoveMenuSnippet, newRemoveMenuSnippet, "menu removal hook");
  fs.writeFileSync(mainBundle, contents);

  const preloadBundle = path.join(workDir, ".vite", "build", "preload.js");
  ensureFile(preloadBundle);
  const preloadFooter =
    "e.contextBridge.exposeInMainWorld(`codexWindowType`,f),e.contextBridge.exposeInMainWorld(`electronBridge`,w);\n//# sourceMappingURL=preload.js.map";
  const linuxTitlebarMenuHook = String.raw`
process.platform === 'linux' &&
  process.env.CODEX_LINUX_TITLEBAR_MENU !== '0' &&
  (() => {
    const titlebarId = 'codex-linux-titlebar';
    const menuId = 'codex-linux-titlebar-menu';
    const closeId = 'codex-linux-titlebar-close';
    try {
      e.contextBridge.exposeInMainWorld('codexLinuxMenuBridge', {
        getLabels: (locale) => e.ipcRenderer.invoke('codex_linux:get-application-menu-labels', { locale }),
      });
    } catch {}
    const install = async (attempt = 0) => {
      try {
        if (document.getElementById(titlebarId)) {
          return;
        }
        if (!document.body) {
          if (attempt < 20) {
            setTimeout(() => install(attempt + 1), 250);
          }
          return;
        }

        const style = document.createElement('style');
        style.textContent =
          ":root{--codex-linux-titlebar-height:44px;--codex-linux-window-radius:14px}" +
          "html.codex-linux-rounded-window,html.codex-linux-rounded-window body{width:100%;height:100%;margin:0;background:transparent!important;overflow:hidden}" +
          "body.codex-linux-custom-titlebar{overflow:hidden;border-radius:var(--codex-linux-window-radius);background:transparent!important}" +
          "body.codex-linux-custom-titlebar:after{content:'';position:fixed;inset:0;z-index:2147482999;pointer-events:none;border-radius:var(--codex-linux-window-radius);box-shadow:inset 0 0 0 1px rgba(255,255,255,.10)}" +
          "body.codex-linux-custom-titlebar #root{position:fixed;inset:var(--codex-linux-titlebar-height) 0 0 0;height:auto!important;min-height:0!important;max-height:none!important;margin-top:0!important;overflow:hidden;border-radius:0 0 var(--codex-linux-window-radius) var(--codex-linux-window-radius);background:var(--token-bg-primary,#fff)}" +
          "html.electron-dark body.codex-linux-custom-titlebar #root{background:var(--token-bg-primary,#0d0d0d)}" +
          "html[data-codex-linux-locale='zh-CN'] body.codex-linux-custom-titlebar #root,html[data-codex-linux-locale='zh-CN'] #codex-linux-titlebar{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans CJK SC','Noto Sans SC','Source Han Sans SC','Microsoft YaHei','PingFang SC',sans-serif}" +
          "body.codex-linux-custom-titlebar #root>div{height:100%!important;max-height:100%!important;min-height:0!important}" +
          "body.codex-linux-custom-titlebar #root aside{height:100%!important;max-height:100%!important;min-height:0!important}" +
          "body.codex-linux-custom-titlebar #root aside .mt-auto.px-row-x{position:sticky;bottom:0;z-index:2;background:var(--token-bg-primary,#fff);padding-bottom:.25rem}" +
          "html.electron-dark body.codex-linux-custom-titlebar #root aside .mt-auto.px-row-x{background:var(--token-bg-primary,#0d0d0d)}" +
          "#codex-linux-titlebar{position:fixed;top:0;left:0;right:0;height:var(--codex-linux-titlebar-height);z-index:2147483000;display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:center;background:rgba(49,54,55,.98);border-bottom:1px solid rgba(255,255,255,.08);border-radius:var(--codex-linux-window-radius) var(--codex-linux-window-radius) 0 0;box-shadow:inset 0 1px 0 rgba(255,255,255,.06);color:rgba(245,245,245,.9);-webkit-app-region:drag;user-select:none}" +
          "#codex-linux-titlebar-title{grid-column:2;max-width:min(42vw,520px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:600 13px/18px system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;letter-spacing:0;color:rgba(245,245,245,.92);pointer-events:none}" +
          "#codex-linux-titlebar-actions{grid-column:3;justify-self:end;display:flex;align-items:center;gap:8px;margin-right:10px;pointer-events:none}" +
          "#codex-linux-titlebar button{pointer-events:auto;-webkit-app-region:no-drag;appearance:none;border:0;background:transparent;color:rgba(245,245,245,.86);border-radius:8px;width:32px;height:32px;padding:0;display:grid;place-items:center}" +
          "#codex-linux-titlebar button:hover,#codex-linux-titlebar button[data-open=true]{background:rgba(255,255,255,.12);color:white}" +
          "#codex-linux-titlebar button:active{background:rgba(255,255,255,.18)}" +
          "#codex-linux-titlebar svg{width:18px;height:18px;display:block}" +
          "#codex-linux-titlebar #codex-linux-titlebar-close{width:24px;height:24px;border-radius:999px;background:rgba(255,255,255,.12);color:rgba(255,255,255,.92)}" +
          "#codex-linux-titlebar #codex-linux-titlebar-close:hover{background:rgba(232,84,84,.95);color:white}" +
          "#codex-linux-titlebar #codex-linux-titlebar-close:active{background:rgba(200,61,61,.98)}" +
          "#codex-linux-titlebar #codex-linux-titlebar-close svg{width:13px;height:13px}";
        (document.head || document.documentElement).appendChild(style);

        document.documentElement.classList.add('codex-linux-rounded-window');
        document.body.classList.add('codex-linux-custom-titlebar');
        const normalizeSimplifiedChineseLocale = () => {
          const bodyText = document.body?.innerText || '';
          if (!/(?:新对话|搜索|插件|自动化|项目|对话|设置|暂无聊天)/.test(bodyText)) {
            return;
          }
          document.documentElement.lang = 'zh-CN';
          document.documentElement.dataset.codexLinuxLocale = 'zh-CN';
          for (const node of document.querySelectorAll('button span,button div,button')) {
            for (const child of node.childNodes) {
              if (child.nodeType === 3) {
                child.nodeValue = child.nodeValue.replace(/設置|設定/g, '设置');
              }
            }
            if (node.childElementCount === 0) {
              const text = (node.textContent || '').trim();
              if (text === '設置' || text === '設定') {
                node.textContent = '设置';
              }
            }
          }
        };
        let localeTimer = null;
        const scheduleLocaleNormalization = () => {
          if (localeTimer != null) {
            return;
          }
          localeTimer = setTimeout(() => {
            localeTimer = null;
            normalizeSimplifiedChineseLocale();
          }, 100);
        };
        new MutationObserver(scheduleLocaleNormalization).observe(document.body, {
          childList: true,
          subtree: true,
          characterData: true,
        });
        scheduleLocaleNormalization();

        const titlebar = document.createElement('div');
        titlebar.id = titlebarId;
        titlebar.setAttribute('role', 'banner');
        titlebar.setAttribute('aria-label', 'Window title bar');
        const title = document.createElement('div');
        title.id = 'codex-linux-titlebar-title';
        title.textContent = document.title || 'Codex';
        const titleElement = document.querySelector('title');
        if (titleElement) {
          new MutationObserver(() => {
            title.textContent = document.title || 'Codex';
          }).observe(titleElement, { childList: true });
        }
        const actions = document.createElement('div');
        actions.id = 'codex-linux-titlebar-actions';
        const positionBar = () => {
          document.documentElement.style.setProperty('--codex-linux-titlebar-height', '44px');
        };
        const button = document.createElement('button');
        button.type = 'button';
        button.id = menuId;
        button.title = 'Application menu';
        button.setAttribute('aria-label', 'Application menu');
        button.innerHTML =
          '<svg viewBox="0 0 18 18" aria-hidden="true" focusable="false"><path d="M4 5h10M4 9h10M4 13h10" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
        button.addEventListener('click', async () => {
          const rect = button.getBoundingClientRect();
          button.dataset.open = 'true';
          const locale =
            document.documentElement.dataset.codexLinuxLocale ||
            document.documentElement.lang ||
            navigator.language ||
            '';
          try {
            await e.ipcRenderer.invoke('codex_linux:show-application-menu', {
              x: Math.round(rect.left),
              y: Math.round(rect.bottom + 4),
              locale,
            });
          } finally {
            delete button.dataset.open;
          }
        });
        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.id = closeId;
        closeButton.title = 'Close';
        closeButton.setAttribute('aria-label', 'Close');
        closeButton.innerHTML =
          '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
        closeButton.addEventListener('click', () => {
          e.ipcRenderer.invoke('codex_linux:close-window');
        });
        const localizeTitlebarButtons = () => {
          const isChinese = String(document.documentElement.dataset.codexLinuxLocale || document.documentElement.lang || '').toLowerCase().startsWith('zh');
          button.title = isChinese ? '应用菜单' : 'Application menu';
          button.setAttribute('aria-label', button.title);
          closeButton.title = isChinese ? '关闭' : 'Close';
          closeButton.setAttribute('aria-label', closeButton.title);
        };
        localizeTitlebarButtons();
        new MutationObserver(localizeTitlebarButtons).observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['lang', 'data-codex-linux-locale'],
        });
        actions.appendChild(button);
        actions.appendChild(closeButton);
        titlebar.appendChild(document.createElement('div'));
        titlebar.appendChild(title);
        titlebar.appendChild(actions);
        positionBar();
        document.body.appendChild(titlebar);
      } catch {
        if (attempt < 20) {
          setTimeout(() => install(attempt + 1), 250);
        }
      }
    };

    if (document.readyState === 'loading') {
      window.addEventListener('DOMContentLoaded', () => install(0), { once: true });
    } else {
      install(0);
    }
  })();
`;
  const linuxTitlebarMenu =
    "e.contextBridge.exposeInMainWorld(`codexWindowType`,f),e.contextBridge.exposeInMainWorld(`electronBridge`,w);\n" +
    linuxTitlebarMenuHook +
    "//# sourceMappingURL=preload.js.map";
  const preloadContents = fs.readFileSync(preloadBundle, "utf8");
  fs.writeFileSync(preloadBundle, replaceOnce(preloadContents, preloadFooter, linuxTitlebarMenu, "Linux titlebar menu preload hook"));

  const bootstrapBundle = path.join(workDir, ".vite", "build", "bootstrap.js");
  ensureFile(bootstrapBundle);
  const bootstrapContents = fs.readFileSync(bootstrapBundle, "utf8");
  const bootstrapOldSnippet =
    "await e()}catch(e){for(let e of n.BrowserWindow.getAllWindows())e.isDestroyed()||e.destroy();";
  const bootstrapNewSnippet =
    "await e()}catch(e){console.error(e&&e.stack||e);for(let e of n.BrowserWindow.getAllWindows())e.isDestroyed()||e.destroy();";
  fs.writeFileSync(
    bootstrapBundle,
    replaceOnce(bootstrapContents, bootstrapOldSnippet, bootstrapNewSnippet, "bootstrap error handler"),
  );

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
  const allCandidates = [process.env[`${name.toUpperCase()}_BIN`], fromPath, ...candidates].filter(Boolean);
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
