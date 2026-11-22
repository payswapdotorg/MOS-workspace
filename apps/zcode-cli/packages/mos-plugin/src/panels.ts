import { SURFACES, type MosSurfaceId } from "./contract.ts";

/**
 * Class A 信息性表面的 `ui://` HTML 资源。
 *
 * Wave 1 约束：面板是静态骨架——数据管线（panel → 宿主桥 → IMosResearchService →
 * packages/mos 引擎）属于 Wave 2+。面板内容因此只描述自身与状态指引，永不渲染任何
 * （哪怕是占位的）扫描数据或统计数字；这与「server 无凭据、无配额状态」的纪律一致。
 * 所有面板零外部依赖：无外链脚本、无网络请求、无字体/资源引用（沙箱 CSP 友好）。
 */

interface PanelContent {
  heading: string;
  headingZh: string;
  lede: string;
  ledeZh: string;
}

const PANEL_CONTENT: Record<MosSurfaceId, PanelContent> = {
  "niche-explorer": {
    heading: "MOS Niche Explorer",
    headingZh: "MOS 细分领域探索",
    lede: "Describe a niche, approve its search themes, and run an evidence-backed discovery scan.",
    ledeZh: "描述一个细分领域，确认搜索主题，运行有证据支撑的发现扫描。",
  },
  "scan-results": {
    heading: "MOS Scan Results",
    headingZh: "MOS 扫描结果",
    lede: "Ranked videos with score explanations, honest partial/failed statuses and quota actually spent.",
    ledeZh: "带评分解释的视频排名，诚实标注部分失败状态与实际消耗的配额。",
  },
  evidence: {
    heading: "MOS Evidence",
    headingZh: "MOS 证据与来源",
    lede: "Provenance records, observation history and collection dates behind every claim.",
    ledeZh: "每个结论背后的来源记录、观测历史与采集日期。",
  },
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderPanelHtml(surfaceId: MosSurfaceId): string {
  const content = PANEL_CONTENT[surfaceId];
  const surface = SURFACES.find((entry) => entry.id === surfaceId);
  if (!surface || !content) throw new Error(`Unknown MOS surface: ${surfaceId}`);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(content.heading)}</title>
<style>
  :root { color-scheme: light dark; }
  @media (prefers-color-scheme: dark) {
    body { --bg: #17171a; --fg: #ececf1; --border: #2c2c33; }
  }
  @media (prefers-color-scheme: light) {
    body { --bg: #ffffff; --fg: #26262c; --border: #e4e4e9; }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
      "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    background: var(--bg);
    color: var(--fg);
  }
  main { padding: 24px; max-width: 640px; }
  h1 { font-size: 16px; font-weight: 600; margin: 0 0 8px; letter-spacing: 0.1px; }
  p.lede { font-size: 13px; line-height: 1.6; margin: 0 0 20px; opacity: 0.85; }
  .card {
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 16px;
    font-size: 13px;
    line-height: 1.6;
  }
  .card .zh { display: block; opacity: 0.75; margin-top: 6px; }
  .state { font-weight: 600; margin-bottom: 4px; }
  ol { margin: 10px 0 0; padding-left: 18px; }
  li { margin: 3px 0; }
  footer { margin-top: 16px; font-size: 11px; opacity: 0.55; }
</style>
</head>
<body>
<main>
  <h1>${escapeHtml(content.heading)}</h1>
  <p class="lede">${escapeHtml(content.lede)}<br>${escapeHtml(content.ledeZh)}</p>
  <div class="card">
    <div class="state">Status: no research data is shown on this surface yet.</div>
    Live data appears here once:
    <ol>
      <li>the <strong>Research workspace</strong> option is turned on in the MOS plugin settings, and</li>
      <li>a YouTube authorization is connected (read-only Google OAuth or API key).</li>
    </ol>
    <span class="zh">开启 MOS 插件设置中的「研究工作区」选项并连接 YouTube 授权后，此处才会显示实时数据。</span>
  </div>
  <footer>MOS surfaces are informational only (Class A). OAuth connection cards are rendered by the host.</footer>
</main>
</body>
</html>
`;
}
