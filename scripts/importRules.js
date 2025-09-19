import fs from "fs";
import { parse } from "csv-parse/sync";
import "dotenv/config";
import { ChromaStore } from "../src/services/rag/chromaStore.js";

const rag = new ChromaStore(process.env);

async function run() {
  const raw = fs.readFileSync("./rules/tric_rules.csv", "utf8");
  const records = parse(raw, {
    columns: true, skip_empty_lines: true, bom: true, relax_column_count: true, relax_quotes: true, trim: true
  });

  console.log(`📥 Indexiere ${records.length} Regeln in ChromaDB…`);
  const out = await rag.index(records.map(r => ({
    text: `${r.material} ${r.country}: ${r.requirement}`,
    meta: { material: r.material, country: r.country, type: r.type }
  })));
  console.log("✅ Done:", out);
}
run().catch(e => { console.error(e); process.exit(1); });
