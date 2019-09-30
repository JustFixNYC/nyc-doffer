import path from 'path';
import express from 'express';

const PORT = process.env.PORT || '3000';

class Job {
  constructor(readonly address: string) {
    
  }
}

const jobs = new Map<string, Job>();

const server = express();

server.use(express.static(path.join(__dirname, 'static')));

server.listen(PORT, () => {
  console.log(`Listening on port ${PORT}.`);
});
