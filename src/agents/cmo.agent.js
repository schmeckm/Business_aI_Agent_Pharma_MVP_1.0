export async function handle({ intent, context }) {
  switch (intent) {
    case "cmo.send_production_plan":
      return { sent:true, plan:{ planId:context.planId||`PLAN-${Date.now()}`, ...context, status:"sent" } };
    case "cmo.create_pr":
      return { status:"created", pr:`PR-${Math.floor(100000+Math.random()*900000)}`, ...context };
    case "cmo.create_po":
      return { status:"created", po:`PO-${Math.floor(100000+Math.random()*900000)}`, pr:context.pr, incoterms:context.incoterms||"FCA", deliveryDate:context.deliveryDate||context.date };
    case "cmo.request_release":
      return { requested:true, batch:context.batch, site:context.site, status:"awaiting_release" };
    case "cmo.confirm_release":
      return { confirmed:true, batch:context.batch, site:context.site, status:"released" };
    case "cmo.create_asn":
      return { asn:`ASN-${Math.floor(100000+Math.random()*900000)}`, po:context.po, route:context.route, eta:context.deliveryDate||context.date, status:"created" };
    case "cmo.book_transport":
      return { booked:true, shipmentId:`SHP-${Math.floor(100000+Math.random()*900000)}`, carrier:context.carrier||"3PL-X", route:context.route||"CMODP", pickup:context.pickup||context.date };
    case "cmo.handover_to_site_or_hub":
      return { handedOver:true, target:context.target||"DP-01", docRef:context.asn||context.po||null };
    default:
      return { ok:false, reason:`unknown CMO intent ${intent}` };
  }
}
