export async function proxyToBackend(c) {
  return proxyRequestToBackend(c, c.req.raw);
}

export async function proxyRequestToBackend(c, request) {
  const backendOrigin = c.env.BACKEND_ORIGIN;
  if (!backendOrigin) {
    return c.json({ error: "Backend origin is not configured" }, 503);
  }

  let target;
  try {
    const origin = new URL(backendOrigin);
    if (origin.protocol !== "https:" && origin.protocol !== "http:") {
      return c.json({ error: "Backend origin must use HTTP or HTTPS" }, 500);
    }

    const incoming = new URL(c.req.url);
    target = new URL(`${incoming.pathname}${incoming.search}`, origin);
  } catch (error) {
    console.error("Invalid BACKEND_ORIGIN configuration:", error);
    return c.json({ error: "Backend origin configuration is invalid" }, 500);
  }

  const headers = new Headers(request.headers);
  headers.delete("host");

  try {
    const hasBody = request.method !== "GET" && request.method !== "HEAD";
    return await fetch(
      new Request(target, {
        method: request.method,
        headers,
        body: hasBody ? request.body : undefined,
        ...(hasBody ? { duplex: "half" } : {}),
        redirect: "manual",
      })
    );
  } catch (error) {
    console.error("Backend proxy request failed:", error);
    return c.json({ error: "Backend is temporarily unavailable" }, 502);
  }
}
