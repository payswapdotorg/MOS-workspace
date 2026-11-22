/**
 * MOS 插件契约（Wave 1 骨架；对齐 payswapdotorg/MOS-4.0 的产品语义）。
 *
 * 纪律：MCP server 进程不持有任何 YouTube 凭据、配额账本或扫描数据。六个 `mos_*`
 * 工具是 thin proxy；真实数据与连接状态属于 host 侧服务（MOS-4.0 的
 * `IMosConnectionService` / `IMosResearchService`，经 `packages/mos` 引擎）。
 * Wave 1 没有宿主桥：refusal 判定基于启动时的 `MOS_RESEARCH_WORKSPACE` env 快照
 * （来自 manifest `${user_config.researchWorkspace}` 解析），live 语义（连接态、
 * 配额）由 Wave 2 的宿主桥实现——本文件的行为与宿主语义结构等价（相同的 typed codes）。
 */

export const SERVER_NAME = "mos";
export const PLUGIN_VERSION = "0.1.0";

/** `ui://` 资源的 MIME（mcp-app 契约，packages/shared/src/mcp-apps/contract.ts:10）。 */
export const PANEL_MIME_TYPE = "text/html;profile=mcp-app";

/** manifest `userConfig.researchWorkspace` 经 `${user_config.researchWorkspace}` 注入的 env 键。 */
export const RESEARCH_WORKSPACE_ENV = "MOS_RESEARCH_WORKSPACE";

/** 六工具；顺序即注册顺序。 */
export const TOOL_NAMES = [
  "mos_expand_themes",
  "mos_estimate_scan_cost",
  "mos_run_niche_scan",
  "mos_get_scan_results",
  "mos_list_saved_scans",
  "mos_get_connection_state",
] as const;
export type MosToolName = (typeof TOOL_NAMES)[number];

/**
 * 状态拒绝码（三个 typed code 不得混淆）：
 * - `not_opted_in`      S1：插件启用、用户未 opt-in（researchWorkspace=false）
 * - `not_connected`     S2：已 opt-in、尚无已连接的 YouTube 授权（Google OAuth 或 API key）
 * - `engine_disabled`   残留调用：禁用/卸载前的旧会话（Wave 1 不可达——需要宿主桥绑定
 *   撤销；Wave 2+ 实现。此处仅定义类型保持三个 code 的单一事实源）
 */
export type MosRefusalCode = "not_opted_in" | "not_connected" | "engine_disabled";

export interface MosRefusal {
  code: MosRefusalCode;
  message: string;
}

/**
 * 宿主桥失败（Wave 2+）：已验签的桥接错误与子进程侧 typed 失败。桥接码与三码业务
 * 拒绝**永不混淆**。
 */
export interface MosBridgeFailure {
  code: string;
  message: string;
  retryable: boolean;
}

/**
 * 所有 `mos_*` 工具的统一响应信封：业务数据、typed refusal 或 typed 桥失败，
 * 永不裸错误。
 */
export type MosToolEnvelope<T = unknown> =
  | { kind: "ok"; data: T }
  | { kind: "refused"; refusal: MosRefusal }
  | { kind: "bridge_failure"; failure: MosBridgeFailure };

/**
 * Class A 信息性表面：全部为 informational；OAuth 连接卡是 Class B，由 host 渲染，
 * 永不声明在 `ui.surfaces[]`。
 */
export const SURFACES = [
  {
    id: "niche-explorer",
    resourceUri: "ui://mos/niche-explorer.html",
    title: { "en-US": "Niche Explorer", "zh-CN": "细分领域探索" },
    icon: "compass",
  },
  {
    id: "scan-results",
    resourceUri: "ui://mos/scan-results.html",
    title: { "en-US": "Scan Results", "zh-CN": "扫描结果" },
    icon: "list",
  },
  {
    id: "evidence",
    resourceUri: "ui://mos/evidence.html",
    title: { "en-US": "Evidence", "zh-CN": "证据与来源" },
    icon: "receipt",
  },
] as const;
export type MosSurfaceId = (typeof SURFACES)[number]["id"];

/** Wave 1 的快照式研究模式状态（env 解析结果）。 */
export function readResearchWorkspaceSnapshot(env: NodeJS.ProcessEnv): boolean {
  return env[RESEARCH_WORKSPACE_ENV] === "true";
}

/** Wave 1 的统一拒绝：未 opt-in → `not_opted_in`；已 opt-in 无连接 → `not_connected`。 */
export function snapshotRefusal(researchWorkspace: boolean): MosRefusal {
  return researchWorkspace
    ? {
        code: "not_connected",
        message:
          "MOS research workspace is enabled, but no YouTube authorization is connected yet. " +
          "Connect a Google account (read-only) or configure an API key before using research tools.",
      }
    : {
        code: "not_opted_in",
        message:
          "MOS research workspace is not enabled. Turn on the 'Research workspace' " +
          "option in the MOS plugin settings, then try again.",
      };
}

/** 信封序列化（工具返回的 JSON 文本）。 */
export function envelopeText<T>(envelope: MosToolEnvelope<T>): string {
  return JSON.stringify(envelope);
}
