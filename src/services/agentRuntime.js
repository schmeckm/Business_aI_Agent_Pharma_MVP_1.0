// src/services/agentRuntime.js
import path from "node:path";
import { pathToFileURL } from "node:url";

export class AgentRuntime {
  constructor({ registry, rootDir = process.cwd() }) {
    this.registry = registry;
    this.rootDir  = rootDir;
    this.cache    = new Map();
  }

  _toFileUrl(absPath) {
    return pathToFileURL(absPath).href;
  }

  _resolveModuleFile(modulePath) {
    // ESM-Import braucht file://-URL; akzeptiere absolut/relativ
    const abs = path.isAbsolute(modulePath)
      ? modulePath
      : path.join(this.rootDir, modulePath);
    return this._toFileUrl(abs);
  }

  _defaultModuleForAgent(agent) {
    // Fallback: src/agents/<namespace>.agent.js
    if (!agent?.namespace) {
      throw new Error(`Agent ${agent?.id || "unknown"} has no namespace`);
    }
    const rel = path.join("src", "agents", `${agent.namespace}.agent.js`);
    return this._resolveModuleFile(rel);
  }

  async _loadHandler(modUrl) {
    if (this.cache.has(modUrl)) return this.cache.get(modUrl);
    const m = await import(modUrl);
    if (typeof m.handle !== "function") {
      throw new Error(`Agent module ${modUrl} does not export 'handle'`);
    }
    this.cache.set(modUrl, m.handle);
    return m.handle;
  }

  /**
   * Führt den passenden Agent für den Intent aus.
   * @param {string} intent z.B. "mar.schedule_line"
   * @param {object} context Slots/Parameter
   */
  async run(intent, context = {}) {
    const agent = this.registry.findByIntent(intent)
      || this.registry.byNamespace(String(intent).split(".")[0]);

    if (!agent) {
      return { ok: false, error: `No agent found for intent ${intent}` };
    }
    if (!agent.inProcess) {
      return { ok: false, error: `Agent ${agent.id} is not inProcess (external not implemented)` };
    }

    // 1) bevorzugt agents.json: module
    // 2) sonst Fallback: src/agents/<namespace>.agent.js
    const modUrl = agent.module
      ? this._resolveModuleFile(agent.module)
      : this._defaultModuleForAgent(agent);

    const handle = await this._loadHandler(modUrl);
    return handle({ intent, context });
  }
}
