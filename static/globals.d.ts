declare type DofferWebSocketClientMessage = {
  event: 'startJob',
  address: string
};

declare type DofferWebSocketServerMessage = {
  event: 'jobStatus',
  text: string
} | {
  event: 'jobAccepted'
} | {
  event: 'jobFinished'
} | {
  event: 'jobInProgress'
} | {
  event: 'jobError',
  message: string|null
} | {
  event: 'heartbeat',
  time: number
};
