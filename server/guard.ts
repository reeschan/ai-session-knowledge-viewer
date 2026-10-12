import type { MiddlewareHandler } from "hono";
import { rejectUnlessLocal } from "@/lib/request-guard";

/**
 * 全ルートに Host の確認をかける。
 * GET / HEAD は Host だけを確かめる (別サイトのリンクから開くのは許す)。
 * それ以外のメソッドは Host・Origin・Sec-Fetch-Site をすべて確かめる。
 */
export const guard: MiddlewareHandler = async (c, next) => {
  const method = c.req.method;
  const request =
    method === "GET" || method === "HEAD"
      ? new Request(c.req.url, { headers: { host: c.req.header("host") ?? "" } })
      : c.req.raw;
  const rejected = rejectUnlessLocal(request);
  if (rejected) return rejected;
  await next();
};
