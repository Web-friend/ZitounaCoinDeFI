import { EventEmitter } from "node:events";

const bus = new EventEmitter();
bus.setMaxListeners(200);

export function emitLotEvent(lotId, event) {
  bus.emit(`lot:${lotId}`, {
    lotId,
    at: new Date().toISOString(),
    ...event,
  });
}

export function onLotEvent(lotId, handler) {
  const channel = `lot:${lotId}`;
  bus.on(channel, handler);
  return () => bus.off(channel, handler);
}
