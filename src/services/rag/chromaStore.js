// src/services/rag/chromaStore.js
import { ChromaClient } from "./chromaClient.js";
// Falls dein Embedder woanders liegt, Pfad hier anpassen:
import { EmbeddingsService } from "./embeddings.js";

const DEFAULT_COLLECTION = process.env.CHROMA_COLLECTION || "agent_rules";
const DEFAULT_METADATA   = { domain: "pharma_mvp", schema: "rules@v1" };

// {$eq:"EU"} oder "EU" -> { $in: ["EU"] }
// {country:"EU", type:"RMSL"} -> {$and:[{country:{$in:["EU"]}}, {type:{$in:["RMSL"]}}]}
function normalizeWhere(where) {
  if (!where || typeof where !== "object") return undefined;

  // Falls bereits eine Operator-Form (z.B. $and/$or) übergeben wurde: unverändert durchlassen
  if ("$and" in where || "$or" in where) return where;

  const clauses = [];
  for (const [k, v] of Object.entries(where)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      // {$eq: X} -> {$in:[X]}
      if (Object.keys(v).length === 1 && Object.prototype.hasOwnProperty.call(v, "$eq")) {
        clauses.push({ [k]: { "$in": [v["$eq"]] } });
      } else if (v.$in && Array.isArray(v.$in)) {
        clauses.push({ [k]: { "$in": v.$in } });
      } else {
        // andere Operatoren (gt/gte/lt/lte/neq...) unverändert übernehmen
        clauses.push({ [k]: v });
      }
    } else if (Array.isArray(v)) {
      clauses.push({ [k]: { "$in": v } });
    } else {
      clauses.push({ [k]: { "$in": [v] } });
    }
  }

  if (clauses.length === 0) return undefined;
  if (clauses.length === 1) return clauses[0]; // einzelne Bedingung ohne $and
  return { "$and": clauses };
}


export class ChromaStore {
  constructor(env = {}) {
    this.client = new ChromaClient();
    this.embedder = new EmbeddingsService(env); // nutzt OPENAI_API_KEY / EMBEDDINGS_PROVIDER etc.
    this.collection = null;

    // Für /health im Controller
    this.cli = {
      debugInfo: () => this.client.debugInfo(),
      countCollection: (id) => this.client.countCollection(id),
    };
  }

  async ensureCollection(name = DEFAULT_COLLECTION, metadata = DEFAULT_METADATA) {
    this.collection = await this.client.getOrCreateCollection(name, metadata);
    return this.collection;
  }

  get collectionId() {
    return this.collection?.id;
  }

  /**
   * Vektor-Suche mit Client-Embeddings (query_embeddings), Filtern und Hybrid-Score
   * @param {string} query
   * @param {number} k
   * @param {object} where
   * @param {object} whereDocument
   * @param {{minSimilarity?: number, hybridWeight?: number}} options
   */
  async search(query, k = 5, where, whereDocument, options = {}) {
    if (!this.collectionId) await this.ensureCollection();

    const minSimilarity = Number.isFinite(options.minSimilarity) ? options.minSimilarity : 0.0;
    const hybridWeight  = Number.isFinite(options.hybridWeight)  ? options.hybridWeight  : 0.0;

    const wNorm  = normalizeWhere(where);
    const wdNorm = normalizeWhere(whereDocument);

    // 1) Query-Embedding lokal erzeugen
    const queryEmbeddingVectors = await this.embedder.embed([query]); // -> number[][]

    // 2) Chroma-Query (WICHTIG: snake_case "query_embeddings" senden, KEIN include hier setzen)
    const q = await this.client.queryCollection(this.collectionId, {
      query_embeddings: queryEmbeddingVectors,           // <— genau dieses Feld erwartet dein Server
      nResults: Math.max(1, Math.min(50, Number(k) || 5)),
      where: wNorm,
      whereDocument: wdNorm,
    });

    // 3) Antwort normalisieren
    const documents = q.documents?.[0] || [];
    const distances = q.distances?.[0] || [];
    const metadatas = q.metadatas?.[0] || [];
    const ids =
      (q.ids?.[0] && q.ids[0].length ? q.ids[0] : null) ||
      (q.uris?.[0] && q.uris[0].length ? q.uris[0] : null) ||
      documents.map((_, i) => `doc-${i}`);

    // 4) Scoring
    const items = ids.map((id, i) => {
      const distance = Number.isFinite(distances[i]) ? distances[i] : 1.0;
      const text = documents[i];
      const meta = metadatas[i] || {};
      const similarity = Math.max(0, 1 - distance); // Cosine-Distanz → Similarity (0..1)

      let keywordScore = 0;
      if (hybridWeight > 0 && typeof text === "string") {
        const qTokens = query.toLowerCase().split(/\s+/).filter(Boolean);
        const t = text.toLowerCase();
        keywordScore = qTokens.reduce((acc, tok) => acc + (t.includes(tok) ? 1 : 0), 0);
        if (qTokens.length > 0) keywordScore /= qTokens.length; // 0..1
      }

      const score = hybridWeight > 0
        ? similarity * (1 - hybridWeight) + keywordScore * hybridWeight
        : similarity;

      return { id, text, meta, distance, similarity, score };
    })
    .filter(x => x.similarity >= minSimilarity)
    .sort((a, b) => b.score - a.score || a.distance - b.distance);

    return {
      query,
      count: items.length,
      items: items.map(x => ({
        id: x.id,
        text: x.text,
        meta: x.meta,
        distance: Number((x.distance ?? 0).toFixed(6)),
        similarity: Number(x.similarity.toFixed(6)),
        score: Number(x.score.toFixed(6)),
      })),
    };
  }

  /**
   * Placeholder: Index (Upsert) – hier würdest du Dokument-Embeddings erzeugen
   * und via add/upsert an Chroma senden.
   */
  async index(items = []) {
    if (!Array.isArray(items)) throw new Error("index(items): items must be an array");
    if (!this.collectionId) await this.ensureCollection();
    // TODO: Embeddings für items erzeugen & upsert an Chroma
    return { ok: true, indexed: items.length, collectionId: this.collectionId };
  }
}

export default ChromaStore;
