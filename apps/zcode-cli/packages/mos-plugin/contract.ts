/**
 * MOS 插件对外契约：官方 MOS 工作区插件（YouTube Content Intelligence，对齐
 * payswapdotorg/MOS-4.0 的产品语义）对外暴露什么、构建后保证产出什么。
 * 运行时契约（工具语义、typed refusal 码、表面纪律）见 src/contract.ts；
 * 这里是模块级摘要。
 */

/** 插件构建后在插件根目录下必定存在的产物（官方 seed 的 requiredSeedPaths 与之对齐）。 */
export const MOS_PLUGIN_OUTPUTS = [".zcode-plugin/plugin.json", "dist/server.mjs"] as const;

/** 六个模型可见工具（manifest mcpServers.research 声明的 server 所注册）。 */
export const MOS_TOOL_NAMES = [
  "mos_expand_themes",
  "mos_estimate_scan_cost",
  "mos_run_niche_scan",
  "mos_get_scan_results",
  "mos_list_saved_scans",
  "mos_get_connection_state",
] as const;

/** 三个 Class A 信息性表面（authorization / OAuth 连接卡是 Class B，永不在此声明）。 */
export const MOS_SURFACE_IDS = ["niche-explorer", "scan-results", "evidence"] as const;

/** manifest userConfig 声明的唯一开关：researchWorkspace（默认 false，opt-in 即 S1→S2）。 */
export const MOS_OPT_IN_OPTION = "researchWorkspace";

/**
 * 插件自有 env 命名空间。manifest `mcpServers.*.env` 注入的是插件子进程 env（经
 * `${user_config.*}` 解析），属插件自有变量——命名跟随既有官方插件先例
 * （`PAYSWAP_` / `ANDROID_PLUGIN_SDK_PATH` / `IOS_SIM_DEFAULT_DEVICE`），不适用 CLI
 * `AGENTS.md` 面向**项目自有**（宿主进程）变量的 `ZCODE_` 前缀规则。本插件新增 env
 * 键必须落在此命名空间内（契约测试机械校验 manifest）。
 */
export const MOS_ENV_NAMESPACE = "MOS_";

/** opt-in 经 manifest env 注入的键（`${user_config.researchWorkspace}` 的注入目标）。 */
export const MOS_RESEARCH_WORKSPACE_ENV = "MOS_RESEARCH_WORKSPACE";

export interface MosPluginContract {
  /** 构建保证产出的文件，相对插件根目录。 */
  outputs: typeof MOS_PLUGIN_OUTPUTS;
  /** MCP server 注册的六个工具名。 */
  tools: readonly string[];
  /** ui.surfaces[] 声明的信息性表面 id。 */
  surfaces: readonly string[];
  /** opt-in 布尔选项名（默认 false）。 */
  optInOption: string;
}
