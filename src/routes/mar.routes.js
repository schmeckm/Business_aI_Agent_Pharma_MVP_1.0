import { Router } from "express";
import { marPlanController, marStatusController } from "../controllers/mar.controller.js";

const r = Router();
r.post("/plan", marPlanController);
r.get("/status", marStatusController);
export default r;
