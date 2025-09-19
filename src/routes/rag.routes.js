import { Router } from 'express';
import { ragIndexController, ragSearchController, ragHealthController } from '../controllers/rag.controller.js';

const r = Router();
r.get('/health', ragHealthController);
r.post('/index', ragIndexController);
r.post('/search', ragSearchController);
export default r;
