// src/services/rag/chromaClient.js
import axios from "axios";

// ENV-Beispiele:
// CHROMA_URL=http://localhost:8001            // darf Pfadprefix enthalten, z.B. http://localhost:8001/chroma
// CHROMA_TENANT=default_tenant
// CHROMA_DATABASE=default_database
// CHROMA_API_FLAVOR=auto | v2_tenant | v2_flat | v1

const RAW_URL       = process.env.CHROMA_URL || "http://localhost:8001";
const TENANT        = process.env.CHROMA_TENANT || "default_tenant";
const DATABASE      = process.env.CHROMA_DATABASE || "default_database";
const FORCED_FLAVOR = process.env.CHROMA_API_FLAVOR || "auto";

function splitUrlAndBase(raw) {
  const u = new URL(raw);
  const origin = `${u.protocol}//${u.host}`;
  let basePath = u.pathname.replace(/\/+$/, "");
  if (basePath === "/") basePath = "";
  return { origin, basePath };
}
const { origin: CHROMA_ORIGIN, basePath: CHROMA_BASE } = splitUrlAndBase(RAW_URL);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isAxiosError = (e) => !!(e && e.isAxiosError);

export class ChromaClient {
  constructor(opts = {}) {
    this.http = axios.create({
      baseURL: CHROMA_ORIGIN,
      timeout: opts.timeout ?? 30000,
      headers: { "Content-Type": "application/json" },
      adapter: ["http", "xhr", "fetch"],
      validateStatus: (s) => s >= 200 && s < 300,
    });

    this.baseV1 = `${CHROMA_BASE}/api/v1`;
    this.baseV2 = `${CHROMA_BASE}/api/v2`;

    this.tenant  = TENANT;
    this.database = DATABASE;
    this.flavor  = "auto"; // v2_tenant | v2_flat | v1
    this.ready   = this.init();
  }

  // ---------- Robustere Auto-Detection ----------
  async init() {
    if (FORCED_FLAVOR !== "auto") {
      this.flavor = FORCED_FLAVOR;
      return;
    }
    // v2_tenant? → alles ≠ 404 gilt als vorhanden
    try {
      const r = await this.http.get(`${this.baseV2}/tenants`, {
        timeout: 4000,
        validateStatus: () => true,
      });
      if (r.status !== 404) { this.flavor = "v2_tenant"; return; }
    } catch {}

    // v2_flat?
    try {
      const r = await this.http.get(`${this.baseV2}/collections`, {
        timeout: 4000,
        validateStatus: () => true,
      });
      if (r.status !== 404) { this.flavor = "v2_flat"; return; }
    } catch {}

    // v1?
    try {
      const r = await this.http.get(`${this.baseV1}/collections`, {
        timeout: 4000,
        validateStatus: () => true,
      });
      if (r.status !== 404) { this.flavor = "v1"; return; }
    } catch {}

    throw new Error("Chroma API not reachable with v2_tenant, v2_flat, or v1. Check CHROMA_URL and server version.");
  }

  // ---------- Pfade ----------
  pathCollections() {
    if (this.flavor === "v2_tenant") {
      return `${this.baseV2}/tenants/${encodeURIComponent(this.tenant)}/databases/${encodeURIComponent(this.database)}/collections`;
    }
    if (this.flavor === "v2_flat") return `${this.baseV2}/collections`;
    return `${this.baseV1}/collections`;
  }

  pathCollectionById(id) {
    if (this.flavor === "v2_tenant") {
      return `${this.baseV2}/tenants/${encodeURIComponent(this.tenant)}/databases/${encodeURIComponent(this.database)}/collections/${encodeURIComponent(id)}`;
    }
    if (this.flavor === "v2_flat") return `${this.baseV2}/collections/${encodeURIComponent(id)}`;
    return `${this.baseV1}/collections/${encodeURIComponent(id)}`;
  }

  // ---------- Debug / Health ----------
  debugInfo() {
    return {
      base: CHROMA_ORIGIN + (CHROMA_BASE || ""),
      mode: { ver: this.flavor.startsWith("v2") ? "v2" : "v1", kind: this.flavor === "v2_tenant" ? "mt" : "std" },
      tenant: this.tenant,
      database: this.database,
      flavor: this.flavor,
      baseV1: this.baseV1,
      baseV2: this.baseV2,
    };
  }

  // ---------- Collections ----------
  async getCollectionByName(name) {
    await this.ready;
    const url = this.pathCollections();
    const res = await this.http.get(url, { params: { name }, validateStatus: () => true });
    // 404/405 → viele Builds haben kein GET-Lister → als "nicht vorhanden" werten
    if (res.status === 404 || res.status === 405) return null;

    const d = res.data;
    if (Array.isArray(d?.collections)) return d.collections[0] || null;
    if (Array.isArray(d)) return d.find((c) => c?.name === name) || null;
    if (d?.name === name) return d;
    return null;
  }

  async createCollection(name, metadata = {}) {
    await this.ready;

    const tryPost = async () => {
      const res = await this.http.post(this.pathCollections(), { name, metadata });
      return res.data;
    };

    try {
      return await tryPost();
    } catch (err) {
      const s = err?.response?.status;

      // 409/405 → prüfen, ob Collection inzwischen auffindbar ist
      if (s === 409 || s === 405) {
        const again = await this.getCollectionByName(name).catch(() => null);
        if (again) return again;
      }

      // Spezieller Fallback: v1-POST 405 → auf v2_tenant umschalten und erneut
      if (s === 405 && this.flavor === "v1") {
        this.flavor = "v2_tenant";
        return await tryPost();
      }

      // 404 in auto-Modus → Detection erneuern und erneut versuchen
      if (s === 404 && FORCED_FLAVOR === "auto") {
        await sleep(150);
        this.flavor = "auto";
        await this.init();
        return await tryPost();
      }

      throw err;
    }
  }

  async getOrCreateCollection(name, metadata = {}) {
    await this.ready;
    const found = await this.getCollectionByName(name);
    if (found) return found;
    return await this.createCollection(name, metadata);
  }

  async deleteCollectionById(id) {
    await this.ready;
    await this.http.delete(this.pathCollectionById(id));
  }

  async countCollection(id) {
    await this.ready;
    const url = `${this.pathCollectionById(id)}/count`;
    const r = await this.http.get(url, { validateStatus: () => true });
    if (r.status >= 200 && r.status < 300 && typeof r.data?.count === "number") return r.data.count;
    return 0;
  }

  // ---------- Query ----------
// In der Klasse ChromaClient:
async queryCollection(collectionId, payload) {
  await this.ready;
  const url = `${this.pathCollectionById(collectionId)}/query`;

  const ALLOWED = new Set(["distances", "documents", "embeddings", "metadatas", "uris"]);
  let inc = Array.isArray(payload?.include) ? payload.include.filter(x => ALLOWED.has(x)) : undefined;
  if (!inc || inc.length === 0) inc = ["distances", "documents", "metadatas"];

  const qe = payload?.query_embeddings ?? payload?.queryEmbeddings ?? null;
  if (!qe) throw new Error("queryCollection: missing query_embeddings payload (server requires embeddings).");

  const buildBody = (omitWhere = false) => ({
    query_embeddings: qe,
    n_results: payload.nResults ?? payload.n_results,
    where: omitWhere ? undefined : payload.where,
    where_document: payload.whereDocument ?? payload.where_document,
    include: inc,
  });

  // 1. Versuch: mit übergebenem where
  try {
    const res = await this.http.post(url, buildBody(false));
    const d = res.data || {};
    return {
      ids: d.ids || [],
      distances: d.distances || [],
      documents: d.documents || [],
      metadatas: d.metadatas || [],
      uris: d.uris || [],
    };
  } catch (err) {
    // 2. Fallback: Wenn "Invalid where clause", nochmal ohne where probieren
    const msg = err?.response?.data?.message || err?.message || "";
    const status = err?.response?.status;
    if (status === 400 && /invalid where clause/i.test(msg)) {
      const res2 = await this.http.post(url, buildBody(true));
      const d2 = res2.data || {};
      return {
        ids: d2.ids || [],
        distances: d2.distances || [],
        documents: d2.documents || [],
        metadatas: d2.metadatas || [],
        uris: d2.uris || [],
      };
    }
    throw err;
  }
}

}

export default ChromaClient;
