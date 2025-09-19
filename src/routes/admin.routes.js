import { Router } from "express";
import { requireGoogleRole } from "../services/auth.google.js";
import { listAgents, upsertAgent, deleteAgent, reloadAgents, testRoute, listAudit } from "../controllers/admin.controller.js";

const r = Router();
r.use(requireGoogleRole("admin")); // für lokale Tests kannst du hier auch die API-Key-Variante nutzen

r.get("/agents", listAgents);
r.post("/agents", upsertAgent);
r.delete("/agents/:id", deleteAgent);
r.post("/agents/reload", reloadAgents);
r.post("/route-test", testRoute);
r.get("/audit", listAudit);

export default r;
