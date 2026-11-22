/**
 * mos-plugin 模块清单（architecture-governance managed 模块）。
 * 层：app。修改 requires 时同步更新 architecture-policy.yaml（检查器会校验两者一致）。
 * Wave 2 起若经共享协议模块接宿主桥，requires 增加 shared-mos 并同步策略文件。
 */
export const mosPluginModule = {
  id: "mos-plugin",
  requires: [],
  provides: ["mos-plugin"],
  publicEntrypoints: ["index.ts", "contract.ts"],
} as const;
