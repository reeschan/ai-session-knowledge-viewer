// テストの共通部品。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { app } from "@/server/app";

export const FIXTURES = path.resolve("test", "fixtures");

export type SetupOptions = {
  sources?: unknown[];
  llm?: unknown;
  skills?: unknown;
};

/**
 * 一時フォルダに settings.json と analysis.json を置き、環境変数をそこへ向ける。
 * 実環境の値 (.env.local など) が入らないよう、関係する環境変数は空文字 (未設定扱い) にする。
 * 戻り値は一時フォルダのパス。
 */
export function setupTestEnv(options: SetupOptions = {}): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kv-test-"));
  const settings = {
    sources: [{ id: "fixture", type: "markdown", path: path.join(FIXTURES, "logs"), enabled: true }],
    skills: { storeDir: "", slackChannel: "", appDir: dir },
    ...options,
  };
  fs.writeFileSync(path.join(dir, "settings.json"), JSON.stringify(settings, null, 2), "utf8");
  fs.copyFileSync(path.join(FIXTURES, "analysis.json"), path.join(dir, "analysis.json"));
  Object.assign(process.env, {
    KV_DATA_DIR: dir,
    KV_HOME_DIR: path.join(dir, "home"),
    LOG_ROOT: "",
    ANTHROPIC_API_KEY: "",
    LLM_BASE_URL: "",
    LLM_API_KEY: "",
    LLM_MODEL: "",
  });
  return dir;
}

/** app.request() を呼ぶ。host ヘッダーが無ければ 127.0.0.1:3000 を足す。 */
export async function request(requestPath: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has("host")) headers.set("host", "127.0.0.1:3000");
  return app.request(requestPath, { ...init, headers });
}
