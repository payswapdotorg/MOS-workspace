import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  PANEL_MIME_TYPE,
  SURFACES,
  TOOL_NAMES,
  envelopeText,
  readResearchWorkspaceSnapshot,
  snapshotRefusal,
  type MosToolEnvelope,
  type MosToolName,
} from "./contract.ts";
import { renderPanelHtml } from "./panels.ts";

/**
 * MOS MCP server（Wave 1 骨架：六工具注册 + typed refusal + 三个 Class A 信息面板）。
 *
 * - 六个 `mos_*` 工具全部注册（模型可见、`readOnlyHint`——扫描执行在宿主侧受配额
 *   账本约束，插件进程本身不发起任何 YouTube API 调用）。
 * - 三个 Class A `ui://` 面板资源（信息性；OAuth 连接卡是 Class B，由 host 渲染——
 *   本 server 永不提供授权内容）。
 * - Wave 1 无宿主桥：所有数据工具返回快照式 typed refusal（未 opt-in →
 *   `not_opted_in`；已 opt-in 无连接 → `not_connected`）。Wave 2 起工具经宿主桥
 *   （IMosConnectionService / IMosResearchService）访问真实数据与配额账本。
 * - stderr 日志只带 tool 名与 typed 码，零凭据材料。
 */

const REFUSAL_NOTE =
  "Answers come from the host research services when the research workspace is armed; otherwise a typed refusal is returned.";

export interface MosServerOptions {
  env?: NodeJS.ProcessEnv;
}

/** registerTool 回调的 extra 面（SDK RequestHandlerExtra 的最小投影）。 */
interface ToolCallExtra {
  signal?: AbortSignal;
  _meta?: unknown;
}

export function createMosServer(options: MosServerOptions = {}): McpServer {
  const server = new McpServer({ name: "mos", version: "0.1.0" });
  const env = options.env ?? process.env;
  const researchWorkspace = readResearchWorkspaceSnapshot(env);
  const refusal = snapshotRefusal(researchWorkspace);

  const refusalResult = (tool: string) => {
    const envelope: MosToolEnvelope = { kind: "refused", refusal: { ...refusal } };
    process.stderr.write(`[mos] ${tool}: refused ${refusal.code}\n`);
    return { content: [{ type: "text" as const, text: envelopeText(envelope) }] };
  };

  const toolHandler = (tool: MosToolName) => async (args: unknown, extra: ToolCallExtra) => {
    void args;
    void extra;
    return refusalResult(tool);
  };

  server.registerTool(
    TOOL_NAMES[0],
    {
      title: "Expand a niche into search themes",
      description:
        "Expand an ordinary-language niche into 4-7 editable search themes (MOS-4.0 Workflow C). " +
        "Read-only analysis; never runs a search. " + REFUSAL_NOTE,
      inputSchema: {
        niche: z.string().min(1).describe("The niche in the user's own words."),
        format: z.enum(["all", "shorts", "long-form"]).optional().describe("Content format focus, if stated."),
        region: z.string().optional().describe("ISO region code, if stated."),
      },
      annotations: { readOnlyHint: true },
    },
    toolHandler(TOOL_NAMES[0]) as never,
  );

  server.registerTool(
    TOOL_NAMES[1],
    {
      title: "Estimate scan cost",
      description:
        "Estimate the YouTube API quota cost (search calls + units) of a planned niche scan before it runs " +
        "(MOS-4.0 Workflow D). Read-only. " + REFUSAL_NOTE,
      inputSchema: {
        niche: z.string().min(1).describe("The niche to scan."),
        themes: z.array(z.string().min(1)).min(1).describe("Approved search themes."),
        depth: z.enum(["quick", "standard", "deep"]).optional().describe("Scan depth; default standard."),
      },
      annotations: { readOnlyHint: true },
    },
    toolHandler(TOOL_NAMES[1]) as never,
  );

  server.registerTool(
    TOOL_NAMES[2],
    {
      title: "Run a niche scan",
      description:
        "Execute a niche scan under the quota budget with visible progress: discovery, enrichment, " +
        "channel baselines, ranking (mos-scoring-v1) and classification (Breakout / Rising / Evergreen / " +
        "New-Entrant) (MOS-4.0 Workflows D-G). Executed by the host engine; the plugin process holds no " +
        "credentials. " + REFUSAL_NOTE,
      inputSchema: {
        niche: z.string().min(1).describe("The niche to scan."),
        themes: z.array(z.string().min(1)).min(1).describe("Approved search themes."),
        depth: z.enum(["quick", "standard", "deep"]).optional().describe("Scan depth; default standard."),
        dateWindowDays: z.number().int().min(7).max(730).optional().describe("Publication window in days; default 365."),
        exclusions: z.array(z.string().min(1)).max(20).optional().describe("Terms to exclude (max 20)."),
      },
      annotations: { readOnlyHint: true },
    },
    toolHandler(TOOL_NAMES[2]) as never,
  );

  server.registerTool(
    TOOL_NAMES[3],
    {
      title: "Get scan results",
      description:
        "Read the ranked results, per-factor score explanations and honest status (complete/partial/failed) " +
        "of a scan (MOS-4.0 Workflows F-G). Read-only. " + REFUSAL_NOTE,
      inputSchema: {
        scanId: z.string().min(1).describe("Identifier of the scan."),
      },
      annotations: { readOnlyHint: true },
    },
    toolHandler(TOOL_NAMES[3]) as never,
  );

  server.registerTool(
    TOOL_NAMES[4],
    {
      title: "List saved scans",
      description:
        "List saved research scans with collection dates and staleness badges (7-day statistics TTL, " +
        "30-day scan staleness) (MOS-4.0 Workflow I). Read-only. " + REFUSAL_NOTE,
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    toolHandler(TOOL_NAMES[4]) as never,
  );

  server.registerTool(
    TOOL_NAMES[5],
    {
      title: "Get connection state",
      description:
        "Read the YouTube connection state (Google OAuth read-only or API-key mode) without ever " +
        "returning token material (MOS-4.0 Workflow A). Read-only. " + REFUSAL_NOTE,
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    toolHandler(TOOL_NAMES[5]) as never,
  );

  for (const surface of SURFACES) {
    server.registerResource(
      surface.id,
      surface.resourceUri,
      { mimeType: PANEL_MIME_TYPE },
      async (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: PANEL_MIME_TYPE,
            text: renderPanelHtml(surface.id),
          },
        ],
      }),
    );
  }

  return server;
}
