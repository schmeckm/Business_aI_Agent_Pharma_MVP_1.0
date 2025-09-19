import axios from "axios";

export class EmbeddingsService {
  constructor(cfgIn) {
    const cfg = cfgIn ?? process.env ?? {};
    this.provider = (cfg.EMBEDDINGS_PROVIDER || "openai").toLowerCase();
    this.openaiKey = cfg.OPENAI_API_KEY;
    this.openaiModel = cfg.OPENAI_EMBED_MODEL || "text-embedding-3-small";
    this.timeoutMs = Number(cfg.EMBEDDINGS_TIMEOUT_MS || 15000); // 15s Timeout
  }

  async embed(inputs) {
    const arr = Array.isArray(inputs) ? inputs : [inputs];

    if (this.provider === "dummy") {
      // Kein Netz nötig: deterministische Pseudo-Vektoren (zur Fehlersuche)
      return arr.map((txt) => {
        const len = Math.max(8, Math.min(64, (txt || "").length));
        const v = new Array(64).fill(0).map((_, i) => ((i * 31 + len) % 97) / 97);
        return v;
      });
    }

    if (this.provider === "openai") {
      if (!this.openaiKey) throw new Error("OPENAI_API_KEY missing for embeddings");
      const url = "https://api.openai.com/v1/embeddings";
      const payload = { model: this.openaiModel, input: arr };
      const { data } = await axios.post(url, payload, {
        headers: { Authorization: `Bearer ${this.openaiKey}` },
        timeout: this.timeoutMs,
      });
      // Normalisieren auf number[]
      return data.data.map((d) => d.embedding);
    }

    throw new Error(`Unknown EMBEDDINGS_PROVIDER=${this.provider}`);
  }
}
