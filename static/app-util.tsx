import { DofferWebSocketClientMessage, DofferWebSocketServerMessage } from "../webapp";

export function getInputValue(e: Event): string {
  if (e.target && e.target instanceof HTMLInputElement) {
    return e.target.value;
  }
  throw new Error('Event has no target, or target is not an <input> element!');
}

export function sendMessageToServer(ws: WebSocket, message: DofferWebSocketClientMessage) {
  ws.send(JSON.stringify(message));
}

export function decodeMessageFromServer(event: MessageEvent): DofferWebSocketServerMessage|null {
  if (typeof event.data !== 'string') {
    console.log('Received non-string message from server.');
    return null;
  }
  try {
    return JSON.parse(event.data);
  } catch (e) {
    console.log('Received non-JSON message from server.');
    return null;
  }
}
