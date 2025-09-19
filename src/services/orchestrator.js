// src/services/orchestrator.js
const patterns = [
  { intent:"mar.schedule_line", re:/\b(plane|schedule|linie)\b/i },
  { intent:"mar.move_tank_status", re:/\b(tank|status)\b/i },
  { intent:"mar.qa_prioritize_ilot", re:/\b(qa|inspection|ilot)\b/i },
  { intent:"mar.trigger_batch_release", re:/\b(batch.*release|freigabe)\b/i },
  { intent:"mar.generate_coa", re:/\b(coa|certificate)\b/i },
  { intent:"cmo.send_production_plan", re:/\b(produktionsplan|production plan)\b/i },
  { intent:"cmo.create_pr", re:/\b(purchase requisition|pr|beschaff)\b/i },
  { intent:"cmo.create_po", re:/\b(purchase order|po)\b/i },
  { intent:"cmo.request_release", re:/\b(release anfordern|request release)\b/i },
  { intent:"cmo.confirm_release", re:/\b(release bestätigt|confirm release)\b/i },
  { intent:"cmo.create_asn", re:/\b(asn|advance shipment)\b/i },
  { intent:"cmo.book_transport", re:/\b(transport|carrier|pickup|route)\b/i },
  { intent:"cmo.handover_to_site_or_hub", re:/\b(handover|hub|site)\b/i }
];

export class Orchestrator {
  constructor({ router, broadcast }) {
    this.router = router;
    this.broadcast = broadcast || (()=>{});
  }
  parseIntent(message) {
    const hit = patterns.find(p => p.re.test(message || ""));
    return hit?.intent || "explain";
  }
  async handleChat(message, slots = {}) {
    const intent = this.parseIntent(message);
    if (intent === "explain") return { reply: "Kein ausführbarer Intent erkannt." };
    const routing = await this.router.route({ intent, context: slots, text: message });
    this.broadcast({ type:"orchestrator_routed", intent, routing, ts: Date.now() });
    return { intent, routing };
  }
  async handleRpc(method, params = {}) {
    if (method === "tasks/send") {
      const text = params?.message?.parts?.[0]?.text || "";
      const slots = params?.context || {};
      return this.handleChat(text, slots);
    }
    if (method === "system/ping") return { pong:true };
    throw new Error(`Unknown method: ${method}`);
  }
}
