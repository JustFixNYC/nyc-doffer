import { decodeMessageFromServer, sendMessageToServer } from "./app-util.js";

const RECONNECT_MS = 1000;

export type ServerResultsProps = {
  address: string,
  onJobDone: () => void,
};

type State = {
  logMessages: string[],
  isJobDone: boolean,
};

export class ServerResults extends Component<ServerResultsProps, State> {
  ws: WebSocket|null = null;
  reconnectTimeout?: number;

  constructor(props: ServerResultsProps) {
    super(props);
    this.state = {
      logMessages: ['Connecting to server...'],
      isJobDone: false
    };
  }

  componentDidMount() {
    this.connectToServer();
  }

  componentWillUnmount() {
    if (this.reconnectTimeout !== undefined) {
      window.clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }
    if (this.ws) {
      const ws = this.ws;
      this.ws = null;
      ws.close();
    }
  }

  componentDidUpdate(prevProps: ServerResultsProps, prevState: State) {
    if (this.props.address !== prevProps.address) {
      this.setState({isJobDone: false});
      this.startJob();
    }
    if (this.state.isJobDone && this.state.isJobDone !== prevState.isJobDone) {
      this.props.onJobDone();
    }
  }

  startJob() {
    if (this.ws && this.ws.readyState === this.ws.OPEN) {
      if (this.props.address) {
        sendMessageToServer(this.ws, {event: 'startJob', address: this.props.address});
      }
    }
  }

  addLogMessage(message: string) {
    this.setState({'logMessages': [...this.state.logMessages, message]});
  }

  connectToServer() {
    const protocol = location.protocol === "http:" ? "ws:" : "wss:";
    const websocketURL = `${protocol}//${location.host}`;
    const ws = new WebSocket(websocketURL);
    ws.onopen = () => {
      this.addLogMessage('Connection with server established.');
      if (!this.state.isJobDone) {
        this.startJob();
      }
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
        this.setState({isJobDone: true});
        break;

        case 'jobInProgress':
        this.addLogMessage('The server is still processing your previous request!');
        break;

        case 'jobFinished':
        this.addLogMessage('The server has finished processing your request.');
        this.setState({isJobDone: true});
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

  render() {
    return (
      <div class="messages">
        {this.state.logMessages.map((message, i) => <div key={i}>{message}</div>)}
      </div>
    );
  }
}
