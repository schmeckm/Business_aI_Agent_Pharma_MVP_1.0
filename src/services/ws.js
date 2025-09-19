// src/services/ws.js
import { WebSocketServer } from "ws";
import { createLogger } from "./logger.js";

const log = createLogger("WS");

let broadcast = () => {};
export function attachWs(server) {
  const wss = new WebSocketServer({ server, path: "/events" });
  broadcast = (obj) => {
    const msg = JSON.stringify(obj);
    for (const c of wss.clients) {
      if (c.readyState === 1) c.send(msg);
    }
  };
  log.info("WS /events ready");
}
export const getBroadcaster = () => broadcast;
export const setBroadcaster = (reg) => reg((evt) => getBroadcaster()(evt));
