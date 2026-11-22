import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ZCODE_OFFICIAL_PLUGIN_MARKETPLACE } from "@zcode/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolveOfficialPluginRoots } from "../src/app/bundled-plugins.js";
import { OFFICIAL_PLUGIN_DEFINITIONS } from "../src/app/official-plugin-definitions.js";
import { resolveZCodePlugins } from "../src/plugins.js";
import { listPluginUiSurfacesFromPlugins } from "../src/zcode-protocol/plugin-ui-surfaces.js";
import { ensureMosPluginDist } from "./mos-plugin-build.js";

/**
 * MOS 官方插件启动路径验收（适配上游 v3.18.2 的 async 发现 API）。
 *
 * 在真实集成边界上证明完整链条，不造平行插件运行时：
 *   官方定义（OfficialPluginDefinition）
 *     → 构建（scripts/build.mjs 产出 requiredSeedPaths 钉住的 dist/server.mjs）
 *     → seed（resolveOfficialPluginRoots 的官方缓存管线，无 mock）
 *     → manifest 解析（resolveZCodePlugins 真实发现 + ${ZCODE_PLUGIN_ROOT} /
 *       ${user_config.researchWorkspace} 模板替换 + workspace isolation + 插件身份 env）
 *     → stdio 进程（直接拉起 manifest 声明的 stdio 入口 dist/server.mjs）
 *     → MCP 调用（listTools / callTool / readResource）。
 *
 * 同文件一并钉住 launcher 可见性（listPluginUiSurfacesFromPlugins 只按 enabled 过滤）
 * ≠ 受保护研究数据可达性（面板静态骨架 + 未 opt-in 时工具全部 typed refusal）。
 */

const MOS_PLUGIN_ID = `mos@${ZCODE_OFFICIAL_PLUGIN_MARKETPLACE}`;
const RESEARCH_SERVER_KEY = "plugin:mos:research";

// 预期的外部契约（与 mos-plugin/src/contract.ts 的单一事实源机械一致；此处内联，
// 让断言独立于被测插件包——ios-simulator 内联 fixture 的同款纪律）。
const SIX_TOOLS = [
  "mos_expand_themes",
  "mos_estimate_scan_cost",
  "mos_get_connection_state",
  "mos_get_scan_results",
  "mos_list_saved_scans",
  "mos_run_niche_scan",
];
const THREE_SURFACE_URIS = [
  "ui://mos/evidence.html",
  "ui://mos/niche-explorer.html",
  "ui://mos/scan-results.html",
];

describe("mos official-plugin launch path (definition → build → seed → resolution → stdio → MCP)", () => {
  let storageRoot: string;
  let workspace: string;
  let userConfigPath: string;
  let mosCacheRoot: string;
  let mosVersion: string;

  const posixPath = (value: string): string => value.replace(/\\/g, "/");

  beforeAll(async () => {
    // 仓库内的插件包目录（bootstrap/tests → ../../mos-plugin）。
    // 启动路径证据必须来自真实打包产物：并行安全地确保官方构建脚本产出存在。
    ensureMosPluginDist();

    storageRoot = await mkdtemp(join(tmpdir(), "mos-launch-storage-"));
    workspace = await mkdtemp(join(tmpdir(), "mos-launch-workspace-"));
    userConfigPath = join(storageRoot, "config.json");

    // 真实 seed：官方插件缓存管线（filesystem 源 → 不可变 cache + bundled marketplace 分片）。
    await resolveOfficialPluginRoots({ storageRoot });

    const definition = OFFICIAL_PLUGIN_DEFINITIONS.find((entry) => entry.name === "mos");
    expect(definition).toBeDefined();
    mosVersion = definition!.version;
    mosCacheRoot = join(storageRoot, "cache", ZCODE_OFFICIAL_PLUGIN_MARKETPLACE, "mos", mosVersion);

    // seed 完整性：官方定义 requiredSeedPaths 钉住的两个产物都在缓存里。
    expect(existsSync(join(mosCacheRoot, ".zcode-plugin", "plugin.json"))).toBe(true);
    expect(existsSync(join(mosCacheRoot, "dist", "server.mjs"))).toBe(true);
  }, 120_000);

  afterAll(async () => {
    await rm(storageRoot, { force: true, recursive: true });
    await rm(workspace, { force: true, recursive: true });
  });

  async function writeUserConfig(enabledPlugins: Record<string, boolean>, options: Record<string, unknown>) {
    await writeFile(
      userConfigPath,
      JSON.stringify({ plugins: { enabledPlugins, options } }),
      "utf8",
    );
  }

  async function discoverMos(researchWorkspace: boolean) {
    await writeUserConfig({ [MOS_PLUGIN_ID]: true }, { [MOS_PLUGIN_ID]: { researchWorkspace } });
    return await resolveZCodePlugins({
      env: {},
      pluginStorageRoot: storageRoot,
      userConfigPath,
      workingDirectory: workspace,
    });
  }

  async function discoverAllDisabled() {
    await writeUserConfig({}, {});
    return await resolveZCodePlugins({
      env: {},
      pluginStorageRoot: storageRoot,
      userConfigPath,
      workingDirectory: workspace,
    });
  }

  // office-runtime smoke 的同款启动纪律：拉起 seed 缓存里的 stdio 入口验证 MCP 行为。
  async function connectResearch(researchWorkspace: boolean, name: string): Promise<Client> {
    const outcome = await discoverMos(researchWorkspace);
    const mcp = outcome.mcpServers[RESEARCH_SERVER_KEY]!;
    const client = new Client({ name, version: "0.0.0" });
    await client.connect(
      new StdioClientTransport({
        args: [mcp.args![mcp.args!.length - 1]!],
        command: mcp.command,
        cwd: mcp.cwd,
        env: { ...mcp.env, PATH: process.env.PATH ?? "" },
        stderr: "pipe",
      }),
    );
    return client;
  }

  it("resolves the seeded manifest through the real discovery pipeline with opt-in substitution", async () => {
    const outcome = await discoverMos(false);
    const plugin = outcome.plugins.find((entry) => entry.id === MOS_PLUGIN_ID);
    expect(plugin).toBeDefined();
    // 从 seed 缓存加载（而非仓库目录），marketplace 为官方源。
    expect(plugin).toMatchObject({
      enabled: true,
      marketplace: ZCODE_OFFICIAL_PLUGIN_MARKETPLACE,
      name: "mos",
      version: mosVersion,
    });
    expect(posixPath(plugin!.rootPath)).toBe(posixPath(mosCacheRoot));

    const mcp = outcome.mcpServers[RESEARCH_SERVER_KEY];
    expect(mcp).toBeDefined();
    expect(mcp).toMatchObject({ cwd: workspace, isolation: "workspace", type: "stdio" });
    expect(mcp.args).toBeDefined();
    // 解析出的 server 入口指向 seed 缓存内的 dist/server.mjs。
    expect(posixPath(mcp.args!.at(-1)!)).toBe(posixPath(join(mosCacheRoot, "dist", "server.mjs")));
    // ${user_config.researchWorkspace} → manifest env 注入（默认 false 的 opt-in 臂）。
    expect(mcp.env.MOS_RESEARCH_WORKSPACE).toBe("false");
    // 插件身份由 resolver 权威写入，manifest 无法伪造。
    expect(mcp.env.ZCODE_PLUGIN_ID).toBe(MOS_PLUGIN_ID);

    // 打开 researchWorkspace 后，同一个解析管线给出另一臂。
    const optedIn = (await discoverMos(true)).mcpServers[RESEARCH_SERVER_KEY];
    expect(optedIn.env.MOS_RESEARCH_WORKSPACE).toBe("true");
  });

  it("keeps a disabled (installed-but-not-enabled) mos plugin out of the launcher listing", async () => {
    const outcome = await discoverAllDisabled();
    const plugin = outcome.plugins.find((entry) => entry.id === MOS_PLUGIN_ID);
    expect(plugin).toBeDefined();
    expect(plugin?.enabled).toBe(false);
    // S0b：未显式启用 → 无 launcher 入口、无 MCP server 解析。
    const surfaces = listPluginUiSurfacesFromPlugins(outcome.plugins);
    expect(surfaces.map((surface) => surface.pluginId)).not.toContain(MOS_PLUGIN_ID);
    expect(outcome.mcpServers[RESEARCH_SERVER_KEY]).toBeUndefined();
  });

  it("S1 launcher visibility is not data access: opted-out surfaces are listed yet carry no research data", { timeout: 90_000 }, async () => {
    const outcome = await discoverMos(false);
    // listUiSurfaces 只按 enabled 过滤，不读 userConfig——S1（enabled + 未 opt-in）
    // 下三个入口照常列出（可见性，不是数据可达性）。
    const surfaces = listPluginUiSurfacesFromPlugins(outcome.plugins).filter(
      (surface) => surface.pluginId === MOS_PLUGIN_ID,
    );
    expect(surfaces.map((surface) => surface.id).sort()).toEqual([
      "evidence",
      "niche-explorer",
      "scan-results",
    ]);
    for (const surface of surfaces) {
      expect(surface.server).toBe(RESEARCH_SERVER_KEY);
      expect(surface.resourceUri).toMatch(/^ui:\/\/mos\//);
    }

    // 数据可达性必须在真实 stdio 进程上证明：面板是静态骨架，数据工具全部 typed refusal。
    const client = await connectResearch(false, "mos-launch-s1");
    try {
      const tools = await client.listTools();
      expect([...tools.tools.map((tool) => tool.name)].sort()).toEqual([...SIX_TOOLS].sort());

      // 未 opt-in（S1）：数据读取与主题扩展都拒绝，信封永不携带扫描信息。
      const refusals = await Promise.all([
        client.callTool({ arguments: {}, name: "mos_list_saved_scans" }),
        client.callTool({
          arguments: { niche: "budgeting apps for freelancers" },
          name: "mos_expand_themes",
        }),
      ]);
      for (const result of refusals) {
        const envelope = JSON.parse((result.content as Array<{ text: string }>)[0].text);
        expect(envelope).toEqual({
          kind: "refused",
          refusal: { code: "not_opted_in", message: expect.any(String) },
        });
      }

      // 三个面板资源：mcp-app mime + 静态骨架（明确声明未显示研究数据，且无占位数据）。
      for (const uri of THREE_SURFACE_URIS) {
        const resource = await client.readResource({ uri });
        expect(resource.contents).toHaveLength(1);
        const entry = resource.contents[0]!;
        expect(entry.mimeType).toBe("text/html;profile=mcp-app");
        const html = String((entry as { text?: string }).text).toLowerCase();
        expect(html).toContain("no research data is shown on this surface yet");
        expect(html).not.toMatch(/views: [0-9]|subscribers: [0-9]|quota used: [0-9]/);
      }
    } finally {
      await client.close();
    }
  });

  it("spawns the packaged stdio server end-to-end and refuses with not_connected when opted in (S2)", { timeout: 90_000 }, async () => {
    const client = await connectResearch(true, "mos-launch-s2");
    try {
      const tools = await client.listTools();
      expect([...tools.tools.map((tool) => tool.name)].sort()).toEqual([...SIX_TOOLS].sort());
      // 已 opt-in、尚无已连接的 YouTube 授权（Wave 1 无宿主桥）：not_connected（S2）。
      const result = await client.callTool({ arguments: {}, name: "mos_get_connection_state" });
      const envelope = JSON.parse((result.content as Array<{ text: string }>)[0].text);
      expect(envelope).toEqual({
        kind: "refused",
        refusal: { code: "not_connected", message: expect.any(String) },
      });
    } finally {
      await client.close();
    }
  });
});
