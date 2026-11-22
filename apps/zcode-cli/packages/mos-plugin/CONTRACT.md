# mos-plugin

官方 MOS 插件（YouTube Content Intelligence 工作区；产品语义来自
`payswapdotorg/MOS-4.0`，本仓库以 payswap-4.0 的官方插件模式落地）。提供六个 `mos_*`
MCP 工具（thin proxy）与三个 Class A 信息性 `ui.surfaces`（细分领域探索 / 扫描结果 /
证据），全部在 `userConfig.researchWorkspace`（默认 false）的显式 opt-in 之后才有数据。
工具语义与 typed refusal 码见 [src/contract.ts](src/contract.ts)。

不变量：

- **opt-in 默认关闭**：`researchWorkspace` 默认 `false`（S1 语义）。打开前所有工具返回
  typed `not_opted_in`；打开后、无已连接的 YouTube 授权时返回 `not_connected`
  （S2 语义）。三个 typed code 的语义与可达性以 src/contract.ts 为准。
- **launcher 可见性 ≠ 数据可达性**：`listUiSurfaces` 只按 `plugin.enabled` 过滤、不读
  `userConfig`——S1（已启用、未 opt-in）下三个面板入口照常出现在 launcher，这只是入口
  可见性。受保护研究数据的可达性由另一条边界证明：面板资源是静态骨架（零占位数据），
  数据工具在未 opt-in 时全部 typed refusal。
- **MCP 进程无研究状态**：server 进程不持有凭据、配额账本或扫描数据；它只做注册与
  typed refusal（Wave 1 为启动 env 快照判定）。真实数据与 live 状态判定属于 Wave 2+
  的宿主桥（MOS-4.0 的 `IMosConnectionService` / `IMosResearchService`，引擎在
  `@zcode/mos`），工具永远经宿主服务访问 YouTube 数据。
- **env 命名 = 插件自有命名空间 `MOS_`**：manifest `mcpServers.*.env` 注入的是插件
  子进程的 env（经 `${user_config.*}` 从插件设置解析），属插件自有变量，命名跟随既有
  官方插件先例（`PAYSWAP_` / `ANDROID_PLUGIN_SDK_PATH` / `IOS_SIM_DEFAULT_DEVICE`）。
  本插件新增的任何 env 键必须以 `MOS_` 开头（`src/contract.ts` 的
  `RESEARCH_WORKSPACE_ENV` 为单一事实源，契约测试钉住前缀）。
- **Class A only**：`ui.surfaces[]` 只声明信息性表面；OAuth 连接卡是 Class B，由 host
  渲染，永不声明为插件表面。面板是静态骨架：零外部依赖，不渲染任何占位研究数据。
- **构建必定产出** `contract.ts` 的 `MOS_PLUGIN_OUTPUTS`
  （`.zcode-plugin/plugin.json` + `dist/server.mjs`）。官方定义的 `requiredSeedPaths`
  与此对齐；`dist/` 是构建产物（git 忽略），由 `scripts/build.mjs`（esbuild bundle，
  与 office-runtime / payswap-plugin 同参数）生成。完整启动路径（定义 → 构建 → seed →
  manifest 解析 → stdio → MCP 调用）由 bootstrap 的
  `tests/mos-launch-path.test.ts` 在真实管线上验收。
- **插件名** `mos` 取自 `.zcode-plugin/plugin.json`；运行时 MCP server 名为
  `plugin:mos:research`（workspace isolation）。三处版本（package.json / manifest /
  bootstrap 定义）保持一致，由 bootstrap 单测机械校验。

与 MOS-4.0（desktop 产品 fork）的关系：MOS-4.0 把 MOS 作为桌面产品的内置部分
（`packages/mos` 引擎 + services + Niche Explorer 面板）；本插件把同一产品能力以
**官方插件**形态带给任何 ZCode 安装——不修改宿主任何现有行为，纯增量注册。
