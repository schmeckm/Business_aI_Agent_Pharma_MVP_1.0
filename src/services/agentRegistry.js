import { readJson, writeJson } from "../utils/jsonfile.js";

export class AgentRegistry {
  constructor(path) { this.path = path; this.cache = readJson(path); }
  all() { return this.cache; }
  getById(id){ return this.cache.find(a => a.id === id); }
  byNamespace(ns){ return this.cache.find(a => a.namespace === ns); }
  findByIntent(intent){
    return this.cache.find(a => (a.skills||[]).some(s => s.intent === intent));
  }
  upsert(agent){
    const i = this.cache.findIndex(a=>a.id===agent.id);
    if (i>=0) this.cache[i]=agent; else this.cache.push(agent);
    writeJson(this.path, this.cache);
    return agent;
  }
  remove(id){
    this.cache = this.cache.filter(a=>a.id!==id);
    writeJson(this.path, this.cache);
  }
  reload(){ this.cache = readJson(this.path); return this.cache; }
}
