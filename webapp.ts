import path from 'path';
import http from 'http';
import express from 'express';
import ws from 'ws';
import { GracefulError, CACHE_DIR, getPropertyInfoForAddress, PropertyInfo } from './doffer';
import { FileSystemCache, ICache } from './lib/cache';

export type DofferWebSocketClientMessage = {
  event: 'startJob',
  address: string
};

export type DofferWebSocketServerMessage = {
  event: 'jobStatus',
  text: string
} | {
  event: 'jobAccepted'
} | {
  event: 'jobFinished',
  propertyInfo: PropertyInfo
} | {
  event: 'jobInProgress'
} | {
  event: 'jobError',
  message: string|null
} | {
  event: 'heartbeat',
  time: number
};

const PORT = process.env.PORT || '3000';

const HEARTBEAT_MS = 15_000;

class Job {
  webSockets: ws[] = [];
  logMessages: string[] = [];

  constructor(readonly address: string, readonly cache: ICache, readonly onFinished: () => void) {
    this.start();
  }

  async start() {
    try {
      const propertyInfo = await getPropertyInfoForAddress(this.address, this.cache, this.handleLogMessage.bind(this));
      this.broadcastMessage({event: 'jobFinished', propertyInfo});
    } catch (e) {
      let message = null;

      if (e instanceof GracefulError) {
        message = e.message;
      } else {
        console.error(e);
      }
      this.broadcastMessage({event: 'jobError', message});
    }

    try {
      this.onFinished();
    } catch (e) {
      console.error(e);
    }
  }

  handleLogMessage(message: string) {
    this.logMessages.push(message);
    this.broadcastMessage({event: 'jobStatus', text: message});
  }

  broadcastMessage(event: DofferWebSocketServerMessage) {
    for (let ws of this.webSockets) {
      sendMessageToClient(ws, event);
    }
  }

  attach(ws: ws) {
    this.webSockets.push(ws);
    for (let message of this.logMessages) {
      sendMessageToClient(ws, {event: 'jobStatus', text: message});
    }
  }

  detach(ws: ws) {
    const index = this.webSockets.indexOf(ws);
    if (index !== -1) {
      this.webSockets.splice(index, 1);
    }
  }
}

const jobs = new Map<string, Job>();

const app = express();

const server = http.createServer(app);

const wss = new ws.Server({ server });

const cache = new FileSystemCache(CACHE_DIR);

function sendMessageToClient(ws: ws, message: DofferWebSocketServerMessage) {
  ws.send(JSON.stringify(message));
}

function decodeMessageFromClient(data: ws.Data): DofferWebSocketClientMessage|null {
  if (typeof data !== 'string') return null;
  try {
    return JSON.parse(data);
  } catch (e) {
    return null;
  }
}

// This will place priority on serving Parcel-generated files.
app.use(express.static(path.join(__dirname, 'dist')));

// This ensures our static assets are served.
app.use(express.static(path.join(__dirname, 'static')));

wss.on('connection', ws => {
  let currentJob: Job|undefined;

  ws.on('message', (rawMessage) => {
    const message = decodeMessageFromClient(rawMessage);
    if (message) {
      switch (message.event) {
        case 'startJob':
        if (currentJob) {
          return sendMessageToClient(ws, {event: 'jobInProgress'});
        }
        currentJob = jobs.get(message.address);
        if (!currentJob) {
          currentJob = new Job(message.address, cache, () => {
            jobs.delete(message.address)
            currentJob = undefined;
          });
          jobs.set(message.address, currentJob);
        }
        sendMessageToClient(ws, {event: 'jobAccepted'});
        currentJob.attach(ws);
        break;

        default:
        console.log(`Unknown event: ${message.event}`);
      }
    }
  });

  const interval = setInterval(() => {
    sendMessageToClient(ws, {event: 'heartbeat', time: Date.now()});
  }, HEARTBEAT_MS);

  ws.on('close', () => {
    clearInterval(interval);
    for (let job of jobs.values()) {
      job.detach(ws);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Listening on port ${PORT}.`);
});
