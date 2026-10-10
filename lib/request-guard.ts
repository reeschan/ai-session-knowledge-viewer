const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

function forbidden(message: string): Response {
  return new Response(`${message}\n`, {
    status: 403,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

/** "host[:port]" を URL として解釈する。解釈できなければ null。 */
function parseHost(value: string): URL | null {
  try {
    return new URL(`http://${value}`);
  } catch {
    return null;
  }
}

/**
 * 書き込み API を別オリジン・LAN からのリクエストから守る。
 * 拒否するときは 403 の Response を、通すときは null を返す。
 */
export function rejectUnlessLocal(request: Request): Response | null {
  const hostHeader = request.headers.get("host") ?? "";
  const host = parseHost(hostHeader);
  if (!host || !LOOPBACK_HOSTNAMES.has(host.hostname.toLowerCase())) {
    return forbidden("このパソコン (localhost) 以外からのリクエストは受け付けません。");
  }

  const origin = request.headers.get("origin");
  if (origin !== null) {
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = null;
    }
    if (originHost === null || originHost.toLowerCase() !== host.host.toLowerCase()) {
      return forbidden("別のサイトからのリクエストは受け付けません。");
    }
    return null;
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site" || fetchSite === "same-site") {
    return forbidden("別のサイトからのリクエストは受け付けません。");
  }
  return null;
}
