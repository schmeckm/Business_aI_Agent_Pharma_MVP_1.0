// src/services/opcExecutor.js
import {
  OPCUAClient,
  MessageSecurityMode,
  SecurityPolicy,
  AttributeIds,
  DataType
} from "node-opcua";
import logger from "./logger.js";

/**
 * OpcExecutor - lightweight OPC UA helper
 * - connect() / disconnect()
 * - writeNode(nodeId, value)
 *
 * cfg:
 * {
 *   endpointUrl: "opc.tcp://localhost:4840",
 *   user: "username",
 *   password: "secret",
 *   securityMode: MessageSecurityMode.None,
 *   securityPolicy: SecurityPolicy.None,
 *   connectionTimeoutMs: 10000
 * }
 */
export class OpcExecutor {
  constructor(cfg = {}) {
    this.cfg = {
      endpointUrl: cfg.endpointUrl || process.env.OPC_ENDPOINT || "opc.tcp://localhost:4840",
      user: cfg.user || process.env.OPC_USER,
      password: cfg.password || process.env.OPC_PASS,
      securityMode: cfg.securityMode ?? MessageSecurityMode.None,
      securityPolicy: cfg.securityPolicy ?? SecurityPolicy.None,
      connectionTimeoutMs: cfg.connectionTimeoutMs || 10000,
      sessionTimeout: cfg.sessionTimeout || 30000
    };
    this.client = null;
    this.session = null;
  }

  async connect() {
    if (this.session) return;
    logger.info({ endpoint: this.cfg.endpointUrl }, "OPC: connect()");
    this.client = OPCUAClient.create({
      endpoint_must_exist: false,
      securityMode: this.cfg.securityMode,
      securityPolicy: this.cfg.securityPolicy,
      connectionStrategy: { initialDelay: 1000, maxRetry: 2 }
    });
    await this.client.connect(this.cfg.endpointUrl);
    logger.info("OPC: connected, creating session");
    this.session = await this.client.createSession({
      userName: this.cfg.user,
      password: this.cfg.password
    });
    logger.info("OPC: session created");
  }

  async disconnect() {
    try {
      if (this.session) {
        await this.session.close();
        this.session = null;
      }
      if (this.client) {
        await this.client.disconnect();
        this.client = null;
      }
      logger.info("OPC: disconnected");
    } catch (e) {
      logger.warn({ err: String(e) }, "OPC: disconnect error");
    }
  }

  _toVariant(value) {
    // Accept primitive or object { dataType, value }
    if (value && typeof value === "object" && value.hasOwnProperty("dataType") && value.hasOwnProperty("value")) {
      return { dataType: value.dataType, value: value.value };
    }
    if (typeof value === "number") return { dataType: DataType.Double, value };
    if (typeof value === "boolean") return { dataType: DataType.Boolean, value };
    // fallback to string
    return { dataType: DataType.String, value: String(value) };
  }

  /**
   * Write one node. Returns status or throws.
   * nodeId: string, value: primitive or {dataType, value}
   */
  async writeNode(nodeId, value) {
    if (!this.session) await this.connect();
    const variant = this._toVariant(value);
    const nodesToWrite = [
      {
        nodeId,
        attributeId: AttributeIds.Value,
        value: { value: variant }
      }
    ];
    const res = await this.session.write(nodesToWrite);
    // node-opcua returns an array of StatusCodes
    return res;
  }
}
