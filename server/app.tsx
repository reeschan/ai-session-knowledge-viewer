import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { getKnowledge } from "@/lib/knowledge";
import { guard } from "./guard";
import { Layout } from "./views/layout";
import { ListPage } from "./views/list";
import { LogPage } from "./views/log";
import { LearningsPage } from "./views/learnings";
import { ManualPage } from "./views/manual";
import { SettingsPage } from "./views/settings";
import { SkillsPage } from "./views/skills";
import { postSettings } from "./routes/settings";
import { postSkillsInstall } from "./routes/skills-install";

export const app = new Hono();

app.use(guard);

app.use("/app.css", serveStatic({ root: "./public" }));
app.use("/favicon.ico", serveStatic({ root: "./public" }));

/** `periods` のように同じ名前が複数あるクエリも扱えるよう、URLSearchParams で渡す。 */
function searchParams(url: string): URLSearchParams {
  return new URL(url).searchParams;
}

app.get("/", (c) =>
  c.html(
    <Layout>
      <ListPage query={searchParams(c.req.url)} />
    </Layout>,
  ),
);

app.get("/log/:id", async (c) => {
  const id = c.req.param("id");
  const entry = (await getKnowledge()).find((e) => e.id === id);
  if (!entry) return c.notFound();
  return c.html(
    <Layout>
      <LogPage entry={entry} />
    </Layout>,
  );
});

app.get("/learnings", (c) =>
  c.html(
    <Layout>
      <LearningsPage />
    </Layout>,
  ),
);

app.get("/manual", (c) =>
  c.html(
    <Layout title="マニュアル | Knowledge Viewer">
      <ManualPage />
    </Layout>,
  ),
);

app.get("/settings", (c) =>
  c.html(
    <Layout>
      <SettingsPage query={searchParams(c.req.url)} />
    </Layout>,
  ),
);

app.get("/skills", (c) =>
  c.html(
    <Layout>
      <SkillsPage query={searchParams(c.req.url)} />
    </Layout>,
  ),
);

app.post("/api/settings", (c) => postSettings(c));
app.post("/api/skills/install", (c) => postSkillsInstall(c));

app.notFound((c) =>
  c.html(
    <Layout title="見つかりません | Knowledge Viewer">
      <div class="mx-auto max-w-6xl px-4 py-8">
        <p>見つかりません</p>
        <a href="/">一覧へ戻る</a>
      </div>
    </Layout>,
    404,
  ),
);

app.onError((err, c) => {
  console.error(err);
  return c.html(
    <Layout>
      <div class="mx-auto max-w-6xl px-4 py-8">
        <p>エラーが発生しました</p>
      </div>
    </Layout>,
    500,
  );
});
