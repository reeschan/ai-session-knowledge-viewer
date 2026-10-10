import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { CATEGORIES } from "./types";

export type Period = "daily" | "weekly";
export type SkillOptions = { storeDir: string; slackChannel: string; appDir: string; periods: Period[] };
export type GeneratedFile = { path: string; content: string }; // path はホームディレクトリからの相対、区切りは "/"

const ARCHIVE_SKILL_DIR = ".claude/skills/session-archive";

function archiveScript(storeDir: string): string {
  return `// Claude Code の Stop フックから呼ばれる。セッションログを保管先へ写す（アプリが生成）。
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const STORE_DIR = ${JSON.stringify(storeDir)};

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

try {
  const input = JSON.parse(readStdin());
  const sessionId = String(input.session_id ?? "");
  const transcript = String(input.transcript_path ?? "");
  const cwd = String(input.cwd ?? "");
  if (!sessionId || !transcript) throw new Error("session_id / transcript_path がありません");

  const project = path.basename(path.dirname(transcript));
  const destDir = path.join(STORE_DIR, "claude-code", project);
  mkdirSync(destDir, { recursive: true });
  copyFileSync(transcript, path.join(destDir, sessionId + ".jsonl"));

  if (cwd) {
    const lastPath = path.join(STORE_DIR, "last-session.json");
    let last = {};
    try {
      const parsed = JSON.parse(readFileSync(lastPath, "utf8"));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) last = parsed;
    } catch {
      // 無い・壊れているときは作り直す
    }
    last[cwd] = sessionId;
    writeFileSync(lastPath, JSON.stringify(last, null, 2), "utf8");
  }
} catch (e) {
  console.error("session-archive: " + (e instanceof Error ? e.message : String(e)).split("\\n")[0]);
}
process.exit(0);
`;
}

function archiveSkillMd(storeDir: string): string {
  const cats = CATEGORIES.map((c) => `\`${c}\``).join(" / ");
  return `---
name: session-archive
description: Claude Code のセッションの要約を、ナレッジアプリが読める JSON として保管先に残す。「セッションを保管して」「今日の作業を要約して残して」と頼まれたときに使う。
allowed-tools: Read Write
---

# セッション保管

今のセッションの要約を、アプリと同じ形式の JSON で保管先に書く。API キーは不要。

保管先: \`${storeDir}\`

## 手順

1. \`${storeDir}/last-session.json\` を読む。中身は \`{ "<作業ディレクトリ>": "<session_id>" }\` の形で、今の作業ディレクトリの値が今のセッションの session_id になる。
   - ファイルが無い、または今の作業ディレクトリのキーが無いときは、Stop フックが未登録の可能性が高い。ユーザーに、\`~/.claude/settings.json\` へ Stop フック（archive.mjs を呼ぶ設定）を登録するよう案内して、ここで止める。
2. 今のセッションの会話を振り返り、要約を作る。
3. \`${storeDir}/summaries/<session_id>.json\` に次の形の JSON を書く（シェルは使わず Write ツールだけで書く。フォルダが無ければ Write ツールが作る。既存は上書き）。

\`\`\`json
{
  "sessionId": "<session_id>",
  "summary": "日本語 3〜5 文の要約",
  "category": "固定カテゴリのいずれか",
  "tags": ["3〜6 個"],
  "learnings": ["0〜5 個の学び"],
  "createdAt": "ISO 8601 の日時"
}
\`\`\`

- \`sessionId\`: 手順 1 で読んだ session_id
- \`summary\`: 日本語 3〜5 文
- \`category\`: 次のいずれか 1 つ: ${cats}
- \`tags\`: 3〜6 個の文字列
- \`learnings\`: 0〜5 個の文字列（次に役立つ気づき。無ければ空配列）
- \`createdAt\`: 書いた時点の ISO 日時

書いたら、ファイルのパスをユーザーに伝える。
`;
}

function digestSkillMd(period: Period, opts: SkillOptions): string {
  const label = period === "daily" ? "日次" : "週次";
  const ui = period === "daily" ? "Daily" : "Weekly";
  const name = `knowledge-digest-${period}`;
  return `---
name: ${name}
description: ナレッジアプリの${label}ダイジェストを作り、Slack の ${opts.slackChannel} に投稿する定期実行タスク。
---

# ${label}ダイジェストを Slack に投稿する

1. \`${opts.appDir}\` で次のコマンドを実行する。

\`\`\`
npm run digest -- --period ${period}
\`\`\`

2. コマンドの出力を、加工せずそのまま Slack コネクタで \`${opts.slackChannel}\` に投稿する。
3. コマンドが失敗したら、エラー出力の先頭数行を同じチャンネル \`${opts.slackChannel}\` に投稿する。API キーやパスワードなどの秘密は投稿しない。

## 実行頻度

頻度は Claude Desktop の定期実行の画面で選ぶ（このタスクは「${ui}」）。
`;
}

export function generateSkills(opts: SkillOptions): { files: GeneratedFile[]; hookSnippet: string } {
  const files: GeneratedFile[] = [
    { path: `${ARCHIVE_SKILL_DIR}/SKILL.md`, content: archiveSkillMd(opts.storeDir) },
    { path: `${ARCHIVE_SKILL_DIR}/scripts/archive.mjs`, content: archiveScript(opts.storeDir) },
  ];
  for (const period of ["daily", "weekly"] as const) {
    if (opts.periods.includes(period)) {
      files.push({
        path: `.claude/scheduled-tasks/knowledge-digest-${period}/SKILL.md`,
        content: digestSkillMd(period, opts),
      });
    }
  }

  const home = os.homedir().split("\\").join("/");
  const hookSnippet = JSON.stringify(
    {
      hooks: {
        Stop: [
          {
            hooks: [
              {
                type: "command",
                command: `node "${home}/${ARCHIVE_SKILL_DIR}/scripts/archive.mjs"`,
                timeout: 30,
              },
            ],
          },
        ],
      },
    },
    null,
    2,
  );
  return { files, hookSnippet };
}

export async function installSkills(files: GeneratedFile[], homeDir?: string): Promise<string[]> {
  const home = homeDir ?? (process.env.KV_HOME_DIR ? process.env.KV_HOME_DIR : os.homedir());
  const written: string[] = [];
  for (const file of files) {
    const abs = path.join(home, ...file.path.split("/"));
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, file.content, "utf8");
    written.push(abs);
  }
  return written;
}
