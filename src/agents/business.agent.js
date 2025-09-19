// src/agents/business.agent.js
// Business Agent: erstellt Assessments (morning briefing, single order check)
// this agent expects context.data (DataLayer) and context.llm (optional) to be provided.

export async function handle({ intent, context }) {
  const start = Date.now();
  const log = (msg, ...args) => console.info(`[BUSINESS] ${msg}`, ...args);

  try {
    log('handle start', intent);

    const data = context?.data;
    if (!data) return { ok:false, error: "DataLayer missing in context" };

    // For "ask-today-orders" or general scheduling checks we inspect orders
    // We'll read all orders and perform an assessment per order
    const orders = (await data.listOrders?.()) || [];
    const assessments = [];

    for (const o of orders) {
      const material = o.material;
      const qty = Number(o.qty || o.quantity || 0);
      const bom = (await data.getBom?.(material)) || [];
      const inv = (await data.getInventory?.()) || [];
      const tric = (await data.getTricRules?.({ material, country: context.country || "EU" })) || [];
      const md = (await data.getMasterData?.(material)) || null;
      const qc = (await data.getQcLots?.()) || [];

      // compute simple needs
      const needs = (bom||[]).map(c => ({ component: c.component, need: qty * (Number(c.perFG) || 0), uom: c.uom || 'PCS' }));
      const missing = needs.filter(n => (inv.find(i=>i.material===n.component)?.qty || 0) < n.need);

      const tricOk = (tric||[]).every(r => r.type !== "TRIC" || (String(r.status||'').toLowerCase() !== 'notallowed'));
      const rmslRule = (tric||[]).find(r => r.type === "RMSL");
      const bulkId = `BULK-${(material.split('-')[1]||'')}`;
      const bulk = inv.find(i=>i.material===bulkId);
      const rmslOk = !rmslRule || (bulk?.rmslPct ?? 100) >= (rmslRule.minPct ?? 0);
      const mdOk = Array.isArray(bom) && bom.length>0 || (md && md.status === 'Active');

      const ok = tricOk && rmslOk && mdOk && missing.length===0;

      assessments.push({
        orderId: o.id || o.orderId || o.id,
        material,
        qty,
        line: o.line || context.line || "PCK-01",
        due: o.due || o.date || null,
        assessment: { ok, regulatoryOk: tricOk, rmslOk, rmslRule, mdOk, missing, needs, bomCount: bom.length },
        order: o
      });
    }

    // assemble morning briefing
    const total = assessments.length;
    const releasable = assessments.filter(a=>a.assessment.ok);
    const blocked = assessments.filter(a=>!a.assessment.ok);
    const actions = [];

    if (releasable.length) {
      actions.push({ id:'prepare_release', label:`Sammelfreigabe vorbereiten (${releasable.length})`, payload: { intent: 'mar.batch_release', orders: releasable.map(r=>r.orderId) } });
    }
    // collect missing materials for potential QA prioritization / PR
    const missingMaterials = [...new Set(blocked.flatMap(b=>b.assessment.missing.map(m=>m.component)))];
    if (missingMaterials.length) {
      actions.push({ id:'prioritize_qc', label:`QA priorisieren für: ${missingMaterials.join(', ')}`, payload: { intent:'mar.qa_prioritize_ilot', materials: missingMaterials } });
      actions.push({ id:'create_pr', label:`PR für fehlende Komponenten vorschlagen`, payload: { components: missingMaterials } });
    }

    const briefing = {
      summary: `Morgen-Briefing: ${releasable.length}/${total} Aufträge freigabebereit, ${blocked.length} blockiert.`,
      counts: { total, releasable: releasable.length, blocked: blocked.length },
      releasable: releasable.map(r=>({ orderId:r.orderId, material:r.material, qty:r.qty, line:r.line })),
      blocked: blocked.map(r=>({ orderId:r.orderId, material:r.material, qty:r.qty, line:r.line, missing: r.assessment.missing })),
      actions,
      results: assessments
    };

    // If LLM available, ask it to produce a human-friendly annotated summary (temperature 0)
    let llmText = null;
    try {
      if (context.llm && typeof context.llm.chat === 'function') {
        const sys = `You are an enterprise Manufacturing Assistant. Use ONLY the provided evidence (JSON) to produce a short briefing and suggested next actions. Do NOT invent facts. Output a short "explanation" in plain German.`;
        const user = `EVIDENCE: ${JSON.stringify({ briefing }, null, 2)}\n\nReturn a short explanation (max 250 tokens) in German.`;
        const r = await context.llm.chat([{ role:'system', content:sys }, { role:'user', content:user }], { temperature: 0, max_tokens: 400 });
        llmText = r?.text || null;
      }
    } catch (e) {
      console.warn('[BUSINESS] llm summarization failed', e?.message || e);
    }

    // Build response — agent clients (router) expect { ok, summary, ... }
    const result = {
      ok: true,
      briefing,
      explanation: llmText,
    };

    log('finished in', Date.now()-start, 'ms');
    return { ok: true, result };
  } catch (e) {
    console.error('[BUSINESS] error', e);
    return { ok:false, error: e?.message || String(e) };
  }
}
