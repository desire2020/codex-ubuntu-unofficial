const state = {
  workspace: "",
  serverReady: false,
  threads: [],
  projects: [],
  account: null,
  currentThread: null,
  currentTurnId: null,
  currentTurnStartedAt: null,
  assistantItemId: null,
  messages: [],
  git: {
    isGit: false,
    branch: null,
    files: [],
    diff: "",
    totals: { files: 0, added: 0, deleted: 0 },
  },
  pendingApproval: null,
  authLogin: null,
  fileDetail: null,
  rateLimits: null,
  rateLimitsLoading: false,
  rateLimitsError: "",
  rateLimitsLoadedAt: 0,
  threadTokenUsageById: {},
  uiConfig: {
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
    pinnedThreadIds: [],
    pinnedProjectPaths: [],
  },
  reviewOpen: false,
  selectedModel: "",
  selectedEffort: "",
  settingsTab: "general",
  configRead: null,
  configLoading: false,
  configError: "",
  configSaveMessage: "",
  queuedFollowUps: [],
  optimisticThreads: [],
  draftThreadId: null,
  editingTurn: null,
};

let markdownRenderer;
let conversationRenderScheduled = false;
let conversationRenderShouldStick = false;
let runtimeTickerId = null;
const CODE_PREVIEW_LINES = 3;
const TEXT_CODE_LANGUAGES = new Set(["text", "txt", "plain", "plaintext", "markdown", "md"]);

const els = {
  branchName: document.getElementById("branchName"),
  commitButton: document.getElementById("commitButton"),
  commitMenu: document.getElementById("commitMenu"),
  conversation: document.getElementById("conversation"),
  contextMeterFill: document.getElementById("contextMeterFill"),
  contextMeterLabel: document.getElementById("contextMeterLabel"),
  contextMeterMini: document.getElementById("contextMeterMini"),
  contextMenu: document.getElementById("contextMenu"),
  diffViewer: document.getElementById("diffViewer"),
  emptyState: document.getElementById("emptyState"),
  emptySubtitle: document.getElementById("emptySubtitle"),
  emptyTitle: document.getElementById("emptyTitle"),
  editTurnHelp: document.getElementById("editTurnHelp"),
  editTurnModal: document.getElementById("editTurnModal"),
  editTurnStatus: document.getElementById("editTurnStatus"),
  editTurnText: document.getElementById("editTurnText"),
  editTurnTitle: document.getElementById("editTurnTitle"),
  effortButtons: document.getElementById("effortButtons"),
  fileCount: document.getElementById("fileCount"),
  fileSummary: document.getElementById("fileSummary"),
  form: document.getElementById("composer"),
  modelChoice: document.getElementById("modelChoice"),
  modelChoiceLabel: document.getElementById("modelChoiceLabel"),
  modelMenu: document.getElementById("modelMenu"),
  permissionChoice: document.getElementById("permissionChoice"),
  permissionChoiceLabel: document.getElementById("permissionChoiceLabel"),
  permissionMenu: document.getElementById("permissionMenu"),
  prompt: document.getElementById("prompt"),
  projects: document.getElementById("projects"),
  reviewOpen: document.getElementById("openReview"),
  reviewTitle: document.getElementById("reviewTitle"),
  shell: document.getElementById("shell"),
  settingsAddMcpServer: document.getElementById("settingsAddMcpServer"),
  settingsAccount: document.getElementById("settingsAccount"),
  settingsAccountDetail: document.getElementById("settingsAccountDetail"),
  settingsCodeReviewMode: document.getElementById("settingsCodeReviewMode"),
  settingsCodexBin: document.getElementById("settingsCodexBin"),
  settingsConfigDocs: document.getElementById("settingsConfigDocs"),
  settingsConfigApproval: document.getElementById("settingsConfigApproval"),
  settingsConfigApprovalOrigin: document.getElementById("settingsConfigApprovalOrigin"),
  settingsConfigEffort: document.getElementById("settingsConfigEffort"),
  settingsConfigEffortOrigin: document.getElementById("settingsConfigEffortOrigin"),
  settingsConfigLayers: document.getElementById("settingsConfigLayers"),
  settingsConfigModel: document.getElementById("settingsConfigModel"),
  settingsConfigModelOrigin: document.getElementById("settingsConfigModelOrigin"),
  settingsConfigPath: document.getElementById("settingsConfigPath"),
  settingsRefreshConfig: document.getElementById("settingsRefreshConfig"),
  settingsConfigSandbox: document.getElementById("settingsConfigSandbox"),
  settingsConfigSandboxOrigin: document.getElementById("settingsConfigSandboxOrigin"),
  settingsConfigServiceTier: document.getElementById("settingsConfigServiceTier"),
  settingsConfigServiceTierOrigin: document.getElementById("settingsConfigServiceTierOrigin"),
  settingsConfigStatus: document.getElementById("settingsConfigStatus"),
  settingsConfigSummary: document.getElementById("settingsConfigSummary"),
  settingsConfigSummaryOrigin: document.getElementById("settingsConfigSummaryOrigin"),
  settingsConfigVerbosity: document.getElementById("settingsConfigVerbosity"),
  settingsConfigVerbosityOrigin: document.getElementById("settingsConfigVerbosityOrigin"),
  settingsConfigWebSearch: document.getElementById("settingsConfigWebSearch"),
  settingsConfigWebSearchOrigin: document.getElementById("settingsConfigWebSearchOrigin"),
  settingsCustomInstructions: document.getElementById("settingsCustomInstructions"),
  settingsEffort: document.getElementById("settingsEffort"),
  settingsEnableMemories: document.getElementById("settingsEnableMemories"),
  settingsFollowUpBehavior: document.getElementById("settingsFollowUpBehavior"),
  settingsLanguage: document.getElementById("settingsLanguage"),
  settingsMcpDocs: document.getElementById("settingsMcpDocs"),
  settingsMcpServers: document.getElementById("settingsMcpServers"),
  settingsMemoryDocs: document.getElementById("settingsMemoryDocs"),
  settingsModal: document.getElementById("settingsModal"),
  settingsModel: document.getElementById("settingsModel"),
  settingsOpenConfig: document.getElementById("settingsOpenConfig"),
  settingsOpenAuth: document.getElementById("settingsOpenAuth"),
  settingsOpenUsage: document.getElementById("settingsOpenUsage"),
  settingsPersonality: document.getElementById("settingsPersonality"),
  settingsPluginBuiltBy: document.getElementById("settingsPluginBuiltBy"),
  settingsPluginCategory: document.getElementById("settingsPluginCategory"),
  settingsPluginList: document.getElementById("settingsPluginList"),
  settingsPluginSearch: document.getElementById("settingsPluginSearch"),
  settingsRawConfig: document.getElementById("settingsRawConfig"),
  settingsRequireCtrlEnter: document.getElementById("settingsRequireCtrlEnter"),
  settingsResetMemories: document.getElementById("settingsResetMemories"),
  settingsRateLimitCards: document.getElementById("settingsRateLimitCards"),
  settingsRateLimitStatus: document.getElementById("settingsRateLimitStatus"),
  settingsRateLimitTitle: document.getElementById("settingsRateLimitTitle"),
  settingsRefreshUsage: document.getElementById("settingsRefreshUsage"),
  settingsReviewOpen: document.getElementById("settingsReviewOpen"),
  settingsSaveConfig: document.getElementById("settingsSaveConfig"),
  settingsSavePersonalization: document.getElementById("settingsSavePersonalization"),
  settingsLogout: document.getElementById("settingsLogout"),
  settingsSkipToolMemories: document.getElementById("settingsSkipToolMemories"),
  settingsSpeed: document.getElementById("settingsSpeed"),
  settingsContextUsageBar: document.getElementById("settingsContextUsageBar"),
  settingsContextUsageDetail: document.getElementById("settingsContextUsageDetail"),
  settingsContextUsageLabel: document.getElementById("settingsContextUsageLabel"),
  settingsTokenInput: document.getElementById("settingsTokenInput"),
  settingsTokenInputLabel: document.getElementById("settingsTokenInputLabel"),
  settingsTokenLastTurn: document.getElementById("settingsTokenLastTurn"),
  settingsTokenOutput: document.getElementById("settingsTokenOutput"),
  settingsTokenOutputLabel: document.getElementById("settingsTokenOutputLabel"),
  settingsTokenReasoning: document.getElementById("settingsTokenReasoning"),
  settingsTokenReasoningLabel: document.getElementById("settingsTokenReasoningLabel"),
  settingsTokenTotal: document.getElementById("settingsTokenTotal"),
  settingsTokenTotalLabel: document.getElementById("settingsTokenTotalLabel"),
  settingsTokenUsageStatus: document.getElementById("settingsTokenUsageStatus"),
  settingsTokenUsageTitle: document.getElementById("settingsTokenUsageTitle"),
  settingsUsageDetail: document.getElementById("settingsUsageDetail"),
  settingsVersion: document.getElementById("settingsVersion"),
  settingsViewLicenses: document.getElementById("settingsViewLicenses"),
  settingsWorkspaceName: document.getElementById("settingsWorkspaceName"),
  settingsWorkspacePath: document.getElementById("settingsWorkspacePath"),
  pinnedThreads: document.getElementById("pinnedThreads"),
  serverStatus: document.getElementById("serverStatus"),
  threads: document.getElementById("threads"),
  threadTitle: document.getElementById("threadTitle"),
  topAdded: document.getElementById("topAdded"),
  topDeleted: document.getElementById("topDeleted"),
  workspaceName: document.getElementById("workspaceName"),
  approvalCard: document.getElementById("approvalCard"),
  approvalTitle: document.getElementById("approvalTitle"),
  approvalDetail: document.getElementById("approvalDetail"),
  apiKeyInput: document.getElementById("apiKeyInput"),
  authAccountStatus: document.getElementById("authAccountStatus"),
  authButtonLabel: document.getElementById("authButtonLabel"),
  authModal: document.getElementById("authModal"),
  authSignedIn: document.getElementById("authSignedIn"),
  browserLoginStatus: document.getElementById("browserLoginStatus"),
  cancelLogin: document.getElementById("cancelLogin"),
  deviceCode: document.getElementById("deviceCode"),
  deviceCodeBox: document.getElementById("deviceCodeBox"),
  deviceUrl: document.getElementById("deviceUrl"),
  openDeviceUrl: document.getElementById("openDeviceUrl"),
};

const I18N = {
  en: {
    "nav.newChat": "New chat",
    "nav.main": "Main",
    "nav.search": "Search",
    "nav.plugins": "Plugins",
    "nav.automations": "Automations",
    "sidebar.pinned": "Pinned",
    "sidebar.projects": "Projects",
    "sidebar.chats": "Chats",
    "sidebar.settings": "Settings",
    "sidebar.noPinned": "No pinned items",
    "sidebar.noChats": "No chats",
    "sidebar.noProjects": "No projects",
    "sidebar.untitled": "Untitled",
    "top.signIn": "Sign in",
    "top.commit": "Commit",
    "empty.startThread": "Start a Codex thread",
    "empty.chooseProject": "Choose a project to start",
    "empty.whatBuild": "What should we build in {workspace}?",
    "empty.openFolder": "Open a folder from Projects before starting local work.",
    "status.connected": "Connected",
    "status.offline": "Offline",
    "status.appServerDisconnected": "Codex app-server is not connected",
    "workspace.chooseProject": "Choose project",
    "workspace.noGit": "no git",
    "composer.placeholder": "Ask for follow-up changes",
    "composer.addContext": "Add context",
    "composer.fullAccess": "Full access",
    "permission.readOnly": "Read only",
    "permission.readOnlyDescription": "Read files. Ask before editing files or using network.",
    "permission.workspace": "Default permissions",
    "permission.workspaceDescription": "Read and edit this workspace. Ask for network or external files.",
    "permission.fullAccess": "Full access",
    "permission.fullAccessDescription": "Edit anywhere and use network without approval.",
    "permission.menu": "Permissions",
    "composer.model": "Model",
    "composer.reasoningEffort": "Reasoning effort",
    "composer.speed": "Speed",
    "composer.contextUsage": "Context usage",
    "composer.contextUsageDetail": "{percent}% of effective context used",
    "composer.contextUnknown": "Context usage unavailable",
    "model.sectionModel": "Model",
    "model.sectionEffort": "Reasoning effort",
    "model.sectionSpeed": "Speed",
    "composer.workLocally": "Work locally",
    "composer.send": "Send",
    "approval.title": "Approval requested",
    "approval.commandTitle": "Command approval requested",
    "approval.fileTitle": "File change approval requested",
    "approval.defaultDetail": "Codex requested permission.",
    "approval.writeDetail": "Codex requested write permission.",
    "approval.decline": "Decline",
    "approval.approve": "Approve",
    "review.review": "Review",
    "review.unstaged": "Unstaged",
    "review.fileDetails": "File details",
    "review.refreshDiff": "Refresh diff",
    "review.newReview": "New review",
    "review.closeDetails": "Close file details",
    "review.more": "More",
    "review.revertAll": "Revert all",
    "review.stageAll": "Stage all",
    "review.openDetails": "Open file details",
    "review.noDiff": "No unstaged diff",
    "review.previewTruncated": "Preview truncated at 1 MB",
    "auth.title": "Sign in to Codex",
    "auth.required": "OpenAI auth required",
    "auth.noneRequired": "No OpenAI auth required",
    "auth.signedInApi": "Signed in with API key",
    "auth.deviceCode": "Device code",
    "auth.apiKey": "API key",
    "auth.continueBrowser": "Continue in browser",
    "auth.generateCode": "Generate code",
    "auth.openPage": "Open page",
    "auth.saveApiKey": "Save API key",
    "auth.cancelLogin": "Cancel login",
    "auth.signOut": "Sign out",
    "auth.browserOpened": "Browser opened. Complete the sign-in there.",
    "auth.loginComplete": "Login complete",
    "auth.loginFailed": "Login failed",
    "auth.signedInTitle": "Signed in",
    "auth.signedInHelp": "You are already authenticated. Sign out before starting another login flow.",
    "auth.manageAccount": "Manage account",
    "settings.title": "Settings",
    "settings.sections": "Settings sections",
    "settings.general": "General",
    "settings.configuration": "Configuration",
    "settings.personalization": "Personalization",
    "settings.mcp": "MCP servers",
    "settings.usage": "Usage",
    "settings.plugins": "Plugins",
    "settings.appearance": "Appearance",
    "settings.language": "Language",
    "settings.languageHelp": "Language for the app UI",
    "settings.languageAuto": "Auto Detect",
    "settings.languageEnglish": "English",
    "settings.languageChinese": "Simplified Chinese",
    "settings.requireCtrlEnter": "Require ^ + enter to send long prompts",
    "settings.requireCtrlEnterHelp": "When enabled, multiline prompts require ^ + enter to send.",
    "settings.speed": "Speed",
    "settings.speedHelp": "Choose how quickly inference runs across chats, subagents, and compaction. Fast uses increased plan usage",
    "settings.speedStandard": "Standard",
    "settings.speedFast": "Fast",
    "settings.followUp": "Follow-up behavior",
    "settings.followUpHelp": "Queue follow-ups while Codex runs or steer the current run. Press Ctrl+Enter to do the opposite for one message",
    "settings.queue": "Queue",
    "settings.steer": "Steer",
    "settings.codeReview": "Code review",
    "settings.codeReviewHelp": "Start /review in the current chat when possible or launch a separate review chat",
    "settings.inline": "Inline",
    "settings.detached": "Detached",
    "settings.configurationHelp": "Configure approval policy and sandbox settings",
    "settings.learnMore": "Learn more",
    "settings.learnMorePeriod": "Learn more.",
    "settings.customConfig": "Custom config.toml settings",
    "settings.configStatusDefault": "Edit your config to customize agent behavior. Restart Codex after editing to apply changes",
    "settings.openConfig": "Open config.toml",
    "settings.licenses": "Open source licenses",
    "settings.licensesHelp": "Third-party notices for bundled dependencies",
    "settings.view": "View",
    "settings.personality": "Personality",
    "settings.personalityHelp": "Choose a default tone for Codex responses",
    "settings.personalityFriendly": "Friendly",
    "settings.personalityPragmatic": "Pragmatic",
    "settings.customInstructions": "Custom instructions",
    "settings.customInstructionsHelp": "Give Codex extra instructions and context for your project",
    "settings.customInstructionsPlaceholder": "Add your custom instructions...",
    "settings.save": "Save",
    "settings.memory": "Memory (experimental)",
    "settings.memoryHelp": "Configure how Codex collects, retains, and consolidates memories.",
    "settings.enableMemories": "Enable memories",
    "settings.enableMemoriesHelp": "Generate new memories from chats and bring them into new chats",
    "settings.skipToolMemories": "Skip tool-assisted chats",
    "settings.skipToolMemoriesHelp": "Do not generate memories from chats that used MCP tools or web search",
    "settings.resetMemories": "Reset memories",
    "settings.resetMemoriesHelp": "Clear memory preferences stored by this desktop app",
    "settings.reset": "Reset",
    "settings.mcpHelp": "Connect external tools and data sources.",
    "settings.servers": "Servers",
    "settings.addEditMcp": "Add or edit MCP servers",
    "settings.mcpConfigured": "MCP servers are configured in config.toml",
    "settings.addServer": "+ Add server",
    "settings.account": "Account",
    "settings.planUsage": "Plan usage",
    "settings.usageSignedIn": "Usage details open in your OpenAI account",
    "settings.usageSignedOut": "Sign in to view usage",
    "settings.viewUsage": "View usage",
    "settings.refreshUsage": "Refresh",
    "settings.rateLimits": "Rate limits",
    "settings.rateLimitsLoading": "Loading rate limits...",
    "settings.rateLimitsUnavailable": "ChatGPT rate limit data is not available for this auth mode.",
    "settings.rateLimitsError": "Could not load rate limits: {error}",
    "settings.rateLimitsUpdated": "Updated {time}",
    "settings.rateLimitReached": "Limit reached: {type}",
    "settings.primary": "Primary",
    "settings.secondary": "Secondary",
    "settings.rateLimitWindow": "{name} window",
    "settings.rateLimitReset": "resets {time}",
    "settings.rateLimitNoReset": "reset time unavailable",
    "settings.credits": "Credits",
    "settings.creditsUnlimited": "Credits are unlimited",
    "settings.creditsAvailable": "Credits available",
    "settings.creditsUnavailable": "Credits unavailable",
    "settings.currentChatTokens": "Current chat tokens",
    "settings.tokenUsageEmpty": "No token usage has been reported for this chat yet.",
    "settings.tokenUsageLive": "Updates after each Codex turn.",
    "settings.contextWindow": "Context window",
    "settings.contextWindowUnknown": "Context window unavailable",
    "settings.total": "Total",
    "settings.input": "Input",
    "settings.cached": "cached",
    "settings.output": "Output",
    "settings.reasoning": "Reasoning",
    "settings.lastTurn": "Last turn",
    "settings.localEnvironment": "Local environment",
    "settings.workspace": "Workspace",
    "settings.change": "Change",
    "settings.codexBinary": "Codex binary",
    "settings.pluginsHeader": "Make Codex work your way",
    "settings.searchPlugins": "Search plugins",
    "settings.builtByOpenAI": "Built by OpenAI",
    "settings.allBuilders": "All builders",
    "settings.all": "All",
    "settings.messaging": "Messaging",
    "settings.files": "Files",
    "settings.calendar": "Calendar",
    "settings.slackPrompt": "Prep me for standup every morning",
    "settings.tryInChat": "Try in chat",
    "settings.featured": "Featured",
    "settings.fileDetailsPanel": "File details panel",
    "settings.openOnLaunch": "Open on launch",
    "settings.modelSelector": "Model selector",
    "settings.effortSelector": "Reasoning effort selector",
    "settings.resetUi": "Reset UI",
    "settings.manage": "Manage",
    "settings.noProject": "No project selected",
    "settings.chooseWorkspace": "Choose a workspace folder",
    "settings.loadingConfig": "Loading config.toml",
    "settings.noConfigPath": "No user config path reported",
    "settings.openedFile": "Opened {file}",
    "settings.noConfigValues": "# config.toml has no effective values",
    "settings.configWillAppear": "Config will appear after Codex connects.",
    "settings.noConfigLayers": "No config layers returned.",
    "settings.noMcp": "No MCP servers connected",
    "settings.loadingMcp": "Loading MCP servers...",
    "settings.configuredInToml": "Configured in config.toml",
    "settings.disabled": "disabled",
    "settings.pluginGithub": "Triage PRs, issues, CI, and publish flows",
    "settings.pluginSlack": "Read and manage Slack",
    "settings.pluginNotion": "Search and update team knowledge",
    "settings.pluginGoogleDrive": "Review docs, sheets, slides, and files",
    "settings.addPlugin": "Add {plugin}",
    "settings.comingSoon": "Coming soon",
    "settings.unavailable": "Unavailable",
    "settings.pluginsComingSoon": "Plugin install and connector auth are not wired in this Ubuntu build yet.",
    "settings.skipToolMemoriesComingSoon": "Filtering memory generation by tool usage is not exposed by app-server yet.",
    "settings.memorySaved": "Memory setting updated",
    "settings.memoryResetDone": "Memories reset",
    "settings.customInstructionsApplied": "Saved. Applied to future turns and new chats.",
    "model.modelsAfterSignIn": "Models will appear after sign in.",
    "effort.none": "None",
    "effort.minimal": "Minimal",
    "effort.low": "Low",
    "effort.medium": "Medium",
    "effort.high": "High",
    "effort.xhigh": "Extra High",
    "context.pin": "Pin",
    "context.unpin": "Unpin",
    "context.archiveDelete": "Archive/Delete",
    "context.deleteProject": "Delete from Projects",
    "config.notSet": "Not set",
    "config.from": "From {source}",
    "config.unknown": "unknown",
    "config.user": "user config.toml",
    "config.system": "system config.toml",
    "config.project": ".codex/config.toml",
    "config.sessionFlags": "session flags",
    "config.managed": "managed config",
    "config.managedPrefs": "managed preferences",
    "change.filesChanged": "{count} files changed",
    "change.noChanges": "No file changes",
    "change.moreFiles": "{count} more files",
    "change.undo": "Undo",
    "activity.title": "Work details",
    "activity.completedTitle": "Work details for this reply",
    "activity.items": "{count} items",
    "message.copy": "Copy this message",
    "message.editRegenerate": "Edit and regenerate from here",
    "editTurn.title": "Edit and regenerate",
    "editTurn.help": "Rollback to this turn, edit the user input, and run Codex again.",
    "editTurn.cancel": "Cancel",
    "editTurn.regenerate": "Regenerate",
    "editTurn.waitForTurn": "Wait for the current turn to finish before regenerating.",
    "editTurn.empty": "Enter a prompt to regenerate from this turn.",
    "editTurn.failed": "Regenerate failed: {error}",
    "code.copy": "Copy",
    "code.copied": "Copied",
    "code.copyFailed": "Copy failed",
    "code.code": "Code",
    "code.output": "Output",
    "code.command": "Command",
    "code.error": "Error",
    "code.fileChanges": "File changes",
    "code.noOutput": "No output",
    "code.line": "1 line",
    "code.lines": "{count} lines",
    "reasoning.title": "Thinking",
    "reasoning.ideaTitle": "Thought: {title}",
    "reasoning.inProgress": "Thinking",
    "reasoning.waiting": "Preparing reasoning summary...",
    "reasoning.active": "Codex is working...",
    "reasoning.note": "1 note",
    "reasoning.notes": "{count} notes",
    "reasoning.noNotes": "No summary",
    "reasoning.none": "No readable reasoning summary was emitted.",
    "context.compacted": "Context compressed",
    "context.compactedDetail": "Earlier conversation was summarized so Codex can continue with more room.",
    "runtime.running": "Working {duration}",
    "runtime.waiting": "Waiting {duration}",
    "runtime.completed": "Took {duration}",
    "age.minute": "{count}m",
    "age.hour": "{count}h",
    "age.day": "{count}d",
    "age.month": "{count}mo",
  },
  "zh-CN": {
    "nav.newChat": "新聊天",
    "nav.main": "主导航",
    "nav.search": "搜索",
    "nav.plugins": "插件",
    "nav.automations": "自动化",
    "sidebar.pinned": "已固定",
    "sidebar.projects": "项目",
    "sidebar.chats": "聊天",
    "sidebar.settings": "设置",
    "sidebar.noPinned": "没有固定项",
    "sidebar.noChats": "没有聊天",
    "sidebar.noProjects": "没有项目",
    "sidebar.untitled": "未命名",
    "top.signIn": "登录",
    "top.commit": "提交",
    "empty.startThread": "开始 Codex 聊天",
    "empty.chooseProject": "选择项目开始",
    "empty.whatBuild": "要在 {workspace} 里构建什么？",
    "empty.openFolder": "请先从项目中打开一个文件夹，再开始本地工作。",
    "status.connected": "已连接",
    "status.offline": "离线",
    "status.appServerDisconnected": "Codex app-server 未连接",
    "workspace.chooseProject": "选择项目",
    "workspace.noGit": "无 git",
    "composer.placeholder": "询问后续修改",
    "composer.addContext": "添加上下文",
    "composer.fullAccess": "完全访问",
    "permission.readOnly": "只读",
    "permission.readOnlyDescription": "读取文件。编辑文件或使用网络前需要确认。",
    "permission.workspace": "默认权限",
    "permission.workspaceDescription": "读取并编辑当前工作区。使用网络或外部文件前需要确认。",
    "permission.fullAccess": "完全访问",
    "permission.fullAccessDescription": "无需确认即可编辑任意位置并使用网络。",
    "permission.menu": "权限",
    "composer.model": "模型",
    "composer.reasoningEffort": "推理强度",
    "composer.speed": "速度",
    "composer.contextUsage": "上下文用量",
    "composer.contextUsageDetail": "已使用 {percent}% 有效上下文",
    "composer.contextUnknown": "上下文用量不可用",
    "model.sectionModel": "模型",
    "model.sectionEffort": "推理强度",
    "model.sectionSpeed": "速度",
    "composer.workLocally": "本地工作",
    "composer.send": "发送",
    "approval.title": "需要批准",
    "approval.commandTitle": "命令需要批准",
    "approval.fileTitle": "文件修改需要批准",
    "approval.defaultDetail": "Codex 请求权限。",
    "approval.writeDetail": "Codex 请求写入权限。",
    "approval.decline": "拒绝",
    "approval.approve": "批准",
    "review.review": "审查",
    "review.unstaged": "未暂存",
    "review.fileDetails": "文件详情",
    "review.refreshDiff": "刷新 diff",
    "review.newReview": "新审查",
    "review.closeDetails": "关闭文件详情",
    "review.more": "更多",
    "review.revertAll": "全部还原",
    "review.stageAll": "全部暂存",
    "review.openDetails": "打开文件详情",
    "review.noDiff": "没有未暂存 diff",
    "review.previewTruncated": "预览已在 1 MB 处截断",
    "auth.title": "登录 Codex",
    "auth.required": "需要 OpenAI 认证",
    "auth.noneRequired": "不需要 OpenAI 认证",
    "auth.signedInApi": "已使用 API key 登录",
    "auth.deviceCode": "设备码",
    "auth.apiKey": "API key",
    "auth.continueBrowser": "在浏览器中继续",
    "auth.generateCode": "生成代码",
    "auth.openPage": "打开页面",
    "auth.saveApiKey": "保存 API key",
    "auth.cancelLogin": "取消登录",
    "auth.signOut": "退出登录",
    "auth.browserOpened": "浏览器已打开，请在那里完成登录。",
    "auth.loginComplete": "登录完成",
    "auth.loginFailed": "登录失败",
    "auth.signedInTitle": "已登录",
    "auth.signedInHelp": "当前已经完成认证。如需重新登录，请先退出登录。",
    "auth.manageAccount": "管理账号",
    "settings.title": "设置",
    "settings.sections": "设置分类",
    "settings.general": "通用",
    "settings.configuration": "配置",
    "settings.personalization": "个性化",
    "settings.mcp": "MCP 服务器",
    "settings.usage": "用量",
    "settings.plugins": "插件",
    "settings.appearance": "外观",
    "settings.language": "语言",
    "settings.languageHelp": "应用界面语言",
    "settings.languageAuto": "自动检测",
    "settings.languageEnglish": "English",
    "settings.languageChinese": "简体中文",
    "settings.requireCtrlEnter": "长提示词需要 ^ + Enter 发送",
    "settings.requireCtrlEnterHelp": "启用后，多行提示词需要 ^ + Enter 才会发送。",
    "settings.speed": "速度",
    "settings.speedHelp": "选择聊天、子代理和压缩运行推理的速度。快速模式会增加计划用量",
    "settings.speedStandard": "标准",
    "settings.speedFast": "快速",
    "settings.followUp": "后续消息行为",
    "settings.followUpHelp": "Codex 运行时将后续消息排队，或引导当前运行。按 Ctrl+Enter 可临时执行相反行为",
    "settings.queue": "排队",
    "settings.steer": "引导",
    "settings.codeReview": "代码审查",
    "settings.codeReviewHelp": "尽可能在当前聊天中启动 /review，或启动单独的审查聊天",
    "settings.inline": "当前聊天",
    "settings.detached": "单独聊天",
    "settings.configurationHelp": "配置审批策略和沙盒设置",
    "settings.learnMore": "了解更多",
    "settings.learnMorePeriod": "了解更多。",
    "settings.customConfig": "自定义 config.toml 设置",
    "settings.configStatusDefault": "编辑配置以自定义代理行为。编辑后重启 Codex 以应用更改",
    "settings.openConfig": "打开 config.toml",
    "settings.licenses": "开源许可证",
    "settings.licensesHelp": "内置依赖的第三方声明",
    "settings.view": "查看",
    "settings.personality": "个性",
    "settings.personalityHelp": "选择 Codex 回复的默认语气",
    "settings.personalityFriendly": "友好",
    "settings.personalityPragmatic": "务实",
    "settings.customInstructions": "自定义指令",
    "settings.customInstructionsHelp": "为项目提供额外指令和上下文",
    "settings.customInstructionsPlaceholder": "添加你的自定义指令...",
    "settings.save": "保存",
    "settings.memory": "记忆（实验性）",
    "settings.memoryHelp": "配置 Codex 如何收集、保留和整合记忆。",
    "settings.enableMemories": "启用记忆",
    "settings.enableMemoriesHelp": "从聊天中生成新记忆，并带入新的聊天",
    "settings.skipToolMemories": "跳过使用工具的聊天",
    "settings.skipToolMemoriesHelp": "不要从使用了 MCP 工具或网页搜索的聊天中生成记忆",
    "settings.resetMemories": "重置记忆",
    "settings.resetMemoriesHelp": "清除此桌面应用存储的记忆偏好",
    "settings.reset": "重置",
    "settings.mcpHelp": "连接外部工具和数据源。",
    "settings.servers": "服务器",
    "settings.addEditMcp": "添加或编辑 MCP 服务器",
    "settings.mcpConfigured": "MCP 服务器在 config.toml 中配置",
    "settings.addServer": "+ 添加服务器",
    "settings.account": "账号",
    "settings.planUsage": "计划用量",
    "settings.usageSignedIn": "在你的 OpenAI 账号中查看用量详情",
    "settings.usageSignedOut": "登录后查看用量",
    "settings.viewUsage": "查看用量",
    "settings.refreshUsage": "刷新",
    "settings.rateLimits": "额度限制",
    "settings.rateLimitsLoading": "正在加载额度限制...",
    "settings.rateLimitsUnavailable": "当前鉴权模式不提供 ChatGPT 额度窗口数据。",
    "settings.rateLimitsError": "无法加载额度限制：{error}",
    "settings.rateLimitsUpdated": "更新于 {time}",
    "settings.rateLimitReached": "已达到限制：{type}",
    "settings.primary": "主要",
    "settings.secondary": "次要",
    "settings.rateLimitWindow": "{name} 窗口",
    "settings.rateLimitReset": "{time} 重置",
    "settings.rateLimitNoReset": "重置时间不可用",
    "settings.credits": "额度",
    "settings.creditsUnlimited": "额度无限",
    "settings.creditsAvailable": "额度可用",
    "settings.creditsUnavailable": "额度不可用",
    "settings.currentChatTokens": "当前聊天 token",
    "settings.tokenUsageEmpty": "这个聊天还没有收到 token 用量。",
    "settings.tokenUsageLive": "每个 Codex turn 结束后更新。",
    "settings.contextWindow": "上下文窗口",
    "settings.contextWindowUnknown": "上下文窗口不可用",
    "settings.total": "总计",
    "settings.input": "输入",
    "settings.cached": "缓存",
    "settings.output": "输出",
    "settings.reasoning": "推理",
    "settings.lastTurn": "最近 turn",
    "settings.localEnvironment": "本地环境",
    "settings.workspace": "工作区",
    "settings.change": "更改",
    "settings.codexBinary": "Codex 可执行文件",
    "settings.pluginsHeader": "按你的方式使用 Codex",
    "settings.searchPlugins": "搜索插件",
    "settings.builtByOpenAI": "OpenAI 构建",
    "settings.allBuilders": "所有构建者",
    "settings.all": "全部",
    "settings.messaging": "消息",
    "settings.files": "文件",
    "settings.calendar": "日历",
    "settings.slackPrompt": "每天早上帮我准备站会",
    "settings.tryInChat": "在聊天中试用",
    "settings.featured": "精选",
    "settings.fileDetailsPanel": "文件详情面板",
    "settings.openOnLaunch": "启动时打开",
    "settings.modelSelector": "模型选择器",
    "settings.effortSelector": "推理强度选择器",
    "settings.resetUi": "重置界面",
    "settings.manage": "管理",
    "settings.noProject": "未选择项目",
    "settings.chooseWorkspace": "选择工作区文件夹",
    "settings.loadingConfig": "正在加载 config.toml",
    "settings.noConfigPath": "未返回用户配置路径",
    "settings.openedFile": "已打开 {file}",
    "settings.noConfigValues": "# config.toml 没有有效值",
    "settings.configWillAppear": "Codex 连接后会显示配置。",
    "settings.noConfigLayers": "没有返回配置层。",
    "settings.noMcp": "没有连接 MCP 服务器",
    "settings.loadingMcp": "正在加载 MCP 服务器...",
    "settings.configuredInToml": "在 config.toml 中配置",
    "settings.disabled": "已禁用",
    "settings.pluginGithub": "处理 PR、issue、CI 并发布流程",
    "settings.pluginSlack": "读取和管理 Slack",
    "settings.pluginNotion": "搜索和更新团队知识",
    "settings.pluginGoogleDrive": "查看文档、表格、幻灯片和文件",
    "settings.addPlugin": "添加 {plugin}",
    "settings.comingSoon": "敬请期待",
    "settings.unavailable": "不可用",
    "settings.pluginsComingSoon": "此 Ubuntu 版本尚未接入插件安装和连接器授权。",
    "settings.skipToolMemoriesComingSoon": "app-server 尚未暴露按工具使用情况过滤记忆生成的接口。",
    "settings.memorySaved": "记忆设置已更新",
    "settings.memoryResetDone": "记忆已重置",
    "settings.customInstructionsApplied": "已保存。将应用到后续 turn 和新聊天。",
    "model.modelsAfterSignIn": "登录后会显示模型。",
    "effort.none": "无",
    "effort.minimal": "最小",
    "effort.low": "低",
    "effort.medium": "中",
    "effort.high": "高",
    "effort.xhigh": "超高",
    "context.pin": "固定",
    "context.unpin": "取消固定",
    "context.archiveDelete": "归档/删除",
    "context.deleteProject": "从项目中删除",
    "config.notSet": "未设置",
    "config.from": "来自 {source}",
    "config.unknown": "未知",
    "config.user": "用户 config.toml",
    "config.system": "系统 config.toml",
    "config.project": ".codex/config.toml",
    "config.sessionFlags": "会话参数",
    "config.managed": "托管配置",
    "config.managedPrefs": "托管偏好",
    "change.filesChanged": "{count} 个文件已更改",
    "change.noChanges": "没有文件更改",
    "change.moreFiles": "还有 {count} 个文件",
    "change.undo": "撤销",
    "activity.title": "工作细节",
    "activity.completedTitle": "本次回复的工作细节",
    "activity.items": "{count} 项",
    "message.copy": "复制本条内容",
    "message.editRegenerate": "从这里编辑并重新生成",
    "editTurn.title": "编辑并重新生成",
    "editTurn.help": "回退到这个 turn，编辑用户输入，然后让 Codex 重新运行。",
    "editTurn.cancel": "取消",
    "editTurn.regenerate": "重新生成",
    "editTurn.waitForTurn": "请等待当前 turn 结束后再重新生成。",
    "editTurn.empty": "请输入用于重新生成的提示词。",
    "editTurn.failed": "重新生成失败：{error}",
    "code.copy": "复制",
    "code.copied": "已复制",
    "code.copyFailed": "复制失败",
    "code.code": "代码",
    "code.output": "输出",
    "code.command": "命令",
    "code.error": "错误",
    "code.fileChanges": "文件更改",
    "code.noOutput": "没有输出",
    "code.line": "1 行",
    "code.lines": "{count} 行",
    "reasoning.title": "思考过程",
    "reasoning.ideaTitle": "思路：{title}",
    "reasoning.inProgress": "正在推理",
    "reasoning.waiting": "正在准备推理摘要...",
    "reasoning.active": "Codex 正在工作...",
    "reasoning.note": "1 条摘要",
    "reasoning.notes": "{count} 条摘要",
    "reasoning.noNotes": "无摘要",
    "reasoning.none": "没有收到可读推理摘要。",
    "context.compacted": "上下文已压缩",
    "context.compactedDetail": "较早的对话已被摘要，以便 Codex 继续保留更多可用空间。",
    "runtime.running": "工作中 {duration}",
    "runtime.waiting": "等待中 {duration}",
    "runtime.completed": "耗时 {duration}",
    "age.minute": "{count} 分钟",
    "age.hour": "{count} 小时",
    "age.day": "{count} 天",
    "age.month": "{count} 个月",
  },
};

const STATIC_TEXT = [
  ["#newChat span:last-child", "nav.newChat"],
  [".primary-nav .nav-item:nth-child(2) span:last-child", "nav.search"],
  [".primary-nav .nav-item:nth-child(3) span:last-child", "nav.plugins"],
  [".primary-nav .nav-item:nth-child(4) span:last-child", "nav.automations"],
  [".side-section:nth-of-type(1) .section-label", "sidebar.pinned"],
  [".projects-section .section-label", "sidebar.projects"],
  [".chats-section .section-label", "sidebar.chats"],
  ["#settingsButton span:last-child", "sidebar.settings"],
  [".commit-label", "top.commit"],
  ["#declineApproval", "approval.decline"],
  ["#acceptApproval", "approval.approve"],
  ["#startReview span:last-child", "review.review"],
  ["#revertAll", "review.revertAll"],
  ["#stageAll", "review.stageAll"],
  ["#authTitle", "auth.title"],
  ['[data-auth-tab="device"]', "auth.deviceCode"],
  ['[data-auth-tab="api"]', "auth.apiKey"],
  ["#startBrowserLogin", "auth.continueBrowser"],
  ["#startDeviceLogin", "auth.generateCode"],
  ["#openDeviceUrl", "auth.openPage"],
  ["#saveApiKey", "auth.saveApiKey"],
  ["#cancelLogin", "auth.cancelLogin"],
  ["#logoutButton", "auth.signOut"],
  ["#settingsTitle", "settings.title"],
  ['[data-settings-tab="general"]', "settings.general"],
  ['[data-settings-tab="configuration"]', "settings.configuration"],
  ['[data-settings-tab="personalization"]', "settings.personalization"],
  ['[data-settings-tab="mcp"]', "settings.mcp"],
  ['[data-settings-tab="usage"]', "settings.usage"],
  ['[data-settings-tab="plugins"]', "settings.plugins"],
  ['[data-settings-tab="appearance"]', "settings.appearance"],
  ["#settingsPaneGeneral .settings-row:nth-child(1) strong", "settings.language"],
  ["#settingsPaneGeneral .settings-row:nth-child(1) span", "settings.languageHelp"],
  ['#settingsLanguage option[value="auto"]', "settings.languageAuto"],
  ['#settingsLanguage option[value="en"]', "settings.languageEnglish"],
  ['#settingsLanguage option[value="zh-CN"]', "settings.languageChinese"],
  ["#settingsPaneGeneral .settings-row:nth-child(2) strong", "settings.requireCtrlEnter"],
  ["#settingsPaneGeneral .settings-row:nth-child(2) span", "settings.requireCtrlEnterHelp"],
  ["#settingsPaneGeneral .settings-row:nth-child(3) strong", "settings.speed"],
  ["#settingsPaneGeneral .settings-row:nth-child(3) span", "settings.speedHelp"],
  ['#settingsSpeed option[value="standard"]', "settings.speedStandard"],
  ['#settingsSpeed option[value="fast"]', "settings.speedFast"],
  ["#settingsPaneGeneral .settings-row:nth-child(4) strong", "settings.followUp"],
  ["#settingsPaneGeneral .settings-row:nth-child(4) span", "settings.followUpHelp"],
  ['#settingsFollowUpBehavior [data-value="queue"]', "settings.queue"],
  ['#settingsFollowUpBehavior [data-value="steer"]', "settings.steer"],
  ["#settingsPaneGeneral .settings-row:nth-child(5) strong", "settings.codeReview"],
  ["#settingsPaneGeneral .settings-row:nth-child(5) span", "settings.codeReviewHelp"],
  ['#settingsCodeReviewMode [data-value="inline"]', "settings.inline"],
  ['#settingsCodeReviewMode [data-value="detached"]', "settings.detached"],
  ["#settingsPaneConfiguration .settings-pane-heading strong", "settings.configuration"],
  ["#settingsConfigDocs", "settings.learnMore"],
  ["#settingsPaneConfiguration .settings-section-title", "settings.customConfig"],
  ["#settingsOpenConfig", "settings.openConfig"],
  ["#settingsPaneConfiguration .settings-row:nth-child(3) strong", "settings.licenses"],
  ["#settingsPaneConfiguration .settings-row:nth-child(3) span", "settings.licensesHelp"],
  ["#settingsViewLicenses", "settings.view"],
  ["#settingsPanePersonalization section:nth-child(1) .settings-row strong", "settings.personality"],
  ["#settingsPanePersonalization section:nth-child(1) .settings-row span", "settings.personalityHelp"],
  ['#settingsPersonality option[value="friendly"]', "settings.personalityFriendly"],
  ['#settingsPersonality option[value="pragmatic"]', "settings.personalityPragmatic"],
  ["#settingsPanePersonalization .loose-section .settings-section-title", "settings.customInstructions"],
  ["#settingsPanePersonalization .loose-section .settings-description", "settings.customInstructionsHelp"],
  ["#settingsSavePersonalization", "settings.save"],
  ["#settingsPanePersonalization section:nth-child(3) .settings-section-title", "settings.memory"],
  ["#settingsMemoryDocs", "settings.learnMore"],
  ["#settingsPanePersonalization section:nth-child(3) .settings-row:nth-of-type(1) strong", "settings.enableMemories"],
  ["#settingsPanePersonalization section:nth-child(3) .settings-row:nth-of-type(1) span", "settings.enableMemoriesHelp"],
  ["#settingsPanePersonalization section:nth-child(3) .settings-row:nth-of-type(2) .settings-label-text", "settings.skipToolMemories"],
  ["#settingsPanePersonalization section:nth-child(3) .settings-row:nth-of-type(2) .settings-status-pill", "settings.comingSoon"],
  ["#settingsPanePersonalization section:nth-child(3) .settings-row:nth-of-type(2) > div > span:not(.settings-status-pill)", "settings.skipToolMemoriesHelp"],
  ["#settingsPanePersonalization section:nth-child(3) .settings-row:nth-of-type(3) strong", "settings.resetMemories"],
  ["#settingsPanePersonalization section:nth-child(3) .settings-row:nth-of-type(3) span", "settings.resetMemoriesHelp"],
  ["#settingsResetMemories", "settings.reset"],
  ["#settingsPaneMcp .settings-pane-heading strong", "settings.mcp"],
  ["#settingsMcpDocs", "settings.learnMorePeriod"],
  ["#settingsPaneMcp .settings-section-title", "settings.servers"],
  ["#settingsPaneMcp .settings-row strong", "settings.addEditMcp"],
  ["#settingsPaneMcp .settings-row span", "settings.mcpConfigured"],
  ["#settingsAddMcpServer", "settings.addServer"],
  ["#settingsPaneUsage .settings-section:nth-child(1) .settings-section-title", "settings.account"],
  ["#settingsPaneUsage .settings-row:nth-child(2) strong", "settings.planUsage"],
  ["#settingsOpenUsage", "settings.viewUsage"],
  ["#settingsPaneUsage .settings-section:nth-child(4) .settings-section-title", "settings.localEnvironment"],
  ["#settingsChooseWorkspace", "settings.change"],
  ["#settingsPaneUsage .settings-section:nth-child(4) .runtime-row strong", "settings.codexBinary"],
  ["#settingsPanePlugins .settings-plugin-header > strong", "settings.pluginsHeader"],
  ["#settingsPluginBuiltBy option:nth-child(1)", "settings.builtByOpenAI"],
  ["#settingsPluginBuiltBy option:nth-child(2)", "settings.allBuilders"],
  ["#settingsPluginCategory option:nth-child(1)", "settings.all"],
  ["#settingsPluginCategory option:nth-child(2)", "settings.messaging"],
  ["#settingsPluginCategory option:nth-child(3)", "settings.files"],
  ["#settingsPluginCategory option:nth-child(4)", "settings.calendar"],
  [".settings-plugin-hero div span", "settings.slackPrompt"],
  ["#settingsTryPlugin", "settings.comingSoon"],
  ["#settingsPanePlugins .settings-section-title", "settings.featured"],
  ["#settingsPaneAppearance .settings-section-title", "settings.appearance"],
  ["#settingsPaneAppearance .toggle-row strong", "settings.fileDetailsPanel"],
  ["#settingsPaneAppearance .toggle-row span", "settings.openOnLaunch"],
  ["#settingsResetUi", "settings.resetUi"],
];

const STATIC_ATTRS = [
  ["html", "lang", null],
  [".primary-nav", "aria-label", "nav.main"],
  ["#chooseWorkspace", "aria-label", "settings.chooseWorkspace"],
  ["#refreshState", "aria-label", "review.refreshDiff"],
  ["#prompt", "placeholder", "composer.placeholder"],
  [".round-tool", "aria-label", "composer.addContext"],
  ["#effortButtons", "aria-label", "composer.reasoningEffort"],
  ["#permissionChoice", "aria-label", "permission.menu"],
  ["#modelChoice", "aria-label", "composer.model"],
  [".send-button", "aria-label", "composer.send"],
  ["#refreshGitTop", "aria-label", "review.refreshDiff"],
  [".review-top .icon-button:nth-child(3)", "aria-label", "review.newReview"],
  ["#closeReview", "aria-label", "review.closeDetails"],
  [".review-heading .small-icon", "aria-label", "review.more"],
  ["#openReview", "aria-label", "review.openDetails"],
  ["#closeAuth", "aria-label", "review.closeDetails"],
  ["#settingsModal", "aria-label", "settings.title"],
  ["#commitButton", "aria-label", "top.commit"],
  [".settings-tabs", "aria-label", "settings.sections"],
  ["#closeSettings", "aria-label", "review.closeDetails"],
  ["#settingsCustomInstructions", "placeholder", "settings.customInstructionsPlaceholder"],
  ["#settingsPluginSearch", "placeholder", "settings.searchPlugins"],
];

function currentLocale() {
  const language = state.uiConfig?.language || "auto";
  if (language === "en" || language === "zh-CN") {
    return language;
  }
  return (navigator.language || "").toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}

function t(key, params = {}) {
  const table = I18N[currentLocale()] || I18N.en;
  const template = table[key] || I18N.en[key] || key;
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, name) => String(params[name] ?? ""));
}

function applyLocale() {
  document.documentElement.lang = currentLocale();
  STATIC_TEXT.forEach(([selector, key]) => {
    document.querySelectorAll(selector).forEach((element) => {
      element.textContent = t(key);
    });
  });
  STATIC_ATTRS.forEach(([selector, attr, key]) => {
    const value = attr === "lang" ? currentLocale() : t(key);
    document.querySelectorAll(selector).forEach((element) => {
      element.setAttribute(attr, value);
    });
  });
  const configHeading = document.querySelector("#settingsPaneConfiguration .settings-pane-heading span");
  if (configHeading) {
    configHeading.childNodes[0].nodeValue = `${t("settings.configurationHelp")} `;
  }
  const memoryDescription = document.querySelector("#settingsPanePersonalization section:nth-child(3) .settings-description");
  if (memoryDescription) {
    memoryDescription.childNodes[0].nodeValue = `${t("settings.memoryHelp")} `;
  }
  const mcpHeading = document.querySelector("#settingsPaneMcp .settings-pane-heading span");
  if (mcpHeading) {
    mcpHeading.childNodes[0].nodeValue = `${t("settings.mcpHelp")} `;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function basename(value) {
  return String(value || "").split("/").filter(Boolean).pop() || value || "workspace";
}

function cleanTitleText(value) {
  return String(value || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[#*_>\-[\](){}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function summarizeTitle(value) {
  const cleaned = cleanTitleText(value)
    .replace(/^(please|can you|could you|i want you to|帮我|请你?|麻烦你?)\s*/i, "")
    .trim();
  if (!cleaned) {
    return "";
  }
  const sentence = cleaned.split(/(?<=[。！？!?])\s+|[。！？!?]\s*|\n/).find(Boolean) || cleaned;
  const words = sentence.split(/\s+/).filter(Boolean);
  if (words.length > 10 && !/[\u3400-\u9fff]/.test(sentence)) {
    return `${words.slice(0, 10).join(" ")}...`;
  }
  const chars = [...sentence];
  return chars.length > 42 ? `${chars.slice(0, 42).join("").trim()}...` : sentence;
}

function threadDisplayTitle(thread) {
  if (!thread) {
    return t("sidebar.untitled");
  }
  return summarizeTitle(thread.name || thread.title || thread.preview || thread.displayTitle) || t("sidebar.untitled");
}

function formatAge(timestamp) {
  if (!timestamp) {
    return "";
  }
  const seconds = Math.max(0, Math.floor(Date.now() / 1000 - timestamp));
  if (seconds < 3600) {
    return t("age.minute", { count: Math.max(1, Math.floor(seconds / 60)) });
  }
  if (seconds < 86400) {
    return t("age.hour", { count: Math.floor(seconds / 3600) });
  }
  if (seconds < 86400 * 30) {
    return t("age.day", { count: Math.floor(seconds / 86400) });
  }
  return t("age.month", { count: Math.floor(seconds / (86400 * 30)) });
}

function timestampToMs(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return numeric > 100_000_000_000 ? numeric : numeric * 1000;
}

function durationValue(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function turnRuntimeMeta(turn, { fallbackStartedAt = null } = {}) {
  const startedAt = timestampToMs(turn?.startedAt) || fallbackStartedAt || null;
  const completedAt = timestampToMs(turn?.completedAt);
  const durationMs = durationValue(turn?.durationMs) ?? (startedAt && completedAt ? completedAt - startedAt : null);
  return {
    turnStartedAt: startedAt,
    turnCompletedAt: completedAt,
    turnDurationMs: durationMs,
  };
}

function applyTurnRuntime(message, meta = {}) {
  if (!message) {
    return message;
  }
  if (meta.turnStartedAt && !message.turnStartedAt) {
    message.turnStartedAt = meta.turnStartedAt;
  }
  if (meta.turnCompletedAt) {
    message.turnCompletedAt = meta.turnCompletedAt;
  }
  const durationMs = durationValue(meta.turnDurationMs);
  if (durationMs !== null) {
    message.turnDurationMs = durationMs;
  }
  if (message.turnId) {
    delete message.queuedAt;
  }
  message.updatedAt = Date.now();
  return message;
}

function applyTurnRuntimeToMessages(turnId, meta = {}) {
  if (!turnId) {
    return;
  }
  state.messages.forEach((message) => {
    if (message.turnId === turnId) {
      applyTurnRuntime(message, meta);
    }
  });
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  if (minutes > 0) {
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }
  return `${seconds}s`;
}

function runtimeDescriptor(message) {
  if (!message) {
    return { label: "", live: false, waiting: false };
  }
  const now = Date.now();
  const queuedAt = timestampToMs(message.queuedAt);
  if (!message.turnId && queuedAt) {
    return {
      label: t("runtime.waiting", { duration: formatDuration(now - queuedAt) }),
      live: true,
      waiting: true,
    };
  }

  const startedAt = timestampToMs(message.turnStartedAt || message.startedAt);
  const completedAt = timestampToMs(message.turnCompletedAt || message.completedAt);
  let durationMs =
    durationValue(message.turnDurationMs) ?? durationValue(message.durationMs) ?? durationValue(message.itemDurationMs);
  if (durationMs === null && startedAt && completedAt) {
    durationMs = completedAt - startedAt;
  }
  if (message.turnId && state.currentTurnId === message.turnId && !completedAt && startedAt) {
    return {
      label: t("runtime.running", { duration: formatDuration(now - startedAt) }),
      live: true,
      waiting: false,
    };
  }
  if (durationMs !== null) {
    return {
      label: t("runtime.completed", { duration: formatDuration(durationMs) }),
      live: false,
      waiting: false,
    };
  }
  return { label: "", live: false, waiting: false };
}

function hasLiveRuntime() {
  return state.messages.some((message) => runtimeDescriptor(message).live);
}

function refreshRuntimeLabels() {
  els.conversation.querySelectorAll("[data-message-runtime-index]").forEach((node) => {
    const index = Number.parseInt(node.dataset.messageRuntimeIndex || "-1", 10);
    const descriptor = runtimeDescriptor(state.messages[index]);
    node.textContent = descriptor.label;
    node.classList.toggle("hidden", !descriptor.label);
    node.classList.toggle("is-live", descriptor.live);
    node.classList.toggle("is-waiting", descriptor.waiting);
  });
  syncRuntimeTicker();
}

function syncRuntimeTicker() {
  if (hasLiveRuntime()) {
    if (!runtimeTickerId) {
      runtimeTickerId = setInterval(refreshRuntimeLabels, 1000);
    }
    return;
  }
  if (runtimeTickerId) {
    clearInterval(runtimeTickerId);
    runtimeTickerId = null;
  }
}

function renderAll() {
  renderSidebar();
  renderHeader();
  renderModelControls();
  renderPermissionControls();
  renderConversation();
  renderGit();
  renderSettings();
  renderEditTurnDialog();
  renderAuth();
  renderReviewVisibility();
}

function normalizeThreadForList(thread) {
  const now = Math.floor(Date.now() / 1000);
  return {
    ...thread,
    preview: thread.preview || thread.name || t("nav.newChat"),
    displayTitle: threadDisplayTitle(thread),
    createdAt: thread.createdAt || now,
    updatedAt: thread.updatedAt || thread.createdAt || now,
  };
}

function upsertThread(thread, { optimistic = false } = {}) {
  if (!thread?.id) {
    return;
  }
  const normalized = normalizeThreadForList(thread);
  state.threads = [normalized, ...state.threads.filter((item) => item.id !== normalized.id)];
  if (optimistic) {
    state.optimisticThreads = [normalized, ...state.optimisticThreads.filter((item) => item.id !== normalized.id)];
  }
}

function mergeOptimisticThreads(threads) {
  const serverThreads = Array.isArray(threads) ? threads : [];
  const serverIds = new Set(serverThreads.map((thread) => thread.id));
  const pending = state.optimisticThreads.filter((thread) => !serverIds.has(thread.id) && threadBelongsToWorkspace(thread));
  state.optimisticThreads = pending;
  return [...pending, ...serverThreads];
}

function normalizedWorkspacePath(value) {
  return String(value || "").replace(/\\/g, "/").replace(/\/+$/, "");
}

function threadBelongsToWorkspace(thread) {
  if (!thread?.cwd || !state.workspace || state.workspaceIsFallback) {
    return true;
  }
  return normalizedWorkspacePath(thread.cwd) === normalizedWorkspacePath(state.workspace);
}

function resetActiveThreadForWorkspaceSwitch(workspace) {
  state.workspace = workspace;
  state.currentThread = null;
  state.currentTurnId = null;
  state.draftThreadId = null;
  state.threadTitle = "";
  state.messages = [];
  state.queuedFollowUps = [];
  state.optimisticThreads = [];
}

function applyThreadTitle(threadId, title) {
  if (!threadId || !title) {
    return;
  }
  const apply = (thread) => {
    if (thread.id !== threadId) {
      return thread;
    }
    return normalizeThreadForList({ ...thread, name: title, preview: thread.preview || title });
  };
  state.threads = state.threads.map(apply);
  state.optimisticThreads = state.optimisticThreads.map(apply);
  if (state.currentThread?.id === threadId) {
    state.currentThread = { ...state.currentThread, name: title, preview: state.currentThread.preview || title };
    state.threadTitle = summarizeTitle(title);
  }
}

function renderSidebar() {
  const visibleThreads = state.threads;
  const pinnedThreadSet = new Set(pinnedThreadIds());
  const pinnedProjectSet = new Set(pinnedProjectPaths());
  const pinnedThreads = visibleThreads.filter((thread) => pinnedThreadSet.has(thread.id));
  const pinnedProjects = state.projects.filter((project) => pinnedProjectSet.has(project.path));
  const chatThreads = visibleThreads.filter((thread) => !pinnedThreadSet.has(thread.id));
  const projectRows = state.projects.filter((project) => !pinnedProjectSet.has(project.path));

  els.pinnedThreads.innerHTML = [...pinnedThreads.map((thread) => threadButton(thread, true)), ...pinnedProjects.map(projectButton)]
    .join("") || `<div class="row-button"><span class="label">${escapeHtml(t("sidebar.noPinned"))}</span></div>`;
  els.threads.innerHTML = chatThreads.length
    ? chatThreads.map((thread) => threadButton(thread, false)).join("")
    : `<div class="row-button"><span class="label">${escapeHtml(t("sidebar.noChats"))}</span></div>`;
  els.projects.innerHTML = projectRows.length
    ? projectRows.map(projectButton).join("")
    : `<div class="row-button"><span class="label">${escapeHtml(t("sidebar.noProjects"))}</span></div>`;

  document.querySelectorAll("[data-thread]").forEach((button) => {
    button.addEventListener("click", async () => {
      await discardEmptyDraftThreadIfNeeded(button.dataset.thread);
      const thread = await window.codexDesktop.resumeThread(button.dataset.thread);
      state.currentThread = thread;
      state.draftThreadId = null;
      state.messages = threadToMessages(thread);
      state.threadTitle = threadDisplayTitle(thread);
      renderAll();
    });
    button.addEventListener("contextmenu", (event) => {
      const thread = state.threads.find((item) => item.id === button.dataset.thread);
      if (thread) {
        showThreadContextMenu(event, thread);
      }
    });
  });
  document.querySelectorAll("[data-project]").forEach((button) => {
    button.addEventListener("click", async () => {
      await discardEmptyDraftThreadIfNeeded();
      const workspace = await window.codexDesktop.openWorkspace(button.dataset.project);
      if (workspace) {
        resetActiveThreadForWorkspaceSwitch(workspace);
        await refreshState();
      }
    });
    button.addEventListener("contextmenu", (event) => {
      const project = state.projects.find((item) => item.path === button.dataset.project);
      if (project) {
        showProjectContextMenu(event, project);
      }
    });
  });
}

function removeThreadFromLocalLists(threadId) {
  state.threads = state.threads.filter((thread) => thread.id !== threadId);
  state.optimisticThreads = state.optimisticThreads.filter((thread) => thread.id !== threadId);
}

async function discardEmptyDraftThreadIfNeeded(nextThreadId = null) {
  const draftThreadId = state.draftThreadId;
  if (
    !draftThreadId ||
    draftThreadId === nextThreadId ||
    state.currentThread?.id !== draftThreadId ||
    state.currentTurnId ||
    state.messages.length > 0 ||
    els.prompt.value.trim()
  ) {
    return false;
  }

  state.draftThreadId = null;
  removeThreadFromLocalLists(draftThreadId);
  renderSidebar();
  try {
    await window.codexDesktop.archiveThread(draftThreadId);
  } catch (error) {
    els.serverStatus.textContent = error.message;
  }
  return true;
}

function pinnedThreadIds() {
  return Array.isArray(state.uiConfig?.pinnedThreadIds) ? state.uiConfig.pinnedThreadIds : [];
}

function pinnedProjectPaths() {
  return Array.isArray(state.uiConfig?.pinnedProjectPaths) ? state.uiConfig.pinnedProjectPaths : [];
}

function threadButton(thread, pinned) {
  const active = state.currentThread && state.currentThread.id === thread.id;
  return `
    <button class="row-button ${active ? "active" : ""}" data-thread="${escapeHtml(thread.id)}" data-pinned="${pinned ? "true" : "false"}">
      <span class="icon ${pinned ? "review" : "pen"}"></span>
      <span class="label">${escapeHtml(threadDisplayTitle(thread))}</span>
      <span class="age">${formatAge(thread.updatedAt || thread.createdAt)}</span>
    </button>
  `;
}

function projectButton(project) {
  return `
    <button class="row-button ${project.active ? "active" : ""}" data-project="${escapeHtml(project.path)}">
      <span class="icon folder-add"></span>
      <span class="label">${escapeHtml(project.name)}</span>
    </button>
  `;
}

function renderHeader() {
  const workspaceLabel = state.workspaceIsFallback ? t("workspace.chooseProject") : basename(state.workspace);
  els.workspaceName.textContent = workspaceLabel;
  els.threadTitle.textContent =
    state.threadTitle || (state.currentThread ? threadDisplayTitle(state.currentThread) : "Codex");
  els.branchName.textContent = state.git.branch || t("workspace.noGit");
  els.emptyTitle.textContent = state.workspaceIsFallback
    ? t("empty.chooseProject")
    : t("empty.whatBuild", { workspace: basename(state.workspace) });
  els.serverStatus.textContent = state.serverReady ? t("status.connected") : t("status.offline");
  if (state.account?.account?.type === "chatgpt") {
    els.serverStatus.textContent = state.account.account.email;
  }
  els.emptySubtitle.textContent = state.workspaceIsFallback
    ? t("empty.openFolder")
    : state.serverReady
      ? state.workspace
      : t("status.appServerDisconnected");
}

function accountLabel() {
  const account = state.account?.account;
  if (!account) {
    return t("top.signIn");
  }
  if (account.type === "chatgpt") {
    return account.email;
  }
  if (account.type === "apiKey") {
    return t("auth.apiKey");
  }
  return account.type;
}

function renderAuth() {
  const account = state.account?.account;
  const isSignedIn = Boolean(account);
  els.authButtonLabel.textContent = accountLabel();
  els.authModal.classList.toggle("signed-in", isSignedIn);
  if (isSignedIn) {
    document.querySelectorAll("[data-auth-tab]").forEach((node) => node.classList.toggle("active", node.dataset.authTab === "browser"));
    document.querySelectorAll(".auth-pane").forEach((node) => node.classList.toggle("active", node.id === "authPaneBrowser"));
  }
  if (account?.type === "chatgpt") {
    els.authAccountStatus.textContent = `${account.email} · ${account.planType || "ChatGPT"}`;
  } else if (account?.type === "apiKey") {
    els.authAccountStatus.textContent = t("auth.signedInApi");
  } else if (state.account?.requiresOpenaiAuth) {
    els.authAccountStatus.textContent = t("auth.required");
  } else {
    els.authAccountStatus.textContent = t("auth.noneRequired");
  }

  if (els.authSignedIn) {
    els.authSignedIn.innerHTML = isSignedIn
      ? `<strong>${escapeHtml(t("auth.signedInTitle"))}</strong><span>${escapeHtml(t("auth.signedInHelp"))}</span>`
      : "";
  }
  document.querySelectorAll("[data-auth-tab]").forEach((tab) => {
    tab.disabled = isSignedIn;
  });
  setElementDisabled(document.getElementById("startBrowserLogin"), isSignedIn || Boolean(state.authLogin?.loginId));
  setElementDisabled(document.getElementById("startDeviceLogin"), isSignedIn || Boolean(state.authLogin?.loginId));
  setElementDisabled(document.getElementById("saveApiKey"), isSignedIn);
  setElementDisabled(els.apiKeyInput, isSignedIn);
  setElementDisabled(els.cancelLogin, isSignedIn || !state.authLogin?.loginId);
  setElementDisabled(document.getElementById("logoutButton"), !isSignedIn);
}

function renderSettings() {
  const account = state.account?.account;
  const selected = selectedModelInfo();
  renderSettingsTabs();
  renderGeneralSettings();
  renderConfigSettings();
  renderPersonalizationSettings();
  renderMcpSettings();
  renderUsageSettings(account);
  renderPluginSettings();
  renderAppearanceSettings(selected);
  if (els.settingsVersion) {
    els.settingsVersion.textContent = `Codex Desktop ${state.version || ""}`;
  }
  applyLocale();
}

function uiConfigValue(key, fallback) {
  const value = state.uiConfig?.[key];
  return value === undefined || value === null || value === "" ? fallback : value;
}

function renderGeneralSettings() {
  setElementValue(els.settingsLanguage, uiConfigValue("language", "auto"));
  setElementChecked(els.settingsRequireCtrlEnter, Boolean(state.uiConfig?.requireCtrlEnterForLongPrompts));
  setElementValue(els.settingsSpeed, uiConfigValue("speed", "standard"));
  renderSegmentedSetting(els.settingsFollowUpBehavior, uiConfigValue("followUpBehavior", "queue"));
  renderSegmentedSetting(els.settingsCodeReviewMode, uiConfigValue("codeReviewMode", "inline"));
}

function renderPersonalizationSettings() {
  setElementValue(els.settingsPersonality, uiConfigValue("personality", "pragmatic"));
  setElementValue(els.settingsCustomInstructions, uiConfigValue("customInstructions", ""));
  setElementChecked(els.settingsEnableMemories, Boolean(state.uiConfig?.memoriesEnabled));
  setElementChecked(els.settingsSkipToolMemories, Boolean(state.uiConfig?.skipToolAssistedMemories));
  setElementDisabled(els.settingsSkipToolMemories, true);
}

function renderUsageSettings(account) {
  renderUsageLabels();
  if (els.settingsAccount) {
    els.settingsAccount.textContent = accountLabel();
  }
  if (els.settingsAccountDetail) {
    if (account?.type === "chatgpt") {
      els.settingsAccountDetail.textContent = account.planType || "ChatGPT";
    } else if (account?.type === "apiKey") {
      els.settingsAccountDetail.textContent = t("auth.apiKey");
    } else if (state.account?.requiresOpenaiAuth) {
      els.settingsAccountDetail.textContent = t("auth.required");
    } else {
      els.settingsAccountDetail.textContent = t("auth.noneRequired");
    }
  }
  if (els.settingsUsageDetail) {
    els.settingsUsageDetail.textContent = account ? t("settings.usageSignedIn") : t("settings.usageSignedOut");
  }
  if (els.settingsRefreshUsage) {
    els.settingsRefreshUsage.textContent = t("settings.refreshUsage");
    els.settingsRefreshUsage.disabled = state.rateLimitsLoading || account?.type !== "chatgpt";
  }
  renderRateLimitSettings(account);
  renderTokenUsageSettings();
  if (els.settingsWorkspaceName) {
    els.settingsWorkspaceName.textContent = state.workspaceIsFallback ? t("settings.noProject") : basename(state.workspace);
  }
  if (els.settingsWorkspacePath) {
    els.settingsWorkspacePath.textContent = state.workspaceIsFallback ? t("settings.chooseWorkspace") : state.workspace || "";
  }
  if (els.settingsCodexBin) {
    els.settingsCodexBin.textContent = state.codexBin || "codex";
  }
  if (els.settingsOpenAuth) {
    els.settingsOpenAuth.textContent = account ? t("settings.manage") : t("top.signIn");
  }
  if (els.settingsLogout) {
    els.settingsLogout.disabled = !account;
  }
}

function renderUsageLabels() {
  if (els.settingsRateLimitTitle) {
    els.settingsRateLimitTitle.textContent = t("settings.rateLimits");
  }
  if (els.settingsTokenUsageTitle) {
    els.settingsTokenUsageTitle.textContent = t("settings.currentChatTokens");
  }
  if (els.settingsContextUsageLabel) {
    els.settingsContextUsageLabel.textContent = t("settings.contextWindow");
  }
  if (els.settingsTokenTotalLabel) {
    els.settingsTokenTotalLabel.textContent = t("settings.total");
  }
  if (els.settingsTokenInputLabel) {
    els.settingsTokenInputLabel.textContent = t("settings.input");
  }
  if (els.settingsTokenOutputLabel) {
    els.settingsTokenOutputLabel.textContent = t("settings.output");
  }
  if (els.settingsTokenReasoningLabel) {
    els.settingsTokenReasoningLabel.textContent = t("settings.reasoning");
  }
}

function renderRateLimitSettings(account) {
  if (!els.settingsRateLimitStatus || !els.settingsRateLimitCards) {
    return;
  }
  if (!account) {
    els.settingsRateLimitStatus.textContent = t("settings.usageSignedOut");
    els.settingsRateLimitCards.innerHTML = "";
    return;
  }
  if (account.type !== "chatgpt") {
    els.settingsRateLimitStatus.textContent = t("settings.rateLimitsUnavailable");
    els.settingsRateLimitCards.innerHTML = "";
    return;
  }
  if (state.rateLimitsLoading) {
    els.settingsRateLimitStatus.textContent = t("settings.rateLimitsLoading");
  } else if (state.rateLimitsError) {
    els.settingsRateLimitStatus.textContent = t("settings.rateLimitsError", { error: state.rateLimitsError });
  } else if (state.rateLimitsLoadedAt) {
    els.settingsRateLimitStatus.textContent = t("settings.rateLimitsUpdated", {
      time: new Date(state.rateLimitsLoadedAt).toLocaleTimeString(),
    });
  } else {
    els.settingsRateLimitStatus.textContent = t("settings.rateLimitsLoading");
  }

  const snapshots = rateLimitSnapshots();
  els.settingsRateLimitCards.innerHTML = snapshots.length
    ? snapshots.map(renderRateLimitCard).join("")
    : `<div class="settings-empty">${escapeHtml(t("settings.rateLimitsUnavailable"))}</div>`;
}

function renderTokenUsageSettings() {
  const usage = currentThreadTokenUsage();
  const total = usage?.total || emptyTokenUsage();
  const last = usage?.last || emptyTokenUsage();
  if (els.settingsTokenUsageStatus) {
    els.settingsTokenUsageStatus.textContent = usage ? t("settings.tokenUsageLive") : t("settings.tokenUsageEmpty");
  }
  if (els.settingsTokenTotal) {
    els.settingsTokenTotal.textContent = formatCount(total.totalTokens);
  }
  if (els.settingsTokenInput) {
    els.settingsTokenInput.textContent = formatCount(total.inputTokens);
  }
  if (els.settingsTokenOutput) {
    els.settingsTokenOutput.textContent = formatCount(total.outputTokens);
  }
  if (els.settingsTokenReasoning) {
    els.settingsTokenReasoning.textContent = formatCount(total.reasoningOutputTokens);
  }
  renderContextUsage(usage);
  if (els.settingsTokenLastTurn) {
    els.settingsTokenLastTurn.innerHTML = usage
      ? `
        <strong>${escapeHtml(t("settings.lastTurn"))}</strong>
        <span>${escapeHtml(tokenBreakdownText(last))}</span>
      `
      : "";
  }
}

function renderContextUsage(usage) {
  const totalTokens = usage?.total?.totalTokens || 0;
  const contextWindow = usage?.modelContextWindow || 0;
  const percent = contextWindow > 0 ? Math.min(100, Math.max(0, (totalTokens / contextWindow) * 100)) : 0;
  if (els.settingsContextUsageBar) {
    els.settingsContextUsageBar.style.width = `${percent}%`;
  }
  if (els.settingsContextUsageDetail) {
    els.settingsContextUsageDetail.textContent =
      contextWindow > 0
        ? `${formatCount(totalTokens)} / ${formatCount(contextWindow)} (${Math.round(percent)}%)`
        : t("settings.contextWindowUnknown");
  }
}

function emptyTokenUsage() {
  return {
    totalTokens: 0,
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    reasoningOutputTokens: 0,
  };
}

function currentThreadTokenUsage() {
  const threadId = state.currentThread?.id;
  return threadId ? state.threadTokenUsageById[threadId] || null : null;
}

function formatCount(value) {
  return Number(value || 0).toLocaleString();
}

function tokenBreakdownText(usage) {
  const breakdown = usage || emptyTokenUsage();
  return [
    `${t("settings.total")} ${formatCount(breakdown.totalTokens)}`,
    `${t("settings.input")} ${formatCount(breakdown.inputTokens)}`,
    `${t("settings.cached")} ${formatCount(breakdown.cachedInputTokens)}`,
    `${t("settings.output")} ${formatCount(breakdown.outputTokens)}`,
    `${t("settings.reasoning")} ${formatCount(breakdown.reasoningOutputTokens)}`,
  ].join(" · ");
}

function rateLimitSnapshots() {
  const rateLimits = state.rateLimits || {};
  const byLimitId = rateLimits.rateLimitsByLimitId || null;
  if (byLimitId && typeof byLimitId === "object") {
    return Object.entries(byLimitId)
      .map(([id, snapshot]) => ({ id, snapshot }))
      .filter((entry) => entry.snapshot);
  }
  return rateLimits.rateLimits ? [{ id: rateLimits.rateLimits.limitId || "default", snapshot: rateLimits.rateLimits }] : [];
}

function renderRateLimitCard({ id, snapshot }) {
  const title = snapshot.limitName || snapshot.limitId || id || "Codex";
  const plan = snapshot.planType ? `<span>${escapeHtml(String(snapshot.planType))}</span>` : "";
  const reached = snapshot.rateLimitReachedType
    ? `<div class="usage-warning">${escapeHtml(t("settings.rateLimitReached", { type: snapshot.rateLimitReachedType }))}</div>`
    : "";
  const credits = snapshot.credits ? renderCredits(snapshot.credits) : "";
  return `
    <article class="usage-limit-card">
      <div class="usage-limit-heading">
        <strong>${escapeHtml(title)}</strong>
        ${plan}
      </div>
      ${renderRateLimitWindow(t("settings.primary"), snapshot.primary)}
      ${renderRateLimitWindow(t("settings.secondary"), snapshot.secondary)}
      ${credits}
      ${reached}
    </article>
  `;
}

function renderRateLimitWindow(name, windowInfo) {
  if (!windowInfo) {
    return "";
  }
  const percent = Math.max(0, Math.min(100, Number(windowInfo.usedPercent || 0)));
  const reset = windowInfo.resetsAt
    ? t("settings.rateLimitReset", { time: formatResetTime(windowInfo.resetsAt) })
    : t("settings.rateLimitNoReset");
  const duration = windowInfo.windowDurationMins ? `${windowInfo.windowDurationMins}m` : "";
  return `
    <div class="usage-window">
      <div class="usage-meter-row">
        <span>${escapeHtml(t("settings.rateLimitWindow", { name }))}${duration ? ` · ${escapeHtml(duration)}` : ""}</span>
        <span>${Math.round(percent)}%</span>
      </div>
      <div class="usage-progress" aria-hidden="true"><span style="width: ${percent}%"></span></div>
      <div class="usage-subtle">${escapeHtml(reset)}</div>
    </div>
  `;
}

function renderCredits(credits) {
  let label = t("settings.creditsUnavailable");
  if (credits.unlimited) {
    label = t("settings.creditsUnlimited");
  } else if (credits.hasCredits) {
    label = credits.balance ? `${t("settings.creditsAvailable")}: ${credits.balance}` : t("settings.creditsAvailable");
  }
  return `
    <div class="usage-credits">
      <span>${escapeHtml(t("settings.credits"))}</span>
      <strong>${escapeHtml(label)}</strong>
    </div>
  `;
}

function formatResetTime(timestamp) {
  const ms = timestampToMs(timestamp);
  if (!ms) {
    return "";
  }
  return new Date(ms).toLocaleString();
}

function renderAppearanceSettings(selected) {
  setElementChecked(els.settingsReviewOpen, state.reviewOpen);
  if (els.settingsModel) {
    els.settingsModel.textContent = selected?.displayName || selected?.model || t("settings.modelSelector");
  }
  if (els.settingsEffort) {
    els.settingsEffort.textContent = effortLabel(state.selectedEffort || defaultEffortFor(selected, supportedEffortsFor(selected)));
  }
}

function renderSegmentedSetting(container, value) {
  container?.querySelectorAll("button[data-value]").forEach((button) => {
    button.classList.toggle("active", button.dataset.value === value);
  });
}

function setElementValue(element, value) {
  if (element) {
    element.value = value;
  }
}

function setElementChecked(element, value) {
  if (element) {
    element.checked = Boolean(value);
  }
}

function setElementDisabled(element, value) {
  if (element) {
    element.disabled = Boolean(value);
  }
}

function renderSettingsTabs() {
  document.querySelectorAll("[data-settings-tab]").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.settingsTab === state.settingsTab);
  });
  document.querySelectorAll(".settings-pane").forEach((pane) => {
    pane.classList.toggle("active", pane.id === `settingsPane${capitalize(state.settingsTab)}`);
  });
}

function renderConfigSettings() {
  const config = state.configRead?.config || {};
  const userFile = userConfigFile();
  if (els.settingsConfigPath) {
    els.settingsConfigPath.textContent = userFile ? basename(userFile) : "config.toml";
  }
  if (!els.settingsConfigStatus) {
    return;
  }
  if (state.configLoading) {
    els.settingsConfigStatus.textContent = t("settings.loadingConfig");
  } else if (state.configError) {
    els.settingsConfigStatus.textContent = state.configError;
  } else if (state.configSaveMessage) {
    els.settingsConfigStatus.textContent = state.configSaveMessage;
  } else {
    els.settingsConfigStatus.textContent =
      userFile || t("settings.configStatusDefault");
  }
  if (els.settingsRefreshConfig) {
    els.settingsRefreshConfig.disabled = state.configLoading;
  }
  if (els.settingsSaveConfig) {
    els.settingsSaveConfig.disabled = state.configLoading;
  }

  setConfigField("model", els.settingsConfigModel, els.settingsConfigModelOrigin, config.model);
  setConfigField(
    "model_reasoning_effort",
    els.settingsConfigEffort,
    els.settingsConfigEffortOrigin,
    config.model_reasoning_effort,
  );
  setConfigField("approval_policy", els.settingsConfigApproval, els.settingsConfigApprovalOrigin, config.approval_policy);
  setConfigField("sandbox_mode", els.settingsConfigSandbox, els.settingsConfigSandboxOrigin, config.sandbox_mode);
  setConfigField("web_search", els.settingsConfigWebSearch, els.settingsConfigWebSearchOrigin, config.web_search);
  setConfigField("model_verbosity", els.settingsConfigVerbosity, els.settingsConfigVerbosityOrigin, config.model_verbosity);
  setConfigField(
    "model_reasoning_summary",
    els.settingsConfigSummary,
    els.settingsConfigSummaryOrigin,
    config.model_reasoning_summary,
  );
  setConfigField("service_tier", els.settingsConfigServiceTier, els.settingsConfigServiceTierOrigin, config.service_tier);

  if (els.settingsRawConfig) {
    els.settingsRawConfig.textContent = state.configRead ? configPreview(config) : t("settings.configWillAppear");
  }
  if (els.settingsConfigLayers) {
    els.settingsConfigLayers.innerHTML = renderConfigLayers();
  }
}

function renderMcpSettings() {
  if (!els.settingsMcpServers) {
    return;
  }
  if (state.configLoading) {
    els.settingsMcpServers.innerHTML = `<div class="settings-empty">${escapeHtml(t("settings.loadingMcp"))}</div>`;
    return;
  }
  const servers = configuredMcpServers(state.configRead?.config || {});
  if (!servers.length) {
    els.settingsMcpServers.innerHTML = `<div class="settings-empty">${escapeHtml(t("settings.noMcp"))}</div>`;
    return;
  }
  els.settingsMcpServers.innerHTML = servers
    .map(
      (server) => `
        <div class="settings-layer">
          <strong>${escapeHtml(server.name)}</strong>
          <span>${escapeHtml(server.description)}</span>
        </div>
      `,
    )
    .join("");
}

function configuredMcpServers(config) {
  const rawServers = config?.mcp_servers || config?.mcpServers || {};
  if (!rawServers || typeof rawServers !== "object" || Array.isArray(rawServers)) {
    return [];
  }
  return Object.entries(rawServers).map(([name, value]) => {
    const server = value && typeof value === "object" ? value : {};
    const transport = server.command || server.url || server.transport || t("settings.configuredInToml");
    const disabled = server.enabled === false ? `${t("settings.disabled")} · ` : "";
    return {
      name,
      description: `${disabled}${transport}`,
    };
  });
}

function renderPluginSettings() {
  if (!els.settingsPluginList) {
    return;
  }
  setElementDisabled(els.settingsPluginSearch, true);
  setElementDisabled(els.settingsPluginBuiltBy, true);
  setElementDisabled(els.settingsPluginCategory, true);
  setElementDisabled(document.getElementById("settingsTryPlugin"), true);
  const plugins = [
    { name: "GitHub", description: t("settings.pluginGithub") },
    { name: "Slack", description: t("settings.pluginSlack") },
    { name: "Notion", description: t("settings.pluginNotion") },
    { name: "Google Drive", description: t("settings.pluginGoogleDrive") },
  ];
  els.settingsPluginList.innerHTML = `
    <div class="settings-empty settings-coming-soon">${escapeHtml(t("settings.pluginsComingSoon"))}</div>
    ${plugins
      .map(
        (plugin) => `
          <div class="settings-plugin-item unavailable">
            <div>
              <strong>${escapeHtml(plugin.name)}</strong>
              <span>${escapeHtml(plugin.description)}</span>
            </div>
            <button type="button" disabled aria-label="${escapeHtml(t("settings.addPlugin", { plugin: plugin.name }))}">${escapeHtml(t("settings.comingSoon"))}</button>
          </div>
        `,
      )
      .join("")}
  `;
}

function setConfigField(key, input, originElement, value) {
  if (!input) {
    return;
  }
  if (input.tagName === "SELECT") {
    const stringValue = typeof value === "string" ? value : value == null ? "" : "__custom";
    input.value = [...input.options].some((option) => option.value === stringValue) ? stringValue : "";
  } else {
    input.value = typeof value === "string" ? value : "";
  }
  if (originElement) {
    originElement.textContent = originLabel(key);
  }
}

function originLabel(key) {
  const origin = state.configRead?.origins?.[key];
  if (!origin) {
    return t("config.notSet");
  }
  return t("config.from", { source: configLayerLabel(origin.name) });
}

function userConfigFile() {
  const layers = state.configRead?.layers || [];
  const userLayer = layers.find((layer) => layer.name?.type === "user");
  return userLayer?.name?.file || null;
}

function configLayerLabel(source) {
  if (!source) {
    return t("config.unknown");
  }
  if (source.type === "user") {
    return t("config.user");
  }
  if (source.type === "system") {
    return t("config.system");
  }
  if (source.type === "project") {
    return t("config.project");
  }
  if (source.type === "sessionFlags") {
    return t("config.sessionFlags");
  }
  if (source.type === "legacyManagedConfigTomlFromFile") {
    return t("config.managed");
  }
  if (source.type === "legacyManagedConfigTomlFromMdm") {
    return t("config.managedPrefs");
  }
  if (source.type === "mdm") {
    return "MDM";
  }
  return source.type || "unknown";
}

function configLayerPath(source) {
  if (!source) {
    return "";
  }
  if (source.file) {
    return source.file;
  }
  if (source.dotCodexFolder) {
    return `${source.dotCodexFolder}/config.toml`;
  }
  if (source.domain || source.key) {
    return [source.domain, source.key].filter(Boolean).join(" / ");
  }
  return "";
}

function renderConfigLayers() {
  const layers = state.configRead?.layers || [];
  if (!layers.length) {
    return `<div class="settings-empty">${escapeHtml(t("settings.noConfigLayers"))}</div>`;
  }
  return layers
    .map((layer) => {
      const label = configLayerLabel(layer.name);
      const sourcePath = configLayerPath(layer.name);
      const disabled = layer.disabledReason ? `<span>${escapeHtml(layer.disabledReason)}</span>` : "";
      return `
        <div class="settings-layer">
          <strong>${escapeHtml(label)}</strong>
          <span>${escapeHtml(sourcePath || layer.version || "")}</span>
          ${disabled}
        </div>
      `;
    })
    .join("");
}

function configPreview(config) {
  const entries = Object.entries(config || {}).filter(([, value]) => !isConfigPreviewEmpty(value));
  if (!entries.length) {
    return t("settings.noConfigValues");
  }
  return entries
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key} = ${tomlPreviewValue(value)}`)
    .join("\n");
}

function tomlPreviewValue(value) {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value, null, 2).replace(/\n/g, "\n  ");
}

function isConfigPreviewEmpty(value) {
  if (value == null) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === "object") {
    return Object.keys(value).length === 0;
  }
  return false;
}

function capitalize(value) {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

function availableModels() {
  return Array.isArray(state.models) ? state.models.filter((model) => !model.hidden) : [];
}

function supportedEffortsFor(model) {
  const efforts = (model?.supportedReasoningEfforts || [])
    .map((effort) => (typeof effort === "string" ? effort : effort.reasoningEffort))
    .filter(Boolean);
  return efforts.length ? efforts : ["low", "medium", "high", "xhigh"];
}

function defaultEffortFor(model, efforts) {
  if (model?.defaultReasoningEffort && efforts.includes(model.defaultReasoningEffort)) {
    return model.defaultReasoningEffort;
  }
  if (efforts.includes("high")) {
    return "high";
  }
  return efforts[0] || "medium";
}

function selectedModelInfo() {
  const models = availableModels();
  return (
    models.find((model) => model.model === state.selectedModel) ||
    models.find((model) => model.isDefault) ||
    models[0] ||
    null
  );
}

function syncModelSelection() {
  const model = selectedModelInfo();
  if (model && state.selectedModel !== model.model) {
    state.selectedModel = model.model;
    saveUiConfig({ selectedModel: state.selectedModel });
  }
  if (!model && state.selectedModel) {
    state.selectedModel = "";
    saveUiConfig({ selectedModel: "" });
  }

  const efforts = supportedEffortsFor(model);
  if (!state.selectedEffort || !efforts.includes(state.selectedEffort)) {
    state.selectedEffort = defaultEffortFor(model, efforts);
    saveUiConfig({ selectedEffort: state.selectedEffort });
  }
}

function compactModelLabel(model) {
  const name = model?.displayName || model?.model || "";
  return name
    .replace(/^gpt-?/i, "")
    .replace(/-codex/i, " Codex")
    .trim() || "Model";
}

function effortLabel(effort) {
  return (
    {
      none: t("effort.none"),
      minimal: t("effort.minimal"),
      low: t("effort.low"),
      medium: t("effort.medium"),
      high: t("effort.high"),
      xhigh: t("effort.xhigh"),
    }[effort] || effort
  );
}

function speedLabel(speed = uiConfigValue("speed", "standard")) {
  return speed === "fast" ? t("settings.speedFast") : t("settings.speedStandard");
}

function permissionOptions() {
  return [
    { value: "read-only", label: t("permission.readOnly"), description: t("permission.readOnlyDescription") },
    { value: "workspace", label: t("permission.workspace"), description: t("permission.workspaceDescription") },
    { value: "full-access", label: t("permission.fullAccess"), description: t("permission.fullAccessDescription") },
  ];
}

function selectedPermissionMode() {
  const value = uiConfigValue("permissionMode", "full-access");
  return permissionOptions().some((option) => option.value === value) ? value : "full-access";
}

function selectedPermissionLabel() {
  return permissionOptions().find((option) => option.value === selectedPermissionMode())?.label || t("permission.fullAccess");
}

function renderModelControls() {
  syncModelSelection();
  const models = availableModels();
  const selected = selectedModelInfo();
  const modelLabel = compactModelLabel(selected);
  const currentSpeed = uiConfigValue("speed", "standard");
  const combinedLabel = selected
    ? [modelLabel, effortLabel(state.selectedEffort), currentSpeed === "fast" ? speedLabel(currentSpeed) : ""]
        .filter(Boolean)
        .join(" · ")
    : t("composer.model");

  els.modelChoiceLabel.textContent = combinedLabel;
  renderContextMeter();
  const modelOptions = models.length
    ? models
        .map(
          (model) => `
            <button type="button" class="model-option ${model.model === state.selectedModel ? "active" : ""}" data-model="${escapeHtml(model.model)}">
              <span class="model-title">${escapeHtml(model.displayName || model.model)}</span>
              <span class="model-description">${escapeHtml(model.description || model.model)}</span>
            </button>
          `,
        )
        .join("")
    : `<div class="model-empty">${escapeHtml(t("model.modelsAfterSignIn"))}</div>`;
  const efforts = supportedEffortsFor(selected);
  const effortOptions = efforts
    .map(
      (effort) => `
        <button type="button" class="model-option compact ${effort === state.selectedEffort ? "active" : ""}" data-effort="${escapeHtml(effort)}">
          <span class="model-title">${escapeHtml(effortLabel(effort))}</span>
        </button>
      `,
    )
    .join("");
  const speedOptions = ["standard", "fast"]
    .map(
      (speed) => `
        <button type="button" class="model-option compact ${speed === currentSpeed ? "active" : ""}" data-speed="${escapeHtml(speed)}">
          <span class="model-title">${escapeHtml(speedLabel(speed))}</span>
        </button>
      `,
    )
    .join("");

  els.modelMenu.innerHTML = `
    <details class="model-menu-section" open>
      <summary><span>${escapeHtml(t("model.sectionModel"))}</span><strong>${escapeHtml(modelLabel)}</strong></summary>
      ${modelOptions}
    </details>
    <details class="model-menu-section">
      <summary><span>${escapeHtml(t("model.sectionEffort"))}</span><strong>${escapeHtml(effortLabel(state.selectedEffort))}</strong></summary>
      ${effortOptions}
    </details>
    <details class="model-menu-section">
      <summary><span>${escapeHtml(t("model.sectionSpeed"))}</span><strong>${escapeHtml(speedLabel(currentSpeed))}</strong></summary>
      ${speedOptions}
    </details>
  `;

  els.modelMenu.querySelectorAll("[data-model]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedModel = button.dataset.model;
      const model = selectedModelInfo();
      const efforts = supportedEffortsFor(model);
      state.selectedEffort = defaultEffortFor(model, efforts);
      saveUiConfig({ selectedModel: state.selectedModel, selectedEffort: state.selectedEffort });
      renderModelControls();
    });
  });

  els.modelMenu.querySelectorAll("[data-effort]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedEffort = button.dataset.effort;
      saveUiConfig({ selectedEffort: state.selectedEffort });
      renderModelControls();
    });
  });

  els.modelMenu.querySelectorAll("[data-speed]").forEach((button) => {
    button.addEventListener("click", () => {
      saveUiConfig({ speed: button.dataset.speed }).then(renderModelControls);
    });
  });
}

function contextUsageStats() {
  const usage = currentThreadTokenUsage();
  const totalTokens = usage?.total?.totalTokens || 0;
  const contextWindow = usage?.modelContextWindow || 0;
  if (!contextWindow || contextWindow <= 0) {
    return { available: false, totalTokens, contextWindow, percent: 0 };
  }
  return {
    available: true,
    totalTokens,
    contextWindow,
    percent: Math.min(100, Math.max(0, (totalTokens / contextWindow) * 100)),
  };
}

function renderContextMeter() {
  if (!els.contextMeterMini || !els.contextMeterFill || !els.contextMeterLabel) {
    return;
  }
  const stats = contextUsageStats();
  const rounded = Math.round(stats.percent);
  els.contextMeterFill.style.width = `${stats.available ? rounded : 0}%`;
  els.contextMeterLabel.textContent = stats.available ? `${rounded}%` : "CTX --";
  els.contextMeterMini.classList.toggle("is-empty", !stats.available);
  els.contextMeterMini.classList.toggle("is-high", stats.available && rounded >= 80);
  els.contextMeterMini.classList.toggle("is-critical", stats.available && rounded >= 95);
  els.contextMeterMini.setAttribute(
    "title",
    stats.available
      ? t("composer.contextUsageDetail", { percent: rounded })
      : t("composer.contextUnknown"),
  );
}

function renderPermissionControls() {
  if (!els.permissionChoiceLabel || !els.permissionMenu) {
    return;
  }
  const selectedMode = selectedPermissionMode();
  els.permissionChoiceLabel.textContent = selectedPermissionLabel();
  els.permissionMenu.innerHTML = permissionOptions()
    .map(
      (option) => `
        <button type="button" class="permission-option ${option.value === selectedMode ? "active" : ""}" data-permission-mode="${escapeHtml(option.value)}">
          <span class="model-title">${escapeHtml(option.label)}</span>
          <span class="model-description">${escapeHtml(option.description)}</span>
        </button>
      `,
    )
    .join("");
  els.permissionMenu.querySelectorAll("[data-permission-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      saveUiConfig({ permissionMode: button.dataset.permissionMode }).then(renderPermissionControls);
      els.permissionMenu.classList.add("hidden");
    });
  });
}

function saveUiConfig(patch) {
  state.uiConfig = { ...state.uiConfig, ...patch };
  return window.codexDesktop
    .updateUiConfig(patch)
    .then((config) => {
      state.uiConfig = config || state.uiConfig;
      return state.uiConfig;
    })
    .catch((error) => {
      els.serverStatus.textContent = error.message;
      return state.uiConfig;
    });
}

function showContextMenu(event, items) {
  event.preventDefault();
  event.stopPropagation();
  els.contextMenu.innerHTML = items
    .map(
      (item, index) => `
        <button type="button" role="menuitem" ${item.danger ? 'class="danger"' : ""} data-menu-index="${index}">
          ${escapeHtml(item.label)}
        </button>
      `,
    )
    .join("");
  els.contextMenu.classList.remove("hidden");
  const menuRect = els.contextMenu.getBoundingClientRect();
  const left = Math.min(event.clientX, window.innerWidth - menuRect.width - 8);
  const top = Math.min(event.clientY, window.innerHeight - menuRect.height - 8);
  els.contextMenu.style.left = `${Math.max(8, left)}px`;
  els.contextMenu.style.top = `${Math.max(8, top)}px`;
  els.contextMenu.querySelectorAll("[data-menu-index]").forEach((button) => {
    button.addEventListener("click", async () => {
      hideContextMenu();
      const item = items[Number.parseInt(button.dataset.menuIndex, 10)];
      if (item?.action) {
        await item.action();
      }
    });
  });
}

function hideContextMenu() {
  els.contextMenu.classList.add("hidden");
}

function showThreadContextMenu(event, thread) {
  const pinned = pinnedThreadIds().includes(thread.id);
  showContextMenu(event, [
    { label: pinned ? t("context.unpin") : t("context.pin"), action: () => toggleThreadPin(thread.id) },
    { label: t("context.archiveDelete"), danger: true, action: () => archiveThread(thread.id) },
  ]);
}

function showProjectContextMenu(event, project) {
  const pinned = pinnedProjectPaths().includes(project.path);
  showContextMenu(event, [
    { label: pinned ? t("context.unpin") : t("context.pin"), action: () => toggleProjectPin(project.path) },
    { label: t("context.deleteProject"), danger: true, action: () => deleteProject(project.path) },
  ]);
}

async function toggleThreadPin(threadId) {
  const current = pinnedThreadIds();
  const pinnedThreadIdsNext = current.includes(threadId)
    ? current.filter((id) => id !== threadId)
    : [threadId, ...current];
  await saveUiConfig({ pinnedThreadIds: pinnedThreadIdsNext });
  renderSidebar();
}

async function toggleProjectPin(projectPath) {
  const current = pinnedProjectPaths();
  const pinnedProjectPathsNext = current.includes(projectPath)
    ? current.filter((path) => path !== projectPath)
    : [projectPath, ...current];
  await saveUiConfig({ pinnedProjectPaths: pinnedProjectPathsNext });
  renderSidebar();
}

async function deleteProject(projectPath) {
  const recentProjects = (state.uiConfig.recentProjects || []).filter((project) => project.path !== projectPath);
  const pinnedProjectPathsNext = pinnedProjectPaths().filter((path) => path !== projectPath);
  state.projects = state.projects.filter((project) => project.path !== projectPath);
  await saveUiConfig({ recentProjects, pinnedProjectPaths: pinnedProjectPathsNext });
  renderSidebar();
}

async function archiveThread(threadId) {
  try {
    await window.codexDesktop.archiveThread(threadId);
    const pinnedThreadIdsNext = pinnedThreadIds().filter((id) => id !== threadId);
    removeThreadFromLocalLists(threadId);
    if (state.draftThreadId === threadId) {
      state.draftThreadId = null;
    }
    if (state.currentThread?.id === threadId) {
      state.currentThread = null;
      state.messages = [];
      state.threadTitle = "";
    }
    await saveUiConfig({ pinnedThreadIds: pinnedThreadIdsNext });
    renderAll();
  } catch (error) {
    els.serverStatus.textContent = error.message;
  }
}

async function loadSettingsConfig() {
  if (state.configLoading) {
    return;
  }
  state.configLoading = true;
  state.configError = "";
  renderSettings();
  try {
    state.configRead = await window.codexDesktop.readConfig();
    state.configSaveMessage = "";
  } catch (error) {
    state.configError = error.message;
  } finally {
    state.configLoading = false;
    renderSettings();
  }
}

async function saveSettingsConfig() {
  if (!state.configRead) {
    await loadSettingsConfig();
  }
  if (!state.configRead) {
    return;
  }
  const config = state.configRead?.config || {};
  const edits = configFormEdits(config);
  if (!edits.length) {
    state.configSaveMessage = currentLocale() === "zh-CN" ? "没有配置更改" : "No config changes";
    renderSettings();
    return;
  }

  state.configLoading = true;
  state.configError = "";
  renderSettings();
  try {
    for (const edit of edits) {
      await window.codexDesktop.writeConfigValue({
        keyPath: edit.key,
        value: edit.value,
        mergeStrategy: "replace",
      });
    }
    state.configSaveMessage =
      currentLocale() === "zh-CN"
        ? `已保存 ${edits.length} 项设置`
        : `Saved ${edits.length} ${edits.length === 1 ? "setting" : "settings"}`;
    state.configRead = await window.codexDesktop.readConfig();
  } catch (error) {
    state.configError = error.message;
  } finally {
    state.configLoading = false;
    renderSettings();
  }
}

function configFormEdits(config) {
  return configFieldSpecs()
    .map((spec) => {
      const value = readConfigFormValue(spec);
      return { key: spec.key, value };
    })
    .filter((edit) => !sameConfigValue(edit.value, config[edit.key] ?? null));
}

function configFieldSpecs() {
  return [
    { key: "model", element: els.settingsConfigModel, type: "string" },
    { key: "model_reasoning_effort", element: els.settingsConfigEffort, type: "enum" },
    { key: "approval_policy", element: els.settingsConfigApproval, type: "enum-or-custom" },
    { key: "sandbox_mode", element: els.settingsConfigSandbox, type: "enum" },
    { key: "web_search", element: els.settingsConfigWebSearch, type: "enum" },
    { key: "model_verbosity", element: els.settingsConfigVerbosity, type: "enum" },
    { key: "model_reasoning_summary", element: els.settingsConfigSummary, type: "enum" },
    { key: "service_tier", element: els.settingsConfigServiceTier, type: "enum" },
  ];
}

function readConfigFormValue(spec) {
  const raw = spec.element?.value?.trim() || "";
  if (spec.type === "enum-or-custom" && raw === "__custom") {
    return state.configRead?.config?.[spec.key] ?? null;
  }
  return raw || null;
}

function sameConfigValue(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

async function chooseWorkspace() {
  await discardEmptyDraftThreadIfNeeded();
  const workspace = await window.codexDesktop.chooseWorkspace();
  if (workspace) {
    resetActiveThreadForWorkspaceSwitch(workspace);
    await refreshState();
  }
}

async function openFileLink(href) {
  try {
    const keepConversationAtBottom = isConversationNearBottom();
    const detail = await window.codexDesktop.readFileLink(href);
    state.fileDetail = detail;
    state.reviewOpen = true;
    saveUiConfig({ reviewOpen: true }).catch(() => {});
    renderReviewVisibility();
    renderGit();
    scrollFileDetailToLine();
    if (keepConversationAtBottom) {
      scrollConversationToBottom();
    }
    return true;
  } catch (error) {
    els.serverStatus.textContent = error.message;
    return false;
  }
}

function isConversationNearBottom() {
  const remaining = els.conversation.scrollHeight - els.conversation.scrollTop - els.conversation.clientHeight;
  return remaining < 96;
}

function scrollConversationToBottom() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      els.conversation.scrollTop = els.conversation.scrollHeight;
    });
  });
}

function scheduleConversationRender({ stickToBottom = true } = {}) {
  conversationRenderShouldStick ||= stickToBottom && isConversationNearBottom();
  if (conversationRenderScheduled) {
    return;
  }
  conversationRenderScheduled = true;
  requestAnimationFrame(() => {
    conversationRenderScheduled = false;
    const forceBottom = conversationRenderShouldStick;
    conversationRenderShouldStick = false;
    renderConversation({ forceBottom });
  });
}

function renderConversation({ forceBottom = true } = {}) {
  els.emptyState.classList.toggle("hidden", state.messages.length > 0);
  els.shell.classList.toggle("is-empty", state.messages.length === 0);
  const html = renderConversationMessages();

  els.conversation.innerHTML = `${els.emptyState.outerHTML}${html}`;
  if (forceBottom) {
    els.conversation.scrollTop = els.conversation.scrollHeight;
  }
  refreshRuntimeLabels();
}

function renderConversationMessages() {
  const html = [];
  const completedActivityGroups = completedActivityGroupsByTurn();
  const groupedIndexes = new Set();
  completedActivityGroups.forEach((entries) => {
    entries.forEach((entry) => groupedIndexes.add(entry.index));
  });
  let activityGroup = [];
  const flushActivityGroup = () => {
    if (!activityGroup.length) {
      return;
    }
    if (activityGroup.length === 1) {
      const entry = activityGroup[0];
      html.push(renderMessage(entry.message, entry.index));
    } else {
      html.push(renderActivityGroup(activityGroup));
    }
    activityGroup = [];
  };

  state.messages.forEach((message, index) => {
    if (groupedIndexes.has(index)) {
      flushActivityGroup();
      const completedGroup = completedActivityGroups.get(index);
      if (completedGroup) {
        html.push(renderActivityGroup(completedGroup, { completedTurn: true }));
      }
      return;
    }
    if (isMergeableActivityMessage(message)) {
      activityGroup.push({ message, index });
      return;
    }
    flushActivityGroup();
    html.push(renderMessage(message, index));
  });
  flushActivityGroup();
  return html.join("");
}

function completedActivityGroupsByTurn() {
  const turnGroups = new Map();
  state.messages.forEach((message, index) => {
    if (!message.turnId || message.turnId === state.currentTurnId || !isMergeableActivityMessage(message)) {
      return;
    }
    if (!turnGroups.has(message.turnId)) {
      turnGroups.set(message.turnId, []);
    }
    turnGroups.get(message.turnId).push({ message, index });
  });

  const groupsByFirstIndex = new Map();
  turnGroups.forEach((entries) => {
    if (entries.length) {
      groupsByFirstIndex.set(entries[0].index, entries);
    }
  });
  return groupsByFirstIndex;
}

function isMergeableActivityMessage(message) {
  if (message.role === "reasoning") {
    return true;
  }
  return message.role === "tool" && message.kind !== "error";
}

function renderActivityGroup(entries, { completedTurn = false } = {}) {
  const liveEntry = entries.find((entry) => runtimeDescriptor(entry.message).live);
  const runtimeEntry = liveEntry || [...entries].reverse().find((entry) => runtimeDescriptor(entry.message).label);
  const runtime = runtimeEntry ? renderRuntimeLabel(runtimeEntry.message, runtimeEntry.index, "message-runtime activity-runtime") : "";
  const isLive = Boolean(liveEntry);
  const title = completedTurn ? t("activity.completedTitle") : t("activity.title");
  const body = entries
    .map(
      (entry) => `
        <section class="activity-group-item" data-message-index="${entry.index}">
          ${renderMessageBody(entry.message)}
          ${renderMessageRuntime(entry.message, entry.index)}
        </section>
      `,
    )
    .join("");
  return `
    <article class="message activity" data-activity-group-message>
      <div class="bubble">
        <details class="foldable-block activity-group ${isLive ? "is-live" : ""}">
          <summary>
            <span class="fold-label">
              ${isLive ? '<span class="reasoning-pulse" aria-hidden="true"></span>' : ""}
              ${escapeHtml(title)}
            </span>
            <span class="fold-meta">${escapeHtml(t("activity.items", { count: entries.length }))}</span>
            ${runtime}
          </summary>
          <div class="activity-group-body">
            ${body}
          </div>
        </details>
      </div>
    </article>
  `;
}

function renderMessage(message, index) {
  if (message.role === "compaction") {
    return renderContextCompactionMessage(message, index);
  }
  const role = message.role || "assistant";
  const kind = message.kind ? ` ${cssToken(message.kind)}` : "";
  const actions = role === "user" ? renderUserMessageActions(message, index) : "";
  const runtime = renderMessageRuntime(message, index);
  return `<article class="message ${cssToken(role)}${kind}" data-message-index="${index}"><div class="bubble">${renderMessageBody(message)}${actions}${runtime}</div></article>`;
}

function renderContextCompactionMessage(_message, index) {
  return `
    <article class="message compaction" data-message-index="${index}">
      <div class="context-divider">
        <span></span>
        <div>
          <strong>${escapeHtml(t("context.compacted"))}</strong>
          <em>${escapeHtml(t("context.compactedDetail"))}</em>
        </div>
        <span></span>
      </div>
    </article>
  `;
}

function renderMessageRuntime(message, index) {
  return renderRuntimeLabel(message, index, "message-runtime");
}

function renderRuntimeLabel(message, index, className) {
  const descriptor = runtimeDescriptor(message);
  const classes = className.split(/\s+/).filter(Boolean);
  if (!descriptor.label) {
    classes.push("hidden");
  }
  if (descriptor.live) {
    classes.push("is-live");
  }
  if (descriptor.waiting) {
    classes.push("is-waiting");
  }
  return `<span class="${classes.join(" ")}" data-message-runtime-index="${index}">${escapeHtml(descriptor.label)}</span>`;
}

function renderMessageBody(message) {
  if (message.role === "compaction") {
    return "";
  }
  if (message.role === "tool") {
    return renderFoldableBlock(message.title || t("code.output"), message.text || "", message.kind || "tool", false);
  }
  if (message.role === "reasoning") {
    return renderReasoningMessage(message);
  }
  return renderMarkdown(message.text || "");
}

function renderUserMessageActions(message, index) {
  const canEdit = Number.isInteger(message.turnIndex) && !state.currentTurnId;
  return `
    <div class="message-actions">
      <button type="button" class="message-action" data-user-action="copy" data-message-index="${index}" aria-label="${escapeHtml(t("message.copy"))}" title="${escapeHtml(t("message.copy"))}">
        <span class="icon copy"></span>
      </button>
      <button type="button" class="message-action" data-user-action="edit" data-message-index="${index}" aria-label="${escapeHtml(t("message.editRegenerate"))}" title="${escapeHtml(t("message.editRegenerate"))}" ${canEdit ? "" : "disabled"}>
        <span class="icon pen"></span>
      </button>
    </div>
  `;
}

function renderReasoningMessage(message) {
  const summary = normalizedTextArray(message.summary);
  const visibleSummary = summary.filter((part) => part.trim());
  const isInProgress = message.status !== "completed";
  const open = Boolean(message.open);
  const title = reasoningDisplayTitle(visibleSummary);
  const meta = isInProgress
    ? visibleSummary.length
      ? t("reasoning.inProgress")
      : t("reasoning.active")
    : visibleSummary.length === 0
      ? t("reasoning.noNotes")
      : visibleSummary.length === 1
        ? t("reasoning.note")
        : t("reasoning.notes", { count: visibleSummary.length });
  const body = visibleSummary.length
    ? visibleSummary.map((part) => renderReasoningPart(part, isInProgress)).join("")
    : `<p class="reasoning-empty">${escapeHtml(isInProgress ? t("reasoning.waiting") : t("reasoning.none"))}</p>`;

  return `
    <details class="foldable-block reasoning ${isInProgress ? "is-live" : "is-completed"}" data-reasoning-id="${escapeHtml(message.itemId || "")}" ${open ? "open" : ""}>
      <summary>
        <span class="fold-label">
          <span class="reasoning-pulse" aria-hidden="true"></span>
          ${escapeHtml(title)}
        </span>
        <span class="fold-meta">${escapeHtml(meta)}</span>
      </summary>
      <div class="reasoning-body">
        ${body}
      </div>
    </details>
  `;
}

function reasoningDisplayTitle(visibleSummary) {
  const source = visibleSummary.find((part) => part.trim());
  if (!source) {
    return t("reasoning.title");
  }
  const firstLine = source
    .split(/\r?\n/)
    .map(cleanTitleText)
    .find(Boolean);
  const title = summarizeTitle(firstLine || source);
  return title ? t("reasoning.ideaTitle", { title }) : t("reasoning.title");
}

function renderReasoningPart(text, isInProgress) {
  const body = isInProgress ? `<div class="plain-text reasoning-stream">${escapeHtml(text)}</div>` : renderMarkdown(text);
  return `<section class="reasoning-part">${body}</section>`;
}

function renderMarkdown(text) {
  const markdown = getMarkdownRenderer();
  if (!markdown) {
    return renderTextWithFoldableCode(text);
  }
  return `<div class="markdown-body">${markdown.render(text || "")}</div>`;
}

function getMarkdownRenderer() {
  if (markdownRenderer !== undefined) {
    return markdownRenderer;
  }
  if (typeof window.markdownit !== "function") {
    markdownRenderer = null;
    return markdownRenderer;
  }

  const markdown = window.markdownit({
    breaks: false,
    html: false,
    linkify: true,
    typographer: true,
  });
  markdown.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx];
    const language = (token.info || "").trim().split(/\s+/)[0];
    return renderCodeBlock(language ? `${t("code.code")}: ${language}` : t("code.code"), token.content, false, language);
  };
  markdown.renderer.rules.code_block = (tokens, idx) =>
    renderCodeBlock(t("code.code"), tokens[idx].content, false, "");

  const defaultLinkOpen =
    markdown.renderer.rules.link_open ||
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
  markdown.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const targetIndex = token.attrIndex("target");
    if (targetIndex < 0) {
      token.attrPush(["target", "_blank"]);
    } else {
      token.attrs[targetIndex][1] = "_blank";
    }
    const relIndex = token.attrIndex("rel");
    if (relIndex < 0) {
      token.attrPush(["rel", "noreferrer noopener"]);
    } else {
      token.attrs[relIndex][1] = "noreferrer noopener";
    }
    return defaultLinkOpen(tokens, idx, options, env, self);
  };

  markdownRenderer = markdown;
  return markdownRenderer;
}

function renderTextWithFoldableCode(text) {
  const parts = [];
  const codeFence = /```([^\n`]*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeFence.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(renderPlainText(text.slice(lastIndex, match.index)));
    }
    const language = match[1].trim();
    parts.push(renderCodeBlock(language ? `${t("code.code")}: ${language}` : t("code.code"), match[2], false, language));
    lastIndex = codeFence.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(renderPlainText(text.slice(lastIndex)));
  }

  return parts.join("") || "";
}

function renderPlainText(text) {
  return text ? `<div class="plain-text">${escapeHtml(text)}</div>` : "";
}

function renderCodeBlock(title, body, open, language = "") {
  const text = body || "";
  const lines = countBlockLines(text);
  const lineLabel = lines === 1 ? t("code.line") : t("code.lines", { count: lines });
  const copyButton = `<button type="button" class="copy-code" aria-label="${escapeHtml(t("code.copy"))}">${escapeHtml(t("code.copy"))}</button>`;
  const shouldFold = shouldFoldCodeBlock(language, text, lines);
  if (!shouldFold) {
    return `
      <div class="code-block ${lines === 1 ? "single-line" : "expanded"}">
        <div class="code-block-header">
          <span class="fold-label">${escapeHtml(title)}</span>
          <span class="fold-meta">${lineLabel}</span>
          ${copyButton}
        </div>
        <pre><code data-copy-source="true">${escapeHtml(stripTrailingNewline(text) || " ")}</code></pre>
      </div>
    `;
  }

  const collapsed = !open;
  return `
    <div class="foldable-block code has-preview ${collapsed ? "is-collapsed" : ""}" data-foldable-block>
      <div class="fold-summary" data-fold-toggle role="button" tabindex="0" aria-expanded="${collapsed ? "false" : "true"}">
        <span class="fold-label">${escapeHtml(title)}</span>
        <span class="fold-meta">${lineLabel}</span>
        ${copyButton}
      </div>
      <pre class="fold-preview" aria-hidden="${collapsed ? "false" : "true"}"><code>${escapeHtml(previewBlockText(text))}</code></pre>
      <pre class="fold-full" aria-hidden="${collapsed ? "true" : "false"}"><code data-copy-source="true">${escapeHtml(text)}</code></pre>
    </div>
  `;
}

function renderFoldableBlock(title, body, kind, open) {
  const text = body || t("code.noOutput");
  const lines = countBlockLines(text);
  const lineLabel = lines === 1 ? t("code.line") : t("code.lines", { count: lines });
  const kindClass = cssToken(kind);
  if (lines <= CODE_PREVIEW_LINES) {
    return `
      <div class="code-block ${kindClass}">
        <div class="code-block-header">
          <span class="fold-label">${escapeHtml(title)}</span>
          <span class="fold-meta">${lineLabel}</span>
        </div>
        <pre><code>${escapeHtml(stripTrailingNewline(text) || " ")}</code></pre>
      </div>
    `;
  }

  const collapsed = !open;
  return `
    <div class="foldable-block ${kindClass} has-preview ${collapsed ? "is-collapsed" : ""}" data-foldable-block>
      <div class="fold-summary" data-fold-toggle role="button" tabindex="0" aria-expanded="${collapsed ? "false" : "true"}">
        <span class="fold-label">${escapeHtml(title)}</span>
        <span class="fold-meta">${lineLabel}</span>
      </div>
      <pre class="fold-preview" aria-hidden="${collapsed ? "false" : "true"}"><code>${escapeHtml(previewBlockText(text))}</code></pre>
      <pre class="fold-full" aria-hidden="${collapsed ? "true" : "false"}"><code>${escapeHtml(text)}</code></pre>
    </div>
  `;
}

function countBlockLines(text) {
  return stripTrailingNewline(text).split(/\r?\n/).length;
}

function shouldFoldCodeBlock(language, text, lines) {
  return lines > CODE_PREVIEW_LINES && !isTextCodeBlock(language, text);
}

function isTextCodeBlock(language, text) {
  const normalized = String(language || "").trim().toLowerCase();
  if (TEXT_CODE_LANGUAGES.has(normalized)) {
    return true;
  }
  if (normalized) {
    return false;
  }
  const stripped = stripTrailingNewline(text).trim();
  if (!stripped) {
    return true;
  }
  const hasCodePunctuation = /[{}()[\];=<>]|=>|::|&&|\|\|/.test(stripped);
  const codeLineStartPattern =
    /^\s*(?:(?:import|export|const|let|var|function|class|def|if|for|while|return|#include|npm|git|cd|sudo|cargo|python|node|yarn|pnpm)\b|\$|>|#)/;
  const hasCodeLineStart = stripped.split(/\r?\n/).some((line) => codeLineStartPattern.test(line));
  const wordCount = (stripped.match(/[A-Za-z\u3400-\u9fff][\w\u3400-\u9fff'-]*/g) || []).length;
  const hasSentenceText = /[.!?。！？](?:\s|$)|[\u3400-\u9fff]/.test(stripped) || (wordCount >= 12 && !hasCodeLineStart);
  return hasSentenceText && !hasCodePunctuation;
}

function previewBlockText(text) {
  return stripTrailingNewline(text).split(/\r?\n/).slice(0, CODE_PREVIEW_LINES).join("\n") || " ";
}

function stripTrailingNewline(text) {
  return String(text || "").replace(/\r?\n$/, "");
}

function normalizedTextArray(value) {
  if (Array.isArray(value)) {
    return value.map((part) => String(part || ""));
  }
  if (typeof value === "string") {
    return [value];
  }
  return [];
}

function ensureTextArrayIndex(parts, index) {
  const safeIndex = Math.max(0, Number(index) || 0);
  while (parts.length <= safeIndex) {
    parts.push("");
  }
  return safeIndex;
}

function cssToken(value) {
  return String(value || "").replace(/[^a-z0-9_-]/gi, "");
}

function renderGit() {
  const totals = state.git.totals || { files: 0, added: 0, deleted: 0 };
  els.fileCount.textContent = totals.files;
  els.topAdded.textContent = `+${totals.added}`;
  els.topDeleted.textContent = `-${totals.deleted}`;
  renderCommitMenu();
  if (state.fileDetail) {
    renderFileDetail();
    return;
  }
  els.reviewTitle.textContent = t("review.unstaged");
  els.fileSummary.innerHTML = state.git.files
    .map(
      (file) => `
        <div class="file-row">
          <span class="name">${escapeHtml(file.path)}</span>
          <span class="added">+${file.added}</span>
          <span class="deleted">-${file.deleted}</span>
        </div>
      `,
    )
    .join("");
  els.diffViewer.innerHTML = renderDiff(state.git.diff || "");
}

function renderCommitMenu() {
  if (!els.commitMenu || !els.commitButton) {
    return;
  }
  const files = state.git.files || [];
  const totals = state.git.totals || { files: 0, added: 0, deleted: 0 };
  els.commitButton.classList.toggle("has-changes", files.length > 0);
  if (!files.length) {
    els.commitMenu.innerHTML = `<div class="commit-empty">${escapeHtml(t("change.noChanges"))}</div>`;
    return;
  }
  els.commitMenu.innerHTML = `
    <div class="commit-menu-header">
      <span>${escapeHtml(t("change.filesChanged", { count: totals.files }))}</span>
      <span><span class="added">+${totals.added}</span> <span class="deleted">-${totals.deleted}</span></span>
    </div>
    <div class="commit-menu-list">
      ${files
        .map(
          (file) => `
            <div class="commit-row">
              <span class="status">${escapeHtml(file.status || "M")}</span>
              <span class="path">${escapeHtml(file.path)}</span>
              <span class="added">+${file.added}</span>
              <span class="deleted">-${file.deleted}</span>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderFileDetail() {
  const file = state.fileDetail;
  const lines = file.content.split(/\r?\n/);
  els.reviewTitle.textContent = t("review.fileDetails");
  els.fileCount.textContent = file.line ? `L${file.line}` : lines.length;
  els.fileSummary.innerHTML = `
    <div class="file-detail-summary">
      <strong>${escapeHtml(file.relativePath || file.path)}</strong>
      <span>${escapeHtml(file.path)}</span>
      ${file.truncated ? `<span>${escapeHtml(t("review.previewTruncated"))}</span>` : ""}
    </div>
  `;
  els.diffViewer.innerHTML = `
    <section class="file-detail-view">
      ${lines
        .map(
          (line, index) => `
            <div class="file-line ${file.line === index + 1 ? "target" : ""}" data-file-line="${index + 1}">
              <span class="ln">${index + 1}</span>
              <span class="code">${escapeHtml(line || " ")}</span>
            </div>
          `,
        )
        .join("")}
    </section>
  `;
}

function scrollFileDetailToLine() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!state.fileDetail?.line) {
        els.diffViewer.scrollTop = 0;
        return;
      }
      els.diffViewer.querySelector(".file-line.target")?.scrollIntoView({ block: "center" });
    });
  });
}

function renderReviewVisibility() {
  els.shell.classList.toggle("review-collapsed", !state.reviewOpen);
  els.reviewOpen.classList.toggle("hidden", state.reviewOpen);
}

function renderDiff(diff) {
  if (!diff.trim()) {
    return `<div class="diff-file-title">${escapeHtml(t("review.noDiff"))}</div>`;
  }

  const files = parseUnifiedDiff(diff);
  return files
    .map(
      (file) => `
        <section class="diff-file">
          <div class="diff-file-title">${escapeHtml(file.path)}</div>
          ${file.lines
            .map(
              (line) => `
                <div class="diff-line ${line.kind}">
                  <span class="ln">${line.oldLine || ""}</span>
                  <span class="ln">${line.newLine || ""}</span>
                  <span class="code">${escapeHtml(line.text)}</span>
                </div>
              `,
            )
            .join("")}
        </section>
      `,
    )
    .join("");
}

function parseUnifiedDiff(diff) {
  const files = [];
  let current = null;
  let oldLine = 0;
  let newLine = 0;

  for (const rawLine of diff.split(/\r?\n/)) {
    if (rawLine.startsWith("diff --git ")) {
      current = { path: rawLine.replace(/^diff --git a\//, "").replace(/ b\/.*/, ""), lines: [] };
      files.push(current);
      continue;
    }
    if (!current) {
      continue;
    }
    if (rawLine.startsWith("+++ b/")) {
      current.path = rawLine.slice(6);
      continue;
    }
    const hunk = rawLine.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/);
    if (hunk) {
      oldLine = Number.parseInt(hunk[1], 10);
      newLine = Number.parseInt(hunk[2], 10);
      current.lines.push({ kind: "meta", oldLine: "", newLine: "", text: rawLine });
      continue;
    }
    if (rawLine.startsWith("+") && !rawLine.startsWith("+++")) {
      current.lines.push({ kind: "add", oldLine: "", newLine: newLine++, text: rawLine });
      continue;
    }
    if (rawLine.startsWith("-") && !rawLine.startsWith("---")) {
      current.lines.push({ kind: "del", oldLine: oldLine++, newLine: "", text: rawLine });
      continue;
    }
    if (rawLine.startsWith("\\ No newline")) {
      current.lines.push({ kind: "meta", oldLine: "", newLine: "", text: rawLine });
      continue;
    }
    current.lines.push({ kind: "ctx", oldLine: oldLine++, newLine: newLine++, text: rawLine });
  }

  return files;
}

function threadToMessages(thread) {
  const messages = [];
  const turns = thread.turns || [];
  for (let turnIndex = 0; turnIndex < turns.length; turnIndex += 1) {
    const turn = turns[turnIndex];
    const turnMeta = turnRuntimeMeta(turn);
    for (const item of turn.items || []) {
      if (item.type === "userMessage") {
        messages.push({
          role: "user",
          text: item.content.map(inputToText).join("\n"),
          turnId: turn.id,
          turnIndex,
          ...turnMeta,
        });
      } else if (item.type === "agentMessage") {
        messages.push({ role: "assistant", text: item.text, itemId: item.id, turnId: turn.id, ...turnMeta });
      } else if (item.type === "reasoning") {
        messages.push(reasoningMessageFromItem({ ...item, turnId: turn.id, ...turnMeta }, "completed"));
      } else if (item.type === "commandExecution") {
        messages.push({
          role: "tool",
          kind: "command",
          title: item.command ? `$ ${item.command}` : t("code.command"),
          text: item.aggregatedOutput || item.status || "",
          itemId: item.id,
          turnId: turn.id,
          itemDurationMs: item.durationMs,
          ...turnMeta,
        });
      } else if (item.type === "fileChange") {
        const summary = item.changes.map((change) => `${change.kind}: ${change.path}`).join("\n");
        messages.push({
          role: "tool",
          kind: "file-change",
          title: t("code.fileChanges"),
          text: summary || item.status,
          itemId: item.id,
          turnId: turn.id,
          ...turnMeta,
        });
      } else if (item.type === "contextCompaction") {
        messages.push({
          role: "compaction",
          itemId: item.id,
          turnId: turn.id,
          ...turnMeta,
        });
      }
    }
  }
  return messages;
}

function nextUserTurnIndex() {
  return state.messages.reduce((next, message) => {
    if (message.role === "user" && Number.isInteger(message.turnIndex)) {
      return Math.max(next, message.turnIndex + 1);
    }
    return next;
  }, 0);
}

function trackedUserTurnCount() {
  return Math.max(
    nextUserTurnIndex(),
    Array.isArray(state.currentThread?.turns) ? state.currentThread.turns.length : 0,
  );
}

function renderEditTurnDialog() {
  if (!els.editTurnModal) {
    return;
  }
  els.editTurnTitle.textContent = t("editTurn.title");
  els.editTurnHelp.textContent = t("editTurn.help");
  document.getElementById("cancelEditTurn").textContent = t("editTurn.cancel");
  document.getElementById("submitEditTurn").textContent = t("editTurn.regenerate");
}

function openEditTurnDialog(messageIndex) {
  const message = state.messages[messageIndex];
  if (!message || message.role !== "user" || !Number.isInteger(message.turnIndex)) {
    return;
  }
  state.editingTurn = {
    messageIndex,
    turnIndex: message.turnIndex,
    originalText: message.text || "",
  };
  renderEditTurnDialog();
  els.editTurnText.value = message.text || "";
  els.editTurnStatus.textContent = state.currentTurnId ? t("editTurn.waitForTurn") : "";
  document.getElementById("submitEditTurn").disabled = Boolean(state.currentTurnId);
  els.editTurnModal.classList.remove("hidden");
  els.editTurnText.focus();
  els.editTurnText.setSelectionRange(0, els.editTurnText.value.length);
}

function closeEditTurnDialog() {
  state.editingTurn = null;
  els.editTurnModal?.classList.add("hidden");
  if (els.editTurnStatus) {
    els.editTurnStatus.textContent = "";
  }
}

async function regenerateFromEditedTurn() {
  if (!state.editingTurn) {
    return;
  }
  if (state.currentTurnId) {
    els.editTurnStatus.textContent = t("editTurn.waitForTurn");
    return;
  }
  const text = els.editTurnText.value.trim();
  if (!text) {
    els.editTurnStatus.textContent = t("editTurn.empty");
    return;
  }
  const { turnIndex } = state.editingTurn;
  const totalTurns = trackedUserTurnCount();
  const numTurns = totalTurns - turnIndex;
  if (numTurns < 1) {
    els.editTurnStatus.textContent = t("editTurn.failed", { error: "invalid rollback target" });
    return;
  }

  const submitButton = document.getElementById("submitEditTurn");
  submitButton.disabled = true;
  els.editTurnText.disabled = true;
  els.editTurnStatus.textContent = "";

  try {
    state.queuedFollowUps = [];
    const thread = await window.codexDesktop.rollbackThread({ numTurns });
    state.currentThread = thread;
    state.draftThreadId = null;
    state.messages = threadToMessages(thread);
    state.threadTitle = threadDisplayTitle(thread) || state.threadTitle || "Codex";
    closeEditTurnDialog();
    const userMessage = appendMessage("user", text, { turnIndex: nextUserTurnIndex() });
    try {
      await sendTurnToCodex(text, turnOptionsFromUi());
    } catch (error) {
      if (!userMessage.turnId && userMessage.queuedAt) {
        userMessage.durationMs = Date.now() - userMessage.queuedAt;
        userMessage.completedAt = Date.now();
        delete userMessage.queuedAt;
        refreshRuntimeLabels();
      }
      throw error;
    }
  } catch (error) {
    els.editTurnStatus.textContent = t("editTurn.failed", { error: error.message });
    appendMessage("tool", error.message, { title: t("code.error"), kind: "error" });
  } finally {
    submitButton.disabled = false;
    els.editTurnText.disabled = false;
  }
}

function inputToText(input) {
  if (input.type === "text") {
    return input.text;
  }
  if (input.type === "localImage") {
    return input.path;
  }
  return input.name || input.url || input.path || "";
}

async function refreshState() {
  const next = await window.codexDesktop.getState();
  const uiConfig = next.uiConfig || state.uiConfig;
  const optimisticThreads = state.optimisticThreads;
  const threadTokenUsageById = state.threadTokenUsageById;
  const rateLimits = next.rateLimits || state.rateLimits;
  const rateLimitsLoadedAt = next.rateLimits ? Date.now() : state.rateLimitsLoadedAt;
  Object.assign(state, next);
  state.serverReady = next.serverReady;
  state.uiConfig = uiConfig;
  state.optimisticThreads = optimisticThreads;
  state.threadTokenUsageById = threadTokenUsageById;
  state.rateLimits = rateLimits;
  state.rateLimitsLoadedAt = rateLimitsLoadedAt;
  state.threads = mergeOptimisticThreads(next.threads);
  state.reviewOpen = Boolean(uiConfig.reviewOpen);
  state.selectedModel = uiConfig.selectedModel || "";
  state.selectedEffort = uiConfig.selectedEffort || "";
  renderAll();
}

async function loadRateLimits({ force = false } = {}) {
  const account = state.account?.account;
  if (!account || account.type !== "chatgpt") {
    state.rateLimits = null;
    state.rateLimitsError = "";
    state.rateLimitsLoading = false;
    state.rateLimitsLoadedAt = 0;
    renderSettings();
    return;
  }
  if (state.rateLimitsLoading) {
    return;
  }
  if (!force && state.rateLimits && Date.now() - state.rateLimitsLoadedAt < 60_000) {
    return;
  }
  state.rateLimitsLoading = true;
  state.rateLimitsError = "";
  renderSettings();
  try {
    state.rateLimits = await window.codexDesktop.readRateLimits();
    state.rateLimitsLoadedAt = Date.now();
  } catch (error) {
    state.rateLimitsError = error.message;
  } finally {
    state.rateLimitsLoading = false;
    renderSettings();
  }
}

function maybeLoadUsageData({ force = false } = {}) {
  if (state.settingsTab !== "usage" || els.settingsModal.classList.contains("hidden")) {
    return;
  }
  loadRateLimits({ force });
}

function appendMessage(role, text, extra = {}) {
  const now = Date.now();
  const message = { role, text, createdAt: now, updatedAt: now, ...extra };
  if (role === "user" && !message.turnId && !message.queuedAt) {
    message.queuedAt = now;
  }
  state.messages.push(message);
  renderConversation();
  return message;
}

async function copyTextToClipboard(text, control = null) {
  try {
    await window.codexDesktop.copyText(text);
  } catch (error) {
    els.serverStatus.textContent = `${t("code.copyFailed")}: ${error.message}`;
    throw error;
  }
  markCopied(control);
}

function markCopied(control) {
  if (!control) {
    els.serverStatus.textContent = t("code.copied");
    return;
  }
  const previousText = control.textContent;
  const previousLabel = control.getAttribute("aria-label");
  const previousTitle = control.getAttribute("title");
  control.classList.add("copied");
  control.setAttribute("aria-label", t("code.copied"));
  control.setAttribute("title", t("code.copied"));
  if (control.classList.contains("copy-code")) {
    control.textContent = t("code.copied");
  }
  setTimeout(() => {
    if (!control.isConnected) {
      return;
    }
    control.classList.remove("copied");
    if (control.classList.contains("copy-code")) {
      control.textContent = previousText;
    }
    if (previousLabel) {
      control.setAttribute("aria-label", previousLabel);
    }
    if (previousTitle) {
      control.setAttribute("title", previousTitle);
    }
  }, 1000);
}

function toggleFoldablePreview(foldToggle) {
  const block = foldToggle.closest("[data-foldable-block]");
  if (!block) {
    return;
  }
  const collapsed = block.classList.toggle("is-collapsed");
  foldToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
  block.querySelector(".fold-preview")?.setAttribute("aria-hidden", collapsed ? "false" : "true");
  block.querySelector(".fold-full")?.setAttribute("aria-hidden", collapsed ? "true" : "false");
}

function reasoningMessageFromItem(item, status = "inProgress") {
  return {
    role: "reasoning",
    itemId: item.id,
    turnId: item.turnId || null,
    turnStartedAt: item.turnStartedAt || null,
    turnCompletedAt: item.turnCompletedAt || null,
    turnDurationMs: item.turnDurationMs ?? null,
    summary: normalizedTextArray(item.summary),
    content: normalizedTextArray(item.content),
    status,
    open: false,
    userToggled: false,
    synthetic: Boolean(item.synthetic),
  };
}

function syntheticReasoningItemId(turnId) {
  return `turn:${turnId}:reasoning`;
}

function startTurnReasoningIndicator(turnId) {
  if (!turnId || state.messages.some((message) => message.role === "reasoning" && message.turnId === turnId)) {
    return;
  }
  state.messages.push(
    reasoningMessageFromItem({
      id: syntheticReasoningItemId(turnId),
      turnId,
      summary: [],
      content: [],
      synthetic: true,
      turnStartedAt: state.currentTurnStartedAt,
    }),
  );
}

function findReasoningMessageForTurn(turnId) {
  if (!turnId) {
    return null;
  }
  return state.messages.find((message) => message.role === "reasoning" && message.turnId === turnId && message.synthetic);
}

function completeTurnReasoningIndicators(turnId) {
  state.messages = state.messages.filter((message) => {
    if (message.role !== "reasoning" || message.turnId !== turnId) {
      return true;
    }
    const hasSummary = normalizedTextArray(message.summary).some((part) => part.trim());
    if (message.synthetic && !hasSummary) {
      return false;
    }
    message.status = "completed";
    if (!message.userToggled) {
      message.open = false;
    }
    return true;
  });
}

function ensureReasoningMessage(itemId, item = null, turnId = null) {
  let message = findStreamingMessage(itemId);
  if (!message) {
    message = findReasoningMessageForTurn(turnId);
    if (message) {
      message.itemId = itemId;
      message.synthetic = false;
    } else {
      message = reasoningMessageFromItem(
        item || {
          id: itemId,
          turnId,
          summary: [],
          content: [],
        },
      );
      state.messages.push(message);
      return message;
    }
  }

  if (message.role !== "reasoning") {
    message.role = "reasoning";
  }
  if (!Array.isArray(message.summary)) {
    message.summary = normalizedTextArray(message.summary);
  }
  if (!Array.isArray(message.content)) {
    message.content = normalizedTextArray(message.content);
  }
  if (item) {
    message.summary = normalizedTextArray(item.summary);
    message.content = normalizedTextArray(item.content);
  }
  if (turnId) {
    message.turnId = turnId;
  }
  message.synthetic = false;
  message.status = message.status || "inProgress";
  message.open ??= false;
  if (message.turnId) {
    applyTurnRuntime(message, {
      turnStartedAt: message.turnStartedAt || state.currentTurnStartedAt,
    });
  }
  return message;
}

function turnOptionsFromUi() {
  return {
    effort: state.selectedEffort,
    model: state.selectedModel || null,
    permissionMode: selectedPermissionMode(),
    speed: uiConfigValue("speed", "standard"),
    personality: uiConfigValue("personality", "pragmatic"),
    customInstructions: uiConfigValue("customInstructions", ""),
  };
}

function oppositeFollowUpBehavior(value) {
  return value === "steer" ? "queue" : "steer";
}

async function sendTurnToCodex(text, options) {
  await window.codexDesktop.startTurn({ text, options });
}

async function flushQueuedFollowUp() {
  if (state.currentTurnId || !state.queuedFollowUps.length) {
    return;
  }
  const next = state.queuedFollowUps.shift();
  try {
    await sendTurnToCodex(next.text, next.options);
  } catch (error) {
    if (next.message && !next.message.turnId && next.message.queuedAt) {
      next.message.durationMs = Date.now() - next.message.queuedAt;
      next.message.completedAt = Date.now();
      delete next.message.queuedAt;
      refreshRuntimeLabels();
    }
    appendMessage("tool", error.message, { title: t("code.error"), kind: "error" });
  }
}

function appendContextCompactionMarker(turnId, itemId = null) {
  if (turnId && state.messages.some((message) => message.role === "compaction" && message.turnId === turnId)) {
    return;
  }
  appendMessage("compaction", "", {
    itemId: itemId || (turnId ? `compaction:${turnId}` : `compaction:${Date.now()}`),
    turnId,
    turnStartedAt: state.currentTurnStartedAt,
  });
}

async function submitPrompt(followUpOverride = null) {
  const text = els.prompt.value.trim();
  if (!text) {
    return;
  }
  els.prompt.value = "";
  if (state.currentThread?.id === state.draftThreadId) {
    state.draftThreadId = null;
  }
  const userMessage = appendMessage("user", text, { turnIndex: nextUserTurnIndex() });
  if (state.currentThread?.id && !state.currentThread.name) {
    const title = summarizeTitle(text);
    state.currentThread = { ...state.currentThread, preview: title, displayTitle: title };
    state.threadTitle = title;
    upsertThread(state.currentThread, { optimistic: true });
    renderSidebar();
    renderHeader();
  }

  const activeTurnId = state.currentTurnId;
  const behavior = followUpOverride || uiConfigValue("followUpBehavior", "queue");
  const options = turnOptionsFromUi();

  if (activeTurnId && behavior === "queue") {
    state.queuedFollowUps.push({ text, options, message: userMessage });
    return;
  }

  if (activeTurnId && behavior === "steer") {
    userMessage.turnId = activeTurnId;
    applyTurnRuntime(userMessage, { turnStartedAt: state.currentTurnStartedAt });
    options.followUpBehavior = "steer";
    options.activeTurnId = activeTurnId;
    refreshRuntimeLabels();
  }

  try {
    await sendTurnToCodex(text, options);
  } catch (error) {
    if (!userMessage.turnId && userMessage.queuedAt) {
      userMessage.durationMs = Date.now() - userMessage.queuedAt;
      userMessage.completedAt = Date.now();
      delete userMessage.queuedAt;
      refreshRuntimeLabels();
    }
    appendMessage("tool", error.message, { title: t("code.error"), kind: "error" });
  }
}

function findStreamingMessage(itemId) {
  return state.messages.find((message) => message.itemId === itemId);
}

window.codexDesktop.onServerStatus((payload) => {
  state.serverReady = payload.status === "running";
  els.serverStatus.textContent = payload.status === "running" ? t("status.connected") : payload.detail;
});

window.codexDesktop.onServerLog((payload) => {
  if (!payload.trim()) {
    return;
  }
  els.serverStatus.textContent = payload.trim().slice(0, 160);
});

window.codexDesktop.onEvent(({ method, params }) => {
  if (method === "thread/started") {
    state.currentThread = params.thread;
    state.threadTitle = threadDisplayTitle(params.thread) || t("nav.newChat");
    upsertThread(params.thread, { optimistic: true });
    renderSidebar();
    renderHeader();
    renderSettings();
  } else if (method === "turn/started") {
    state.currentTurnId = params.turn.id;
    const meta = turnRuntimeMeta(params.turn, { fallbackStartedAt: Date.now() });
    state.currentTurnStartedAt = meta.turnStartedAt;
    const pendingUserMessage = [...state.messages].reverse().find((message) => message.role === "user" && !message.turnId);
    if (pendingUserMessage) {
      pendingUserMessage.turnId = params.turn.id;
      applyTurnRuntime(pendingUserMessage, meta);
    }
    applyTurnRuntimeToMessages(params.turn.id, meta);
    startTurnReasoningIndicator(params.turn.id);
    scheduleConversationRender();
  } else if (method === "item/started") {
    if (params.item?.type === "reasoning") {
      ensureReasoningMessage(params.item.id, params.item, params.turnId);
      scheduleConversationRender();
    }
  } else if (method === "item/agentMessage/delta") {
    let message = findStreamingMessage(params.itemId);
    if (!message) {
      message = appendMessage("assistant", "", {
        itemId: params.itemId,
        turnId: params.turnId,
        turnStartedAt: state.currentTurnStartedAt,
      });
    }
    if (params.turnId && !message.turnId) {
      message.turnId = params.turnId;
    }
    applyTurnRuntime(message, { turnStartedAt: message.turnStartedAt || state.currentTurnStartedAt });
    message.text += params.delta;
    scheduleConversationRender();
  } else if (method === "item/reasoning/summaryPartAdded") {
    const message = ensureReasoningMessage(params.itemId, null, params.turnId);
    ensureTextArrayIndex(message.summary, params.summaryIndex);
    scheduleConversationRender();
  } else if (method === "item/reasoning/summaryTextDelta") {
    const message = ensureReasoningMessage(params.itemId, null, params.turnId);
    const index = ensureTextArrayIndex(message.summary, params.summaryIndex);
    message.summary[index] += params.delta || "";
    scheduleConversationRender();
  } else if (method === "item/reasoning/textDelta") {
    const message = ensureReasoningMessage(params.itemId, null, params.turnId);
    const index = ensureTextArrayIndex(message.content, params.contentIndex);
    message.content[index] += params.delta || "";
    scheduleConversationRender();
  } else if (method === "item/completed") {
    handleCompletedItem(params.item, params.turnId);
  } else if (method === "turn/diff/updated") {
    state.git.diff = params.diff;
    renderGit();
  } else if (method === "thread/tokenUsage/updated") {
    if (params.threadId && params.tokenUsage) {
      state.threadTokenUsageById[params.threadId] = params.tokenUsage;
    }
    renderSettings();
    renderModelControls();
  } else if (method === "thread/compacted") {
    if (!params.threadId || params.threadId === state.currentThread?.id) {
      appendContextCompactionMarker(params.turnId);
    }
  } else if (method === "turn/completed") {
    const turnId = params.turn?.id || state.currentTurnId;
    const completedMeta = turnRuntimeMeta(params.turn, {
      fallbackStartedAt: state.currentTurnStartedAt,
    });
    applyTurnRuntimeToMessages(turnId, completedMeta);
    completeTurnReasoningIndicators(turnId);
    state.currentTurnId = null;
    state.currentTurnStartedAt = null;
    renderConversation();
    window.codexDesktop.refreshGit().then((git) => {
      state.git = git;
      renderGit();
    });
    setTimeout(flushQueuedFollowUp, 0);
  } else if (method === "account/login/completed") {
    state.authLogin = null;
    els.browserLoginStatus.textContent = params.success ? t("auth.loginComplete") : params.error || t("auth.loginFailed");
    refreshState();
  } else if (method === "account/updated") {
    state.rateLimits = null;
    state.rateLimitsLoadedAt = 0;
    refreshState().then(() => maybeLoadUsageData({ force: true }));
  } else if (method === "account/rateLimits/updated") {
    state.rateLimits = { rateLimits: params.rateLimits, rateLimitsByLimitId: null };
    state.rateLimitsLoadedAt = Date.now();
    state.rateLimitsError = "";
    renderSettings();
  } else if (method === "thread/name/updated") {
    applyThreadTitle(params.threadId, params.threadName);
    renderSidebar();
    renderHeader();
  } else if (method === "thread/archived") {
    state.threads = state.threads.filter((thread) => thread.id !== params.threadId);
    state.optimisticThreads = state.optimisticThreads.filter((thread) => thread.id !== params.threadId);
    renderAll();
  }
});

function handleCompletedItem(item, turnId = null) {
  if (item.type === "agentMessage") {
    const message = findStreamingMessage(item.id);
    if (message) {
      message.text = item.text;
      if (turnId && !message.turnId) {
        message.turnId = turnId;
      }
      applyTurnRuntime(message, { turnStartedAt: message.turnStartedAt || state.currentTurnStartedAt });
    } else {
      appendMessage("assistant", item.text, {
        itemId: item.id,
        turnId,
        turnStartedAt: state.currentTurnStartedAt,
      });
    }
  } else if (item.type === "reasoning") {
    const message = ensureReasoningMessage(item.id, item, turnId);
    message.status = "completed";
    if (!message.userToggled) {
      message.open = false;
    }
  } else if (item.type === "commandExecution") {
    appendMessage("tool", item.aggregatedOutput || item.status || "", {
      kind: "command",
      title: item.command ? `$ ${item.command}` : t("code.command"),
      itemId: item.id,
      turnId,
      turnStartedAt: state.currentTurnStartedAt,
      itemDurationMs: item.durationMs,
    });
  } else if (item.type === "fileChange") {
    const summary = item.changes.map((change) => `${change.kind}: ${change.path}`).join("\n");
    appendMessage("tool", summary || item.status, {
      kind: "file-change",
      title: t("code.fileChanges"),
      itemId: item.id,
      turnId,
      turnStartedAt: state.currentTurnStartedAt,
    });
  } else if (item.type === "contextCompaction") {
    appendContextCompactionMarker(turnId, item.id);
  }
  renderConversation();
}

window.codexDesktop.onApprovalRequest((message) => {
  state.pendingApproval = message;
  els.approvalCard.classList.remove("hidden");
  if (message.method === "item/commandExecution/requestApproval") {
    els.approvalTitle.textContent = t("approval.commandTitle");
    els.approvalDetail.textContent = message.params.command || message.params.reason || t("approval.defaultDetail");
  } else if (message.method === "item/fileChange/requestApproval") {
    els.approvalTitle.textContent = t("approval.fileTitle");
    els.approvalDetail.textContent = message.params.reason || message.params.grantRoot || t("approval.writeDetail");
  } else {
    els.approvalTitle.textContent = t("approval.title");
    els.approvalDetail.textContent = message.method;
  }
});

document.getElementById("acceptApproval").addEventListener("click", async () => {
  if (!state.pendingApproval) {
    return;
  }
  await window.codexDesktop.respondToApproval({ id: state.pendingApproval.id, accept: true });
  state.pendingApproval = null;
  els.approvalCard.classList.add("hidden");
});

document.getElementById("declineApproval").addEventListener("click", async () => {
  if (!state.pendingApproval) {
    return;
  }
  await window.codexDesktop.respondToApproval({ id: state.pendingApproval.id, accept: false });
  state.pendingApproval = null;
  els.approvalCard.classList.add("hidden");
});

els.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  submitPrompt();
});

els.prompt.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.isComposing) {
    return;
  }

  const activeBehavior = uiConfigValue("followUpBehavior", "queue");
  if (event.metaKey || event.ctrlKey) {
    event.preventDefault();
    submitPrompt(state.currentTurnId ? oppositeFollowUpBehavior(activeBehavior) : null);
    return;
  }

  if (event.shiftKey) {
    return;
  }

  if (state.uiConfig?.requireCtrlEnterForLongPrompts && els.prompt.value.includes("\n")) {
    return;
  }

  event.preventDefault();
  submitPrompt();
});

document.getElementById("newChat").addEventListener("click", async () => {
  await discardEmptyDraftThreadIfNeeded();
  const thread = await window.codexDesktop.newThread();
  state.currentThread = thread;
  state.draftThreadId = thread.id;
  state.messages = [];
  state.threadTitle = t("nav.newChat");
  upsertThread(thread, { optimistic: true });
  renderAll();
  await refreshState();
});

document.getElementById("refreshState").addEventListener("click", refreshState);
document.getElementById("refreshGitTop").addEventListener("click", async () => {
  state.fileDetail = null;
  state.git = await window.codexDesktop.refreshGit();
  renderGit();
});
document.getElementById("startReview").addEventListener("click", async () => {
  try {
    state.fileDetail = null;
    await window.codexDesktop.startReview({ delivery: uiConfigValue("codeReviewMode", "inline") });
  } catch (error) {
    appendMessage("tool", error.message, { title: t("code.error"), kind: "error" });
  }
});
document.getElementById("loginButton").addEventListener("click", () => {
  els.authModal.classList.remove("hidden");
  renderAuth();
});
document.getElementById("closeAuth").addEventListener("click", () => {
  els.authModal.classList.add("hidden");
});
document.querySelectorAll("[data-auth-tab]").forEach((tab) => {
  tab.addEventListener("click", () => {
    if (state.account?.account) {
      return;
    }
    document.querySelectorAll("[data-auth-tab]").forEach((node) => node.classList.remove("active"));
    document.querySelectorAll(".auth-pane").forEach((node) => node.classList.remove("active"));
    tab.classList.add("active");
    const name = tab.dataset.authTab;
    document.getElementById(`authPane${name[0].toUpperCase()}${name.slice(1)}`).classList.add("active");
  });
});
document.getElementById("startBrowserLogin").addEventListener("click", async () => {
  if (state.account?.account || state.authLogin?.loginId) {
    renderAuth();
    return;
  }
  try {
    const result = await window.codexDesktop.login({ type: "chatgpt" });
    state.authLogin = result;
    if (result.type === "alreadyAuthenticated") {
      state.authLogin = null;
      await refreshState();
      return;
    }
    if (result.type === "chatgpt") {
      els.browserLoginStatus.textContent = t("auth.browserOpened");
    }
    renderAuth();
  } catch (error) {
    els.browserLoginStatus.textContent = error.message;
  }
});
document.getElementById("startDeviceLogin").addEventListener("click", async () => {
  if (state.account?.account || state.authLogin?.loginId) {
    renderAuth();
    return;
  }
  try {
    const result = await window.codexDesktop.login({ type: "chatgptDeviceCode" });
    state.authLogin = result;
    if (result.type === "alreadyAuthenticated") {
      state.authLogin = null;
      await refreshState();
      return;
    }
    if (result.type === "chatgptDeviceCode") {
      els.deviceCode.textContent = result.userCode;
      els.deviceUrl.textContent = result.verificationUrl;
      els.deviceCodeBox.classList.remove("hidden");
      await window.codexDesktop.openExternal(result.verificationUrl);
    }
    renderAuth();
  } catch (error) {
    els.deviceUrl.textContent = error.message;
    els.deviceCodeBox.classList.remove("hidden");
  }
});
document.getElementById("saveApiKey").addEventListener("click", async () => {
  if (state.account?.account) {
    renderAuth();
    return;
  }
  const apiKey = els.apiKeyInput.value.trim();
  if (!apiKey) {
    return;
  }
  try {
    const result = await window.codexDesktop.login({ type: "apiKey", apiKey });
    if (result.type === "alreadyAuthenticated") {
      await refreshState();
      return;
    }
    els.apiKeyInput.value = "";
    await refreshState();
  } catch (error) {
    els.authAccountStatus.textContent = error.message;
  }
});
els.openDeviceUrl.addEventListener("click", async () => {
  const url = els.deviceUrl.textContent.trim();
  if (url) {
    await window.codexDesktop.openExternal(url);
  }
});
els.cancelLogin.addEventListener("click", async () => {
  if (!state.authLogin?.loginId) {
    return;
  }
  await window.codexDesktop.cancelLogin(state.authLogin.loginId);
  state.authLogin = null;
  renderAuth();
});
document.getElementById("logoutButton").addEventListener("click", async () => {
  try {
    await window.codexDesktop.logout();
    await refreshState();
  } catch (error) {
    els.authAccountStatus.textContent = error.message;
  }
});
document.getElementById("chooseWorkspace").addEventListener("click", chooseWorkspace);
document.getElementById("closeWindow").addEventListener("click", () => window.codexDesktop.windowClose());
document.getElementById("minimizeWindow").addEventListener("click", () => window.codexDesktop.windowMinimize());
document.getElementById("maximizeWindow").addEventListener("click", () => window.codexDesktop.windowMaximize());
document.getElementById("settingsButton").addEventListener("click", () => {
  renderSettings();
  els.settingsModal.classList.remove("hidden");
  if (!state.configRead && !state.configLoading) {
    loadSettingsConfig();
  }
  maybeLoadUsageData();
});
document.getElementById("closeSettings").addEventListener("click", () => {
  els.settingsModal.classList.add("hidden");
});
els.settingsModal.addEventListener("click", (event) => {
  if (event.target === els.settingsModal) {
    els.settingsModal.classList.add("hidden");
  }
});
document.getElementById("closeEditTurn")?.addEventListener("click", closeEditTurnDialog);
document.getElementById("cancelEditTurn")?.addEventListener("click", closeEditTurnDialog);
document.getElementById("submitEditTurn")?.addEventListener("click", regenerateFromEditedTurn);
els.editTurnModal?.addEventListener("click", (event) => {
  if (event.target === els.editTurnModal) {
    closeEditTurnDialog();
  }
});
els.editTurnText?.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    regenerateFromEditedTurn();
  }
});
els.settingsOpenAuth?.addEventListener("click", () => {
  els.settingsModal.classList.add("hidden");
  els.authModal.classList.remove("hidden");
  renderAuth();
});
els.settingsLogout?.addEventListener("click", async () => {
  try {
    await window.codexDesktop.logout();
    state.rateLimits = null;
    state.rateLimitsLoadedAt = 0;
    await refreshState();
  } catch (error) {
    if (els.settingsAccountDetail) {
      els.settingsAccountDetail.textContent = error.message;
    }
  }
});
els.settingsRefreshUsage?.addEventListener("click", () => {
  loadRateLimits({ force: true });
});
document.getElementById("settingsChooseWorkspace")?.addEventListener("click", chooseWorkspace);
document.querySelectorAll("[data-settings-tab]").forEach((tab) => {
  tab.addEventListener("click", () => {
    state.settingsTab = tab.dataset.settingsTab;
    renderSettings();
    if ((state.settingsTab === "configuration" || state.settingsTab === "mcp") && !state.configRead) {
      loadSettingsConfig();
    }
    maybeLoadUsageData();
  });
});
els.settingsLanguage?.addEventListener("change", () => {
  saveUiConfig({ language: els.settingsLanguage.value }).then(renderAll);
});
els.settingsRequireCtrlEnter?.addEventListener("change", () => {
  saveUiConfig({ requireCtrlEnterForLongPrompts: els.settingsRequireCtrlEnter.checked }).then(renderSettings);
});
els.settingsSpeed?.addEventListener("change", () => {
  saveUiConfig({ speed: els.settingsSpeed.value }).then(() => {
    renderSettings();
    renderModelControls();
  });
});
els.settingsFollowUpBehavior?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-value]");
  if (button) {
    saveUiConfig({ followUpBehavior: button.dataset.value }).then(renderSettings);
  }
});
els.settingsCodeReviewMode?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-value]");
  if (button) {
    saveUiConfig({ codeReviewMode: button.dataset.value }).then(renderSettings);
  }
});
els.settingsOpenConfig?.addEventListener("click", async () => {
  try {
    const file = await window.codexDesktop.openConfig();
    state.configSaveMessage = t("settings.openedFile", { file });
    renderSettings();
  } catch (error) {
    state.configError = error.message;
    renderSettings();
  }
});
els.settingsViewLicenses?.addEventListener("click", () => {
  window.codexDesktop.openLicenses();
});
els.settingsConfigDocs?.addEventListener("click", () => {
  window.codexDesktop.openExternal("https://github.com/openai/codex/blob/main/docs/config.md");
});
els.settingsMcpDocs?.addEventListener("click", () => {
  window.codexDesktop.openExternal("https://github.com/openai/codex/blob/main/docs/config.md#connecting-to-mcp-servers");
});
els.settingsMemoryDocs?.addEventListener("click", () => {
  window.codexDesktop.openExternal("https://help.openai.com/");
});
els.settingsAddMcpServer?.addEventListener("click", async () => {
  try {
    await window.codexDesktop.openConfig();
  } catch (error) {
    state.configError = error.message;
    renderSettings();
  }
});
els.settingsPersonality?.addEventListener("change", () => {
  saveUiConfig({ personality: els.settingsPersonality.value }).then(renderSettings);
});
els.settingsSavePersonalization?.addEventListener("click", () => {
  saveUiConfig({ customInstructions: els.settingsCustomInstructions?.value || "" }).then(() => {
    els.serverStatus.textContent = t("settings.customInstructionsApplied");
    renderSettings();
  });
});
els.settingsEnableMemories?.addEventListener("change", async () => {
  const memoriesEnabled = els.settingsEnableMemories.checked;
  try {
    await window.codexDesktop.updateMemoryPreferences({ memoriesEnabled });
    await saveUiConfig({ memoriesEnabled });
    els.serverStatus.textContent = t("settings.memorySaved");
  } catch (error) {
    els.serverStatus.textContent = error.message;
    els.settingsEnableMemories.checked = !memoriesEnabled;
  }
  renderSettings();
});
els.settingsSkipToolMemories?.addEventListener("change", () => {
  saveUiConfig({ skipToolAssistedMemories: els.settingsSkipToolMemories.checked }).then(renderSettings);
});
els.settingsResetMemories?.addEventListener("click", async () => {
  try {
    await window.codexDesktop.resetMemories();
    await window.codexDesktop.updateMemoryPreferences({ memoriesEnabled: false });
    await saveUiConfig({ memoriesEnabled: false, skipToolAssistedMemories: false });
    els.serverStatus.textContent = t("settings.memoryResetDone");
  } catch (error) {
    els.serverStatus.textContent = error.message;
  }
  renderSettings();
});
els.settingsOpenUsage?.addEventListener("click", () => {
  const account = state.account?.account;
  window.codexDesktop.openExternal(account?.type === "apiKey" ? "https://platform.openai.com/usage" : "https://chatgpt.com/");
});
els.settingsRefreshConfig?.addEventListener("click", loadSettingsConfig);
els.settingsSaveConfig?.addEventListener("click", saveSettingsConfig);
els.settingsReviewOpen?.addEventListener("change", () => {
  state.reviewOpen = els.settingsReviewOpen.checked;
  saveUiConfig({ reviewOpen: state.reviewOpen });
  renderReviewVisibility();
  renderSettings();
});
document.getElementById("settingsResetUi")?.addEventListener("click", () => {
  state.reviewOpen = false;
  state.selectedModel = "";
  state.selectedEffort = "";
  saveUiConfig({ reviewOpen: false, selectedModel: "", selectedEffort: "" });
  renderModelControls();
  renderReviewVisibility();
  renderSettings();
});
els.conversation.addEventListener("click", async (event) => {
  const copyButton = event.target.closest(".copy-code");
  if (copyButton) {
    event.preventDefault();
    event.stopPropagation();
    const block = copyButton.closest(".foldable-block, .code-block");
    const text = block?.querySelector("[data-copy-source]")?.textContent || block?.querySelector("code")?.textContent || "";
    await copyTextToClipboard(text, copyButton);
    return;
  }

  const foldToggle = event.target.closest("[data-fold-toggle]");
  if (foldToggle) {
    event.preventDefault();
    toggleFoldablePreview(foldToggle);
    return;
  }

  const userAction = event.target.closest("[data-user-action]");
  if (userAction) {
    event.preventDefault();
    event.stopPropagation();
    const messageIndex = Number.parseInt(userAction.dataset.messageIndex || "-1", 10);
    const message = state.messages[messageIndex];
    if (!message || message.role !== "user") {
      return;
    }
    if (userAction.dataset.userAction === "copy") {
      await copyTextToClipboard(message.text || "", userAction);
      return;
    }
    if (userAction.dataset.userAction === "edit") {
      openEditTurnDialog(messageIndex);
      return;
    }
  }

  const link = event.target.closest(".markdown-body a[href]");
  if (!link) {
    return;
  }
  const href = link.getAttribute("href");
  event.preventDefault();
  if (href.startsWith("#")) {
    return;
  }
  if (!/^(https?:|mailto:)/i.test(href)) {
    await openFileLink(href);
    return;
  }
  window.codexDesktop.openExternal(href);
});
els.conversation.addEventListener("keydown", (event) => {
  if (event.target.closest(".copy-code")) {
    return;
  }
  const foldToggle = event.target.closest("[data-fold-toggle]");
  if (!foldToggle || (event.key !== "Enter" && event.key !== " ")) {
    return;
  }
  event.preventDefault();
  toggleFoldablePreview(foldToggle);
});
els.conversation.addEventListener(
  "toggle",
  (event) => {
    const details = event.target.closest?.(".foldable-block.reasoning[data-reasoning-id]");
    if (!details) {
      return;
    }
    const message = findStreamingMessage(details.dataset.reasoningId);
    if (message) {
      message.open = details.open;
      message.userToggled = true;
    }
  },
  true,
);
els.commitButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  els.commitMenu?.classList.toggle("hidden");
  els.modelMenu.classList.add("hidden");
  els.permissionMenu?.classList.add("hidden");
});
els.modelChoice.addEventListener("click", (event) => {
  event.stopPropagation();
  els.modelMenu.classList.toggle("hidden");
  els.permissionMenu?.classList.add("hidden");
  els.commitMenu?.classList.add("hidden");
});
els.permissionChoice?.addEventListener("click", (event) => {
  event.stopPropagation();
  els.permissionMenu.classList.toggle("hidden");
  els.modelMenu.classList.add("hidden");
  els.commitMenu?.classList.add("hidden");
});
document.addEventListener("click", (event) => {
  if (!event.target.closest(".context-menu")) {
    hideContextMenu();
  }
  if (!event.target.closest(".model-control")) {
    els.modelMenu.classList.add("hidden");
  }
  if (!event.target.closest(".permission-control")) {
    els.permissionMenu?.classList.add("hidden");
  }
  if (!event.target.closest(".commit-control")) {
    els.commitMenu?.classList.add("hidden");
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    hideContextMenu();
    els.modelMenu.classList.add("hidden");
    els.permissionMenu?.classList.add("hidden");
    els.commitMenu?.classList.add("hidden");
  }
});

refreshState().catch((error) => {
  els.serverStatus.textContent = error.message;
});

function bindWheelScroll(element) {
  if (!element) {
    return;
  }
  element.addEventListener(
    "wheel",
    (event) => {
      if (event.defaultPrevented || event.deltaY === 0) {
        return;
      }
      const nestedScroller = nearestScrollableElement(event.target, element);
      if (nestedScroller && nestedScroller !== element && canScrollY(nestedScroller, event.deltaY)) {
        return;
      }

      const maxScroll = element.scrollHeight - element.clientHeight;
      if (maxScroll <= 0 || !canScrollY(element, event.deltaY)) {
        return;
      }

      const nextTop = Math.max(0, Math.min(maxScroll, element.scrollTop + wheelDeltaYPixels(event, element)));
      if (nextTop !== element.scrollTop) {
        element.scrollTop = nextTop;
        event.preventDefault();
      }
    },
    { passive: false },
  );
}

function nearestScrollableElement(target, boundary) {
  let node = target instanceof Element ? target : target?.parentElement;
  while (node && node !== boundary) {
    const style = window.getComputedStyle(node);
    if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return boundary;
}

function canScrollY(element, deltaY) {
  const maxScroll = element.scrollHeight - element.clientHeight;
  if (maxScroll <= 0) {
    return false;
  }
  if (deltaY < 0) {
    return element.scrollTop > 0;
  }
  if (deltaY > 0) {
    return element.scrollTop < maxScroll;
  }
  return false;
}

function wheelDeltaYPixels(event, element) {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    return event.deltaY * 16;
  }
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return event.deltaY * element.clientHeight;
  }
  return event.deltaY;
}

bindWheelScroll(els.conversation);
bindWheelScroll(document.querySelector(".sidebar"));
bindWheelScroll(els.fileSummary);
bindWheelScroll(els.diffViewer);

document.getElementById("closeReview").addEventListener("click", () => {
  state.reviewOpen = false;
  saveUiConfig({ reviewOpen: false });
  renderReviewVisibility();
});

els.reviewOpen.addEventListener("click", () => {
  state.reviewOpen = true;
  saveUiConfig({ reviewOpen: true });
  renderReviewVisibility();
});
