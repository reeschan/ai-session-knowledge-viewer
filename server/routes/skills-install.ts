import type { Context } from "hono";

// 仮実装 (PBI-029 以降で置き換える)
export async function postSkillsInstall(c: Context): Promise<Response> {
  return c.text("未実装", 501);
}
