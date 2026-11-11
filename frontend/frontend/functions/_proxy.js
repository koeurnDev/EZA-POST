export async function proxyToApi(request, env) {
  const incoming = new URL(request.url);

  // 🚀 Route Subtitle Studio (/api/v1/*) directly to Unified Cloudflare Edge Worker
  if (incoming.pathname.startsWith("/api/v1/")) {
    const edgeWorkerOrigin = env.KHMERSUB_API_ORIGIN || "https://eza-post-api.koeurnseab630.workers.dev";
    const destination = new URL(`${incoming.pathname}${incoming.search}`, edgeWorkerOrigin);
    const headers = new Headers(request.headers);
    headers.delete("host");

    try {
      const hasBody = request.method !== "GET" && request.method !== "HEAD";
      return await fetch(
        new Request(destination, {
          method: request.method,
          headers,
          body: hasBody ? request.body : undefined,
          ...(hasBody ? { duplex: "half" } : {}),
          redirect: "manual",
        })
      );
    } catch (error) {
      console.error("KhmerSub Edge Worker proxy failed:", error);
      return Response.json({ error: "KhmerSub Edge Service is temporarily unreachable" }, { status: 502 });
    }
  }

  if (!env.API_ORIGIN) {
    return Response.json({ error: "API origin is not configured" }, { status: 503 });
  }

  let destination;
  try {
    const apiOrigin = new URL(env.API_ORIGIN);
    if (apiOrigin.protocol !== "https:" && apiOrigin.protocol !== "http:") {
      return Response.json({ error: "API origin must use HTTP or HTTPS" }, { status: 500 });
    }

    const incoming = new URL(request.url);
    destination = new URL(`${incoming.pathname}${incoming.search}`, apiOrigin);
  } catch (error) {
    console.error("Invalid API_ORIGIN configuration:", error);
    return Response.json({ error: "API origin configuration is invalid" }, { status: 500 });
  }

  const headers = new Headers(request.headers);
  headers.delete("host");

  try {
    const hasBody = request.method !== "GET" && request.method !== "HEAD";
    return await fetch(
      new Request(destination, {
        method: request.method,
        headers,
        body: hasBody ? request.body : undefined,
        ...(hasBody ? { duplex: "half" } : {}),
        redirect: "manual",
      })
    );
  } catch (error) {
    console.error("API Worker request failed:", error);
    return Response.json({ error: "API is temporarily unavailable" }, { status: 502 });
  }
}
