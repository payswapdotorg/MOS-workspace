/**
 * mos-plugin 标准用法示例：官方定义（bootstrap 的 OfficialPluginDefinition）与
 * 构建产物对齐时插件契约长什么样。
 */
import {
  MOS_PLUGIN_OUTPUTS,
  MOS_SURFACE_IDS,
  MOS_TOOL_NAMES,
  type MosPluginContract,
} from "./contract.ts";

export function exampleOfficialMosPlugin(): MosPluginContract {
  return {
    outputs: MOS_PLUGIN_OUTPUTS,
    tools: MOS_TOOL_NAMES,
    surfaces: MOS_SURFACE_IDS,
    optInOption: "researchWorkspace",
  };
}
