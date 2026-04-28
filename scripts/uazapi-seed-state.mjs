#!/usr/bin/env node
// Pre-popula state/uazapi-state.json marcando como "alerted=true" todas as
// instancias DESCONECTADAS atualmente, exceto a indicada via --except <nome>.
// Permite que a proxima execucao do monitor dispare alerta apenas para a
// instancia escolhida (teste e2e controlado).

import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const UAZAPI_URL = (process.env.UAZAPI_URL ?? "").replace(/\/$/, "");
const UAZAPI_ADMIN_TOKEN = process.env.UAZAPI_ADMIN_TOKEN ?? "";
const STATE_FILE = process.env.STATE_FILE ?? "state/uazapi-state.json";

const except = process.argv.includes("--except")
  ? process.argv[process.argv.indexOf("--except") + 1]
  : "";

if (!UAZAPI_URL || !UAZAPI_ADMIN_TOKEN) {
  console.error("Missing UAZAPI_URL or UAZAPI_ADMIN_TOKEN");
  process.exit(1);
}

const CONNECTED = new Set(["connected", "open", "online"]);

const res = await fetch(`${UAZAPI_URL}/instance/all`, {
  headers: { adminToken: UAZAPI_ADMIN_TOKEN, accept: "application/json" },
});
if (!res.ok) {
  console.error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  process.exit(1);
}
const list = await res.json();
const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

const state = {};
let kept = 0;
for (const inst of list) {
  const name = inst.name ?? inst.instanceName ?? inst.id ?? "?";
  const status = String(inst.status ?? "unknown").toLowerCase();
  const isConnected = CONNECTED.has(status);

  if (!isConnected && name !== except) {
    state[name] = { status, alerted: true, since: now };
  } else if (!isConnected && name === except) {
    kept++;
  } else {
    state[name] = { status, alerted: false, since: now };
  }
}

await mkdir(dirname(STATE_FILE), { recursive: true });
await writeFile(STATE_FILE, JSON.stringify(state, null, 2), "utf8");

console.log(
  `seed: ${list.length} instancias, ${Object.keys(state).length} no state, target='${except}' (kept ${kept} desconectada(s) sem flag para alertar)`,
);
