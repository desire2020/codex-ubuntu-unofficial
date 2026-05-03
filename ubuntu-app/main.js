const { app, BrowserWindow, clipboard, dialog, ipcMain, shell } = require("electron");
const { spawn, execFile } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const readline = require("node:readline");

const APP_VERSION = "0.2.0";
const CLIENT_INFO = {
  name: "codex_ubuntu_desktop",
  title: "Codex Ubuntu Desktop",
  version: APP_VERSION,
};
const UI_CONFIG_DEFAULTS = {
  reviewOpen: false,
  selectedModel: "",
  selectedEffort: "",
  permissionMode: "full-access",
  language: "auto",
  requireCtrlEnterForLongPrompts: false,
  speed: "standard",
  followUpBehavior: "queue",
  codeReviewMode: "inline",
  personality: "pragmatic",
  customInstructions: "",
  memoriesEnabled: false,
  skipToolAssistedMemories: false,
  recentProjects: [],
  pinnedThreadIds: [],
  pinnedProjectPaths: [],
};
const MAX_RECENT_PROJECTS = 24;

let mainWindow = null;
let codexClient = null;
let workspaceIsFallback = false;

function repoRoot() {
  return path.resolve(__dirname, "..");
}

function isPackagedInstall() {
  return __dirname.startsWith("/opt/codex-desktop-ubuntu/");
}

function resolveCodexBinary() {
  const candidates = [
    process.env.CODEX_BIN,
    isPackagedInstall() ? "/opt/codex-desktop-ubuntu/bin/codex" : null,
    path.join(repoRoot(), "codex-rs", "target", "release", "codex"),
    path.join(repoRoot(), "codex-rs", "target", "debug", "codex"),
    "/usr/local/bin/codex",
    "/usr/bin/codex",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (isExecutable(candidate)) {
      return candidate;
    }
  }

  return "codex";
}

function isExecutable(candidate) {
  try {
    fs.accessSync(candidate, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function bundledLibraryPath() {
  const candidates = [
    "/opt/codex-desktop-ubuntu/lib",
    path.join(repoRoot(), "dist", "deb-root", "opt", "codex-desktop-ubuntu", "lib"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function serviceTierForSpeed(speed) {
  return speed === "fast" ? "fast" : null;
}

function reasoningSummaryForUi(value) {
  return ["auto", "concise", "detailed", "none"].includes(value) ? value : "auto";
}

function approvalPolicyForPermissionMode(permissionMode) {
  return permissionMode === "full-access" ? "never" : "on-request";
}

function permissionSelectionForMode(permissionMode) {
  const id =
    {
      "read-only": ":read-only",
      workspace: ":workspace",
      "full-access": ":danger-no-sandbox",
    }[permissionMode] || ":danger-no-sandbox";
  return { type: "profile", id };
}

function personalityForUi(value) {
  return ["friendly", "pragmatic", "none"].includes(value) ? value : "pragmatic";
}

function customInstructionsForUi(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function uiThreadSettings() {
  const config = readUiConfig();
  return {
    personality: personalityForUi(config.personality),
    developerInstructions: customInstructionsForUi(config.customInstructions),
  };
}

function collaborationModeForTurnOptions(options = {}) {
  const developerInstructions = customInstructionsForUi(options.customInstructions);
  if (!developerInstructions || !options.model) {
    return null;
  }
  return {
    mode: "default",
    settings: {
      model: options.model,
      reasoning_effort: options.effort || null,
      developer_instructions: developerInstructions,
    },
  };
}

function resolveWorkspace(argv) {
  return resolveWorkspaceInfo(argv).workspace;
}

function resolveWorkspaceInfo(argv) {
  const appDir = path.resolve(__dirname);
  const args = argv.slice(1).filter((arg) => !arg.startsWith("--"));
  const candidate = args.find((arg) => {
    if (!arg || arg === ".") {
      return false;
    }
    return path.resolve(arg) !== appDir;
  });
  if (candidate) {
    return { workspace: path.resolve(candidate), remember: true, fallback: false };
  }

  const cwd = path.resolve(process.cwd());
  if (!isAmbientWorkspacePath(cwd)) {
    return { workspace: cwd, remember: true, fallback: false };
  }

  const recent = readUiConfig().recentProjects.find((project) => fs.existsSync(project.path));
  if (recent) {
    return { workspace: recent.path, remember: false, fallback: false };
  }

  const workspace = path.join(app.getPath("userData"), "neutral-workspace");
  fs.mkdirSync(workspace, { recursive: true });
  return { workspace, remember: false, fallback: true };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1620,
    height: 980,
    minWidth: 1080,
    minHeight: 720,
    frame: false,
    title: "Codex",
    transparent: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
}

function uiConfigPath() {
  return path.join(app.getPath("userData"), "ui-config.json");
}

function userConfigTomlPath() {
  return path.join(os.homedir(), ".codex", "config.toml");
}

async function openUserConfigToml() {
  const file = userConfigTomlPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, "");
  }
  const error = await shell.openPath(file);
  if (error) {
    throw new Error(error);
  }
  return file;
}

async function openLicenseNotices() {
  const candidates = [
    "/usr/share/doc/codex-desktop-ubuntu/copyright",
    path.join(repoRoot(), "NOTICE"),
    path.join(repoRoot(), "LICENSE"),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      const error = await shell.openPath(file);
      if (!error) {
        return file;
      }
    }
  }
  await shell.openExternal("https://github.com/openai/codex");
  return null;
}

function normalizeProjectPath(workspace) {
  if (!workspace) {
    return null;
  }
  return path.resolve(String(workspace));
}

function isAmbientWorkspacePath(workspace) {
  const projectPath = normalizeProjectPath(workspace);
  if (!projectPath) {
    return true;
  }
  return (
    projectPath === path.resolve(os.homedir()) ||
    projectPath === path.parse(projectPath).root ||
    projectPath === path.resolve(__dirname)
  );
}

function normalizeRecentProjects(projects = []) {
  if (!Array.isArray(projects)) {
    return [];
  }

  const seen = new Set();
  const normalized = [];
  for (const entry of projects) {
    const rawPath = typeof entry === "string" ? entry : entry?.path;
    const projectPath = normalizeProjectPath(rawPath);
    if (!projectPath || seen.has(projectPath) || isAmbientWorkspacePath(projectPath)) {
      continue;
    }
    seen.add(projectPath);
    normalized.push({
      path: projectPath,
      name: typeof entry === "object" && entry?.name ? String(entry.name) : path.basename(projectPath),
      lastOpenedAt: typeof entry === "object" && Number.isFinite(entry.lastOpenedAt) ? entry.lastOpenedAt : 0,
    });
  }
  return normalized.slice(0, MAX_RECENT_PROJECTS);
}

function normalizeStringArray(values = []) {
  if (!Array.isArray(values)) {
    return [];
  }
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim()))];
}

function normalizePinnedProjectPaths(values = []) {
  return normalizeStringArray(values)
    .map(normalizeProjectPath)
    .filter((projectPath) => projectPath && !isAmbientWorkspacePath(projectPath));
}

function normalizeUiConfig(value = {}) {
  const merged = {
    ...UI_CONFIG_DEFAULTS,
    ...Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)),
  };
  return {
    ...merged,
    recentProjects: normalizeRecentProjects(merged.recentProjects),
    pinnedThreadIds: normalizeStringArray(merged.pinnedThreadIds),
    pinnedProjectPaths: normalizePinnedProjectPaths(merged.pinnedProjectPaths),
  };
}

function readUiConfig() {
  try {
    return normalizeUiConfig(JSON.parse(fs.readFileSync(uiConfigPath(), "utf8")));
  } catch {
    return normalizeUiConfig();
  }
}

function writeUiConfig(patch = {}) {
  const next = normalizeUiConfig({ ...readUiConfig(), ...patch });
  fs.mkdirSync(path.dirname(uiConfigPath()), { recursive: true });
  fs.writeFileSync(uiConfigPath(), `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

function rememberProject(workspace) {
  const projectPath = normalizeProjectPath(workspace);
  if (!projectPath || isAmbientWorkspacePath(projectPath)) {
    return readUiConfig();
  }
  const current = readUiConfig();
  const recentProjects = [
    {
      path: projectPath,
      name: path.basename(projectPath),
      lastOpenedAt: Math.floor(Date.now() / 1000),
    },
    ...current.recentProjects.filter((project) => project.path !== projectPath),
  ].slice(0, MAX_RECENT_PROJECTS);
  return writeUiConfig({ recentProjects });
}

function sendToRenderer(channel, payload) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send(channel, payload);
}

function numericTokenValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function tokenBreakdownForUi(value = {}) {
  return {
    totalTokens: numericTokenValue(value.totalTokens ?? value.total_tokens),
    inputTokens: numericTokenValue(value.inputTokens ?? value.input_tokens),
    cachedInputTokens: numericTokenValue(value.cachedInputTokens ?? value.cached_input_tokens),
    outputTokens: numericTokenValue(value.outputTokens ?? value.output_tokens),
    reasoningOutputTokens: numericTokenValue(value.reasoningOutputTokens ?? value.reasoning_output_tokens),
  };
}

function tokenUsageForUi(value) {
  if (!value) {
    return null;
  }
  const total = value.total || value.total_token_usage;
  const last = value.last || value.last_token_usage;
  if (!total || !last) {
    return null;
  }
  const contextWindow = numericTokenValue(value.modelContextWindow ?? value.model_context_window);
  return {
    total: tokenBreakdownForUi(total),
    last: tokenBreakdownForUi(last),
    modelContextWindow: contextWindow > 0 ? contextWindow : null,
  };
}

async function latestTokenUsageFromRollout(rolloutPath) {
  if (!rolloutPath || !fs.existsSync(rolloutPath)) {
    return null;
  }

  let latest = null;
  const stream = fs.createReadStream(rolloutPath, { encoding: "utf8" });
  const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of lines) {
      if (!line.trim()) {
        continue;
      }
      let item;
      try {
        item = JSON.parse(line);
      } catch {
        continue;
      }
      const payload = item?.type === "event_msg" ? item.payload : item?.payload;
      if (payload?.type !== "token_count" || !payload.info) {
        continue;
      }
      const usage = tokenUsageForUi(payload.info);
      if (usage) {
        latest = usage;
      }
    }
  } finally {
    lines.close();
    stream.destroy();
  }

  return latest;
}

class CodexAppServerClient {
  constructor({ codexBin, workspace }) {
    this.codexBin = codexBin;
    this.workspace = workspace;
    this.child = null;
    this.nextRequestId = 1;
    this.pending = new Map();
    this.currentThread = null;
    this.initialized = false;
    this.pendingServerRequests = new Map();
    this.accountState = null;
    this.threadTokenUsageById = {};
  }

  async start() {
    if (this.child) {
      return;
    }

    const env = { ...process.env };
    const libPath = bundledLibraryPath();
    if (libPath) {
      env.LD_LIBRARY_PATH = `${libPath}${env.LD_LIBRARY_PATH ? `:${env.LD_LIBRARY_PATH}` : ""}`;
    }

    this.child = spawn(this.codexBin, ["app-server", "--listen", "stdio://"], {
      cwd: this.workspace,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.child.once("exit", (code, signal) => {
      this.child = null;
      for (const pending of this.pending.values()) {
        pending.reject(new Error(`Codex app-server exited with ${signal || code}`));
      }
      this.pending.clear();
      sendToRenderer("codex:server-status", {
        status: "stopped",
        detail: `Codex app-server exited with ${signal || code}`,
      });
    });

    this.child.stderr.on("data", (chunk) => {
      sendToRenderer("codex:server-log", chunk.toString());
    });

    readline
      .createInterface({ input: this.child.stdout })
      .on("line", (line) => this.handleLine(line));

    await this.initialize();
    this.initialized = true;
  }

  stop() {
    if (this.child) {
      this.child.kill();
    }
  }

  async initialize() {
    await this.request("initialize", {
      clientInfo: CLIENT_INFO,
      capabilities: {
        experimentalApi: true,
      },
    });
    await this.applyRuntimeUiConfig().catch((error) => {
      sendToRenderer("codex:server-log", `Failed to apply UI runtime settings: ${error.message}`);
    });
    this.notify("initialized");
  }

  write(message) {
    if (!this.child || !this.child.stdin.writable) {
      throw new Error("Codex app-server is not running");
    }
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  notify(method, params) {
    const message = { method };
    if (params !== undefined) {
      message.params = params;
    }
    this.write(message);
  }

  request(method, params) {
    const id = String(this.nextRequestId++);
    const message = { id, method };
    if (params !== undefined) {
      message.params = params;
    }

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      try {
        this.write(message);
      } catch (error) {
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  handleLine(rawLine) {
    const line = rawLine.trim();
    if (!line) {
      return;
    }

    let message;
    try {
      message = JSON.parse(line);
    } catch (error) {
      sendToRenderer("codex:server-log", `Invalid app-server JSON: ${error.message}\n${line}`);
      return;
    }

    if (message.id !== undefined && message.method) {
      this.handleServerRequest(message);
      return;
    }

    if (message.id !== undefined) {
      const pending = this.pending.get(String(message.id));
      if (!pending) {
        return;
      }
      this.pending.delete(String(message.id));
      if (message.error) {
        pending.reject(new Error(message.error.message || `${pending.method} failed`));
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    if (message.method) {
      this.handleNotification(message.method, message.params || {});
    }
  }

  handleNotification(method, params) {
    if (method === "thread/started") {
      this.currentThread = params.thread;
    }
    if (method === "thread/tokenUsage/updated") {
      this.rememberThreadTokenUsage(params.threadId, params.tokenUsage);
    }
    if (method === "account/rateLimits/updated") {
      this.rateLimits = { rateLimits: params.rateLimits, rateLimitsByLimitId: null };
    }
    sendToRenderer("codex:event", { method, params });
  }

  rememberThreadTokenUsage(threadId, tokenUsage) {
    const usage = tokenUsageForUi(tokenUsage);
    if (!threadId || !usage) {
      return null;
    }
    this.threadTokenUsageById[threadId] = usage;
    return usage;
  }

  handleServerRequest(message) {
    this.pendingServerRequests.set(String(message.id), message);
    sendToRenderer("codex:approval-request", message);
  }

  respondToServerRequest(id, result) {
    if (!this.pendingServerRequests.has(String(id))) {
      return;
    }
    this.pendingServerRequests.delete(String(id));
    this.write({ id, result });
  }

  async startThread(workspace = this.workspace) {
    this.workspace = workspace;
    const settings = uiThreadSettings();
    const result = await this.request("thread/start", {
      cwd: workspace,
      approvalPolicy: "on-request",
      sandbox: "workspace-write",
      personality: settings.personality,
      developerInstructions: settings.developerInstructions,
      sessionStartSource: "startup",
      serviceName: CLIENT_INFO.name,
    });
    this.currentThread = result.thread;
    return result.thread;
  }

  async resumeThread(threadId) {
    const settings = uiThreadSettings();
    const result = await this.request("thread/resume", {
      threadId,
      cwd: this.workspace,
      approvalPolicy: "on-request",
      sandbox: "workspace-write",
      personality: settings.personality,
      developerInstructions: settings.developerInstructions,
    });
    this.currentThread = result.thread;
    return result.thread;
  }

  async refreshThreadTokenUsage(threadId = this.currentThread?.id) {
    if (!threadId) {
      return null;
    }

    let thread = this.currentThread?.id === threadId ? this.currentThread : null;
    if (!thread?.path) {
      try {
        const result = await this.request("thread/read", { threadId, includeTurns: false });
        thread = result?.thread || thread;
      } catch (error) {
        sendToRenderer("codex:server-log", `Failed to read thread token usage path: ${error.message}`);
      }
    }

    try {
      const usage = await latestTokenUsageFromRollout(thread?.path);
      if (usage) {
        return this.rememberThreadTokenUsage(threadId, usage);
      }
    } catch (error) {
      sendToRenderer("codex:server-log", `Failed to refresh thread token usage: ${error.message}`);
    }

    return this.threadTokenUsageById[threadId] || null;
  }

  async archiveThread(threadId) {
    return this.request("thread/archive", { threadId });
  }

  async rollbackThread(numTurns) {
    if (!this.currentThread?.id) {
      throw new Error("No active thread to roll back.");
    }
    const result = await this.request("thread/rollback", {
      threadId: this.currentThread.id,
      numTurns,
    });
    this.currentThread = result.thread;
    return result.thread;
  }

  async listThreads() {
    const threads = [];
    let cursor = null;

    do {
      const result = await this.request("thread/list", {
        cursor,
        limit: 100,
        sortKey: "updated_at",
        sortDirection: "desc",
        archived: false,
        cwd: this.workspace,
      });
      threads.push(...(result.data || []));
      cursor = result.nextCursor || null;
    } while (cursor && threads.length < 500);

    return threads;
  }

  async listModels() {
    const models = [];
    let cursor = null;

    do {
      const result = await this.request("model/list", {
        cursor,
        limit: 100,
        includeHidden: false,
      });
      models.push(...(result.data || []));
      cursor = result.nextCursor || null;
    } while (cursor && models.length < 500);

    return models;
  }

  async sendMessage(text, options = {}) {
    if (!this.currentThread) {
      await this.startThread(this.workspace);
    }

    if (options.followUpBehavior === "steer" && options.activeTurnId) {
      const result = await this.request("turn/steer", {
        threadId: this.currentThread.id,
        input: [{ type: "text", text, text_elements: [] }],
        expectedTurnId: options.activeTurnId,
      });
      return { id: result.turnId };
    }

    const collaborationMode = collaborationModeForTurnOptions(options);
    const result = await this.request("turn/start", {
      threadId: this.currentThread.id,
      input: [{ type: "text", text, text_elements: [] }],
      cwd: this.workspace,
      approvalPolicy: approvalPolicyForPermissionMode(options.permissionMode),
      permissions: permissionSelectionForMode(options.permissionMode),
      effort: collaborationMode ? null : options.effort || "high",
      summary: reasoningSummaryForUi(options.reasoningSummary),
      model: collaborationMode ? null : options.model || null,
      serviceTier: serviceTierForSpeed(options.speed),
      personality: personalityForUi(options.personality),
      collaborationMode,
    });
    return result.turn;
  }

  async startReview(options = {}) {
    if (!this.currentThread) {
      await this.startThread(this.workspace);
    }

    const result = await this.request("review/start", {
      threadId: this.currentThread.id,
      target: { type: "uncommittedChanges" },
      delivery: options.delivery === "detached" ? "detached" : "inline",
    });
    return result.turn;
  }

  async applyRuntimeUiConfig() {
    const config = readUiConfig();
    await this.setMemoryPreferences({ memoriesEnabled: Boolean(config.memoriesEnabled) });
  }

  async setMemoryPreferences({ memoriesEnabled }) {
    const enabled = Boolean(memoriesEnabled);
    const result = await this.request("experimentalFeature/enablement/set", {
      enablement: { memories: enabled },
    });
    if (this.currentThread?.id) {
      await this.request("thread/memoryMode/set", {
        threadId: this.currentThread.id,
        mode: enabled ? "enabled" : "disabled",
      }).catch((error) => {
        sendToRenderer("codex:server-log", `Failed to update current thread memory mode: ${error.message}`);
      });
    }
    return result;
  }

  async resetMemories() {
    return this.request("memory/reset");
  }

  async readAccount(options = {}) {
    try {
      const result = await this.request("account/read", { refreshToken: Boolean(options.refreshToken) });
      this.accountState = result;
      return result;
    } catch (error) {
      if (this.accountState) {
        sendToRenderer("codex:server-log", `Using cached auth state after account/read failed: ${error.message}`);
        return this.accountState;
      }
      throw error;
    }
  }

  async login(params = {}) {
    const current = await this.readAccount().catch(() => null);
    if (current?.account) {
      return { type: "alreadyAuthenticated", account: current.account };
    }
    const type = params.type || "chatgpt";
    const requestParams =
      type === "apiKey"
        ? { type: "apiKey", apiKey: params.apiKey }
        : type === "chatgptDeviceCode"
          ? { type: "chatgptDeviceCode" }
          : { type: "chatgpt", codexStreamlinedLogin: false };

    const result = await this.request("account/login/start", requestParams);
    if (result.type === "chatgpt" && result.authUrl) {
      await shell.openExternal(result.authUrl);
    }
    return result;
  }

  async cancelLogin(loginId) {
    return this.request("account/login/cancel", { loginId });
  }

  async logout() {
    const result = await this.request("account/logout");
    this.accountState = null;
    this.rateLimits = null;
    return result;
  }

  async readRateLimits() {
    const result = await this.request("account/rateLimits/read");
    this.rateLimits = result;
    return result;
  }

  async readConfig() {
    return this.request("config/read", { includeLayers: true, cwd: this.workspace });
  }

  async writeConfigValue(params = {}) {
    return this.request("config/value/write", {
      keyPath: params.keyPath,
      value: params.value,
      mergeStrategy: params.mergeStrategy || "replace",
      filePath: params.filePath || null,
      expectedVersion: params.expectedVersion || null,
    });
  }
}

function execFileText(command, args, options = {}) {
  return new Promise((resolve) => {
    execFile(command, args, { ...options, maxBuffer: 20 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        stdout: stdout || "",
        stderr: stderr || "",
        error: error ? error.message : null,
      });
    });
  });
}

function emptyGitState() {
  return {
    isGit: false,
    branch: null,
    files: [],
    diff: "",
    totals: { files: 0, added: 0, deleted: 0 },
  };
}

async function getGitState(workspace) {
  const status = await execFileText("git", ["-C", workspace, "status", "--porcelain=v1"]);
  const numstat = await execFileText("git", ["-C", workspace, "diff", "--numstat"]);
  const diff = await execFileText("git", ["-C", workspace, "diff", "--unified=80", "--no-ext-diff", "--no-color"]);
  const branch = await execFileText("git", ["-C", workspace, "branch", "--show-current"]);

  if (!status.ok && !diff.ok) {
    return emptyGitState();
  }

  const stats = new Map();
  for (const line of numstat.stdout.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }
    const [added, deleted, ...fileParts] = line.split("\t");
    const file = fileParts.join("\t");
    stats.set(file, {
      path: file,
      added: Number.parseInt(added, 10) || 0,
      deleted: Number.parseInt(deleted, 10) || 0,
      status: "M",
    });
  }

  for (const line of status.stdout.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }
    const statusCode = line.slice(0, 2).trim() || "M";
    const file = line.slice(3).replace(/^"|"$/g, "");
    const existing = stats.get(file) || {
      path: file,
      added: 0,
      deleted: 0,
      status: statusCode,
    };
    existing.status = statusCode;
    stats.set(file, existing);
  }

  const files = [...stats.values()].sort((a, b) => a.path.localeCompare(b.path));
  return {
    isGit: true,
    branch: branch.stdout.trim() || "detached",
    files,
    diff: diff.stdout,
    totals: files.reduce(
      (acc, file) => ({
        files: acc.files + 1,
        added: acc.added + file.added,
        deleted: acc.deleted + file.deleted,
      }),
      { files: 0, added: 0, deleted: 0 },
    ),
  };
}

function listProjects(workspace) {
  const activePath = normalizeProjectPath(workspace);
  const uiConfig = readUiConfig();
  const pinnedProjectPaths = new Set(uiConfig.pinnedProjectPaths);
  return uiConfig.recentProjects.map((project) => ({
    name: project.name || path.basename(project.path),
    path: project.path,
    active: !workspaceIsFallback && project.path === activePath,
    lastOpenedAt: project.lastOpenedAt,
    pinned: pinnedProjectPaths.has(project.path),
  }));
}

function decodeHref(value) {
  try {
    return decodeURIComponent(String(value || ""));
  } catch {
    return String(value || "");
  }
}

function linkedFileFromHref(href, workspace) {
  let raw = decodeHref(href).trim();
  if (!raw || /^(https?:|mailto:)/i.test(raw)) {
    return null;
  }

  if (raw.startsWith("file://")) {
    raw = decodeHref(new URL(raw).pathname);
  }

  raw = raw.replace(/[?#].*$/, (suffix) => {
    const line = suffix.match(/#L?(\d+)/i);
    return line ? `:${line[1]}` : "";
  });

  let line = null;
  const lineMatch = raw.match(/:(\d+)(?::\d+)?$/);
  if (lineMatch) {
    line = Number.parseInt(lineMatch[1], 10);
    raw = raw.slice(0, lineMatch.index);
  }

  if (!raw) {
    return null;
  }

  const filePath = path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(workspace, raw);
  return { filePath, line };
}

function readLinkedFile(href) {
  const workspace = codexClient?.workspace || resolveWorkspace(process.argv);
  const parsed = linkedFileFromHref(href, workspace);
  if (!parsed) {
    throw new Error("Not a local file link");
  }

  const stat = fs.statSync(parsed.filePath);
  if (!stat.isFile()) {
    throw new Error("File link does not point to a file");
  }

  const maxBytes = 1024 * 1024;
  const buffer = fs.readFileSync(parsed.filePath);
  const truncated = buffer.length > maxBytes;
  const content = buffer.subarray(0, maxBytes).toString("utf8");
  const relativePath = path.relative(workspace, parsed.filePath);
  return {
    path: parsed.filePath,
    relativePath: relativePath && !relativePath.startsWith("..") ? relativePath : parsed.filePath,
    line: parsed.line,
    content,
    size: stat.size,
    truncated,
  };
}

async function bootstrap() {
  const workspaceInfo = resolveWorkspaceInfo(process.argv);
  const workspace = workspaceInfo.workspace;
  workspaceIsFallback = workspaceInfo.fallback;
  if (workspaceInfo.remember) {
    rememberProject(workspace);
  }
  const codexBin = resolveCodexBinary();
  codexClient = new CodexAppServerClient({ codexBin, workspace });

  try {
    await codexClient.start();
    sendToRenderer("codex:server-status", { status: "running", detail: codexBin });
  } catch (error) {
    sendToRenderer("codex:server-status", { status: "error", detail: error.message });
  }
}

ipcMain.handle("app:get-state", async () => {
  const workspaceInfo = codexClient
    ? { workspace: codexClient.workspace, fallback: workspaceIsFallback }
    : resolveWorkspaceInfo(process.argv);
  const workspace = workspaceInfo.workspace;
  const [git, threads, account] = await Promise.all([
    workspaceInfo.fallback ? Promise.resolve(emptyGitState()) : getGitState(workspace),
    !workspaceInfo.fallback && codexClient?.initialized ? codexClient.listThreads().catch(() => []) : Promise.resolve([]),
    codexClient?.initialized ? codexClient.readAccount().catch(() => null) : Promise.resolve(null),
  ]);
  const models = codexClient?.initialized ? await codexClient.listModels().catch(() => []) : [];
  return {
    workspace,
    codexBin: codexClient?.codexBin || resolveCodexBinary(),
    serverReady: Boolean(codexClient?.initialized),
    git,
    threads,
    currentThread: codexClient?.currentThread || null,
    projects: listProjects(workspace),
    workspaceIsFallback: workspaceInfo.fallback,
    account,
    rateLimits: codexClient?.rateLimits || null,
    threadTokenUsageById: codexClient?.threadTokenUsageById || {},
    models,
    uiConfig: readUiConfig(),
    version: APP_VERSION,
  };
});

ipcMain.handle("thread:new", async () => codexClient.startThread());
ipcMain.handle("thread:resume", async (_event, threadId) => codexClient.resumeThread(threadId));
ipcMain.handle("thread:refresh-token-usage", async (_event, threadId) => codexClient.refreshThreadTokenUsage(threadId));
ipcMain.handle("thread:archive", async (_event, threadId) => codexClient.archiveThread(threadId));
ipcMain.handle("thread:rollback", async (_event, payload) => codexClient.rollbackThread(payload?.numTurns || 0));
ipcMain.handle("turn:start", async (_event, payload) => codexClient.sendMessage(payload.text, payload.options || {}));
ipcMain.handle("review:start", async (_event, payload) => codexClient.startReview(payload || {}));
ipcMain.handle("git:refresh", async () => (workspaceIsFallback ? emptyGitState() : getGitState(codexClient.workspace)));
ipcMain.handle("account:login", async (_event, payload) => codexClient.login(payload || {}));
ipcMain.handle("account:cancel-login", async (_event, loginId) => codexClient.cancelLogin(loginId));
ipcMain.handle("account:logout", async () => codexClient.logout());
ipcMain.handle("account:rate-limits", async () => codexClient.readRateLimits());
ipcMain.handle("config:read", async () => codexClient.readConfig());
ipcMain.handle("config:value-write", async (_event, payload) => codexClient.writeConfigValue(payload || {}));
ipcMain.handle("config:open-user", async () => openUserConfigToml());
ipcMain.handle("ui-config:update", async (_event, patch) => writeUiConfig(patch || {}));
ipcMain.handle("file:read-link", async (_event, href) => readLinkedFile(href));
ipcMain.handle("shell:open-external", async (_event, url) => shell.openExternal(url));
ipcMain.handle("clipboard:write-text", async (_event, text) => {
  clipboard.writeText(String(text ?? ""));
  return { ok: true };
});
ipcMain.handle("licenses:open", async () => openLicenseNotices());
ipcMain.handle("memory:preferences-update", async (_event, payload) => codexClient.setMemoryPreferences(payload || {}));
ipcMain.handle("memory:reset", async () => codexClient.resetMemories());
ipcMain.handle("approval:respond", async (_event, payload) => {
  const decision = payload.accept ? "accept" : "decline";
  codexClient.respondToServerRequest(payload.id, { decision });
});
ipcMain.handle("workspace:choose", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
    defaultPath: workspaceIsFallback ? os.homedir() : codexClient.workspace,
  });
  if (result.canceled || !result.filePaths[0]) {
    return null;
  }
  const workspace = result.filePaths[0];
  codexClient.workspace = workspace;
  codexClient.currentThread = null;
  workspaceIsFallback = false;
  rememberProject(workspace);
  return workspace;
});
ipcMain.handle("workspace:open", async (_event, workspace) => {
  const projectPath = normalizeProjectPath(workspace);
  if (!projectPath) {
    return null;
  }
  codexClient.workspace = projectPath;
  codexClient.currentThread = null;
  workspaceIsFallback = false;
  rememberProject(projectPath);
  return projectPath;
});
ipcMain.handle("window:minimize", () => mainWindow.minimize());
ipcMain.handle("window:maximize", () => {
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});
ipcMain.handle("window:close", () => mainWindow.close());

app.whenReady().then(async () => {
  createWindow();
  await bootstrap();
});

app.on("window-all-closed", () => {
  codexClient?.stop();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
