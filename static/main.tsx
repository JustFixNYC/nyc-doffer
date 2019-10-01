/// <reference path="../node_modules/preact/dist/preact.d.ts" /> 

type AppProps = {
};

type AppState = {
  address: string,
  logMessages: string[]
};

class App extends preact.Component<AppProps, AppState> {
  ws: WebSocket|null = null;

  constructor(props: AppProps) {
    super(props);
    this.state = {
      address: '',
      logMessages: ['Connecting to server...']
    };
  }

  componentDidMount() {
    const protocol = location.protocol === "http:" ? "ws:" : "wss:";
    const websocketURL = `${protocol}//${location.host}`;
    const ws = new WebSocket(websocketURL);
    ws.onopen = () => {
      this.addLogMessage('Connection with server established. Please submit a request.');
    };
    ws.onerror = (error) => {
      console.log("Connection error!", error);
      this.addLogMessage('A connection error with the server occurred! Maybe reload the page?');
    };
    ws.onmessage = (e) => {
      const message = decodeMessageFromServer(e);
      if (message) {
        console.log("Connection message!", message.event);
        switch (message.event) {
          case 'jobAccepted':
          this.setState({'logMessages': []});
          break;

          case 'jobStatus':
          this.addLogMessage(message.text);
          break;

          case 'jobError':
          this.addLogMessage(message.message || 'Alas, an error occurred.');
          break;

          case 'jobInProgress':
          this.addLogMessage('The server is still processing your previous request!');
          break;

          case 'jobFinished':
          this.addLogMessage('The server has finished processing your request.');
          break;
        }
      }
    };
    this.ws = ws;  
  }

  addLogMessage(message: string) {
    this.setState({'logMessages': [...this.state.logMessages, message]});
  }

  handleSubmit(e: Event) {
    e.preventDefault();

    if (this.ws && this.ws.readyState === this.ws.OPEN) {
      const { address } = this.state;
      if (address) {
        sendMessageToServer(this.ws, {event: 'startJob', address});
      }
    } else {
      this.addLogMessage("You are not connected to the server. Maybe reload the page?");
    }
  }

  render() {
    return (
      <div>
        <h1>nyc-doffer</h1>
        <form onSubmit={this.handleSubmit.bind(this)}>
          <label for="address">Address</label>
          <input type="text" id="address" name="address" onInput={(e) => this.setState({'address': getInputValue(e)})} />
          <input type="submit" value="Submit" />
        </form>
        <div class="messages">
          {this.state.logMessages.map((message, i) => <div key={i}>{message}</div>)}
        </div>
      </div>
    );
  }
}

function getInputValue(e: Event): string {
  if (e.target && e.target instanceof HTMLInputElement) {
    return e.target.value;
  }
  throw new Error('Event has no target, or target is not an <input> element!');
}

function sendMessageToServer(ws: WebSocket, message: DofferWebSocketClientMessage) {
  ws.send(JSON.stringify(message));
}

function decodeMessageFromServer(event: MessageEvent): DofferWebSocketServerMessage|null {
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

window.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('app');

  if (!el) throw new Error('App container not found');

  preact.render(<App/>, el);
});