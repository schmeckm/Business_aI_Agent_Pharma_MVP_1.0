import { Router } from "express";
import { rpcController } from "../controllers/rpc.controller.js";
const r = Router();
r.post("/", rpcController);
export default r;
