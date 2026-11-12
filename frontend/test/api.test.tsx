import assert from "node:assert/strict";
import test from "node:test";
import { api, ApiError, uncertainFailure } from "../src/api";

test("unavailable MariaDB keeps the persistent health DTO instead of labeling the app as demo", async (t) => {
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async () => new Response(JSON.stringify({
    status: "degraded", service: "truco-arena-api", mode: "persistent",
    storage: "mariadb", database: "unavailable", agreements: "pending",
  }), { status: 503, headers: { "Content-Type": "application/json" } });
  const health = await api.health();
  assert.equal(health.mode, "persistent");
  assert.equal(health.database, "unavailable");
  assert.equal(health.status, "degraded");
});

test("connection errors and server failures keep SQL retries uncertain, validation errors do not", () => {
  assert.equal(uncertainFailure(new ApiError("network", "NETWORK_ERROR")), true);
  assert.equal(uncertainFailure(new ApiError("commit unknown", "ERROR_INTERNO", 500)), true);
  assert.equal(uncertainFailure(new ApiError("invalid deck", "ENTRADA_INVALIDA", 400)), false);
});
