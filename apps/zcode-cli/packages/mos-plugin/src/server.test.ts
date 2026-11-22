import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";
import { PANEL_MIME_TYPE, RESEARCH_WORKSPACE_ENV, SURFACES, TOOL_NAMES } from "./contract.ts";
import { renderPanelHtml } from "./panels.ts";
import { createMosServer } from "./server.ts";

/** Wave 1 验收：六工具注册、typed refusal 法则、三个信息表面资源。 */

async function connectClient(env: NodeJS.ProcessEnv) {
  const server = createMosServer({ env });
  const client = new Client({ name: "mos-plugin-test", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

let closer: (() => Promise<void>) | undefined;
afterEach(async () => {
  await closer?.();
  closer = undefined;
});

describe("tool registration", () => {
  it("registers exactly the six declared tools", async () => {
    const { client, server } = await connectClient({});
    closer = async () => {
      await client.close();
      await server.close();
    };
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name).sort()).toEqual([...TOOL_NAMES].sort());
  });
});

describe("typed refusals", () => {
  const cases: Array<{ env: NodeJS.ProcessEnv; code: string }> = [
    { env: {}, code: "not_opted_in" },
    { env: { [RESEARCH_WORKSPACE_ENV]: "false" }, code: "not_opted_in" },
    { env: { [RESEARCH_WORKSPACE_ENV]: "true" }, code: "not_connected" },
  ];
  for (const { env, code } of cases) {
    it(`every tool refuses ${code} when env is ${JSON.stringify(env)}`, async () => {
      const { client, server } = await connectClient(env);
      closer = async () => {
        await client.close();
        await server.close();
      };
      for (const tool of TOOL_NAMES) {
        // 各工具的最小合法入参（满足 zod schema；结果仍是 typed refusal）。
        const args: Record<string, unknown> =
          tool === "mos_expand_themes"
            ? { niche: "sample" }
            : tool === "mos_estimate_scan_cost" || tool === "mos_run_niche_scan"
              ? { niche: "sample", themes: ["sample theme"] }
              : tool === "mos_get_scan_results"
                ? { scanId: "sample" }
                : {};
        const result = await client.callTool({ arguments: args, name: tool });
        expect(result.isError).toBeFalsy();
        const text = (result.content as Array<{ type: string; text?: string }>).find(
          (entry) => entry.type === "text",
        )?.text;
        expect(text).toBeTruthy();
        const envelope = JSON.parse(text as string);
        expect(envelope).toEqual({
          kind: "refused",
          refusal: { code, message: expect.any(String) },
        });
      }
    });
  }

  it("never conflates the two reachable codes", async () => {
    const { client, server } = await connectClient({ [RESEARCH_WORKSPACE_ENV]: "true" });
    closer = async () => {
      await client.close();
      await server.close();
    };
    const result = await client.callTool({ arguments: {}, name: TOOL_NAMES[5] });
    const envelope = JSON.parse(
      (result.content as Array<{ type: string; text?: string }>)[0]!.text as string,
    );
    expect(envelope.refusal.code).not.toBe("not_opted_in");
  });
});

describe("informational surfaces", () => {
  it("serves every declared ui:// resource with the mcp-app mime", async () => {
    const { client, server } = await connectClient({});
    closer = async () => {
      await client.close();
      await server.close();
    };
    for (const surface of SURFACES) {
      const resource = await client.readResource({ uri: surface.resourceUri });
      expect(resource.contents).toHaveLength(1);
      const entry = resource.contents[0]!;
      expect(entry.mimeType).toBe(PANEL_MIME_TYPE);
      expect(String((entry as { text?: string }).text)).toContain(
        "no research data is shown on this surface yet",
      );
    }
  });

  it("panels stay informational, dependency-free and credential-free", () => {
    for (const surface of SURFACES) {
      const html = renderPanelHtml(surface.id);
      const lowered = html.toLowerCase();
      for (const forbidden of ["views:", "subscribers:", "quota used:"]) {
        expect(lowered.includes(forbidden), `${surface.id} must not render placeholder data`).toBe(false);
      }
      for (const forbidden of ["<script src", '<link rel="stylesheet"']) {
        expect(html.includes(forbidden), `${surface.id} must stay dependency-free`).toBe(false);
      }
    }
  });
});
