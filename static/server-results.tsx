import { decodeMessageFromServer, sendMessageToServer } from "./app-util.js";
import { PropertyInfo } from "../doffer.js";

const RECONNECT_MS = 1000;

export type ServerResultsProps = {
  address: string,
  onJobDone: () => void,
};

type State = {
  logMessages: string[],
  propertyInfo: PropertyInfo|null,
  isJobDone: boolean,
};

export class ServerResults extends Component<ServerResultsProps, State> {
  ws: WebSocket|null = null;
  reconnectTimeout?: number;

  constructor(props: ServerResultsProps) {
    super(props);
    this.state = {
      logMessages: ['Connecting to server...'],
      propertyInfo: null,
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
        this.addLogMessage('DOF scrape complete.');
        this.setState({isJobDone: true, propertyInfo: message.propertyInfo});
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
    const { propertyInfo } = this.state;

    return (
      <div>
        <LogMessages messages={this.state.logMessages} />
        {propertyInfo && <PropertyInfo {...propertyInfo} />}
      </div>
    );
  }
}

function LogMessages(props: {messages: string[]}) {
  const {messages} = props;

  if (messages.length === 0) return null;

  const latestMessage = messages[messages.length - 1];

  return (
    <details>
      <summary>{latestMessage}</summary>
      <div class="messages">
        {messages.map((message, i) => <div key={i}>{message}</div>)}
      </div>
    </details>
  );
}

function PDFLink(props: {url: string, date: string, title: string}) {
  const title = `${props.date} ${props.title}`;
  return <a href={props.url} target="_blank" rel="noopener noreferrer"><img src="img/pdf-icon.svg" title={title} alt={title} className="pdf-icon" /></a>;
}

function WOWLink(props: {bbl: string}) {
  return <a href={`https://whoownswhat.justfix.nyc/bbl/${props.bbl}`} title={`Look up BBL ${props.bbl} on Who Owns What`} target="_blank" rel="noopener noreferrer">{props.bbl}</a>
}

function PropertyInfo(props: PropertyInfo) {
  return (
    <div>
      <h2>{props.name}, {props.borough}</h2>
      <p>
        Following are details for {props.name}, {props.borough} (BBL <WOWLink bbl={props.bbl} />) scraped from individual statements on the NYC DOF website.
      </p>
      <h3>Property value details</h3>
      <table>
        <tr>
          <th>Period</th>
          <th>Net operating income</th>
        </tr>
        {props.nopv.map(nopv => (
          <tr>
            <td><PDFLink title="Notice of Property Value (NOPV)" {...nopv} /> {nopv.period}</td>
            <td>{nopv.noi}</td>
          </tr>
        ))}
      </table>
      <h3>Tax bill details</h3>
      <table>
        <tr>
          <th>Period</th>
          <th>Rent stabilized units</th>
        </tr>
        {props.soa.map(soa => (
          <tr>
            <td><PDFLink title="Statement of Account (SOA)" {...soa} /> {soa.period} Q{soa.quarter}</td>
            <td>{soa.rentStabilizedUnits}</td>
          </tr>
        ))}
      </table>
    </div>
  );
}
