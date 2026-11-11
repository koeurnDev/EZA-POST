import { proxyToApi } from "../_proxy.js";

export function onRequest({ request, env }) {
  return proxyToApi(request, env);
}
