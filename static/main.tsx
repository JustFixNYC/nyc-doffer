import { decodeMessageFromServer, sendMessageToServer, getInputValue } from "./app-util.js";
import { GeoSearchRequester } from "./geo-autocomplete.js";
import { GeoSearchResults } from "../lib/geosearch.js";

const RECONNECT_MS = 1000;

type AppProps = {
};

type AppState = {
  address: string,
  logMessages: string[],
  addressList: string[],
};

class App extends Component<AppProps, AppState> {
  ws: WebSocket|null = null;
  reconnectTimeout?: number;
  requester: GeoSearchRequester;

  constructor(props: AppProps) {
    super(props);
    this.state = {
      address: '',
      logMessages: ['Connecting to server...'],
      addressList: [],
    };
    this.requester = new GeoSearchRequester({
      createAbortController: () => new AbortController(),
      fetch,
      throttleMs: 250,
      onError: this.handleRequesterError.bind(this),
      onResults: this.handleRequesterResults.bind(this)
    });
  }

  componentDidMount() {
    this.connectToServer();
  }

  componentWillUnmount() {
    if (this.reconnectTimeout !== undefined) {
      window.clearTimeout(this.reconnectTimeout);
    }
    this.requester.shutdown();
  }

  addLogMessage(message: string) {
    this.setState({'logMessages': [...this.state.logMessages, message]});
  }

  connectToServer() {
    const protocol = location.protocol === "http:" ? "ws:" : "wss:";
    const websocketURL = `${protocol}//${location.host}`;
    const ws = new WebSocket(websocketURL);
    ws.onopen = () => {
      this.addLogMessage('Connection with server established. Please submit a request.');
    };
    ws.onerror = (error) => {
      console.log("Connection error!", error);
      this.handleConnectionLost();
    };
    ws.onclose = this.handleConnectionLost.bind(this);
    ws.onmessage = this.handleMessageFromServer.bind(this);
    this.ws = ws;
    this.reconnectTimeout = undefined;
  }

  handleMessageFromServer(e: MessageEvent) { 
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
  }

  handleConnectionLost() {
    if (this.ws && this.reconnectTimeout === undefined) {
      this.ws = null;
      this.addLogMessage('Unable to reach server. Attempting to reconnect...');
      this.reconnectTimeout = window.setTimeout(this.connectToServer.bind(this), RECONNECT_MS);
    }
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

  handleInput(e: Event) {
    const address = getInputValue(e);
    this.requester.changeSearchRequest(address);
    this.setState({address});
  }

  handleRequesterError(e: Error) {
    console.error(e);
    this.setState({addressList: []});
  }

  handleRequesterResults(results: GeoSearchResults) {
    const addressList = results.features.map(feature => {
      const {name, borough} = feature.properties;
      return `${name}, ${borough}`;
    });
    this.setState({addressList});
  }

  render() {
    return (
      <div>
        <h1>nyc-doffer</h1>
        <form onSubmit={this.handleSubmit.bind(this)}>
          <label for="address">Address</label>
          <input type="text" id="address" name="address" list="address-list" onInput={this.handleInput.bind(this)} />
          <datalist id="address-list">
            {this.state.addressList
              .filter(address => address !== this.state.address)
              .map((address, i) => <option key={i} value={address} />)}
          </datalist>
          <input type="submit" value="Submit" />
        </form>
        <div class="messages">
          {this.state.logMessages.map((message, i) => <div key={i}>{message}</div>)}
        </div>
      </div>
    );
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('app');

  if (!el) throw new Error('App container not found');

  render(<App/>, el);
});
