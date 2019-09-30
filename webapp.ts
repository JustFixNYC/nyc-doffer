import path from 'path';
import http from 'http';
import express from 'express';
import ws from 'ws';

const PORT = process.env.PORT || '3000';

class Job {
  constructor(readonly address: string) {
    
  }
}

const jobs = new Map<string, Job>();

const app = express();

const server = http.createServer(app);

const wss = new ws.Server({ server });

app.use(express.static(path.join(__dirname, 'static')));

app.use('/vendor/preact', express.static(path.join(__dirname, 'node_modules', 'preact', 'dist')));

wss.on('connection', ws => {
  ws.on('message', (message) => {
    console.log('Got message', message);
    ws.send(`Hallo ${message}`);
  });

  ws.send(`Greetings from the server!`);
});

server.listen(PORT, () => {
  console.log(`Listening on port ${PORT}.`);
});
