import path from 'path';
import express from 'express';

const PORT = process.env.PORT || '3000';

const server = express();

server.use(express.static(path.join(__dirname, 'static')));

server.listen(PORT, () => {
  console.log(`Listening on port ${PORT}.`);
});
