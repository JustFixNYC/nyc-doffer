import { getInputValue } from "./app-util.js";
import { GeoDatalist } from "./geo-datalist.js";
import { ServerResults } from "./server-results.js";


type AppProps = {
};

type AppState = {
  address: string,
  submittedAddress: string,
  currentSubmissionId: number,
};

class App extends Component<AppProps, AppState> {
  constructor(props: AppProps) {
    super(props);
    this.state = {
      address: '',
      submittedAddress: '',
      currentSubmissionId: 0
    };
  }

  handleSubmit(e: Event) {
    e.preventDefault();
    this.setState({
      submittedAddress: this.state.address,
      currentSubmissionId: this.state.currentSubmissionId + 1
    });
  }

  handleInput(e: Event) {
    const address = getInputValue(e);
    this.setState({address});
  }

  render() {
    const isFormDisabled = !!this.state.submittedAddress;
    return (
      <div>
        <h1>nyc-doffer</h1>
        <form onSubmit={this.handleSubmit.bind(this)}>
          <label for="address">Address</label>
          <input type="text" id="address" name="address" list="address-list" onInput={this.handleInput.bind(this)} />
          <GeoDatalist id="address-list" address={this.state.address} />
          <input type="submit" value="Submit" disabled={isFormDisabled} />
        </form>
        <ServerResults key={this.state.currentSubmissionId} address={this.state.submittedAddress} onJobDone={() => this.setState({submittedAddress: ''})} />
      </div>
    );
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('app');

  if (!el) throw new Error('App container not found');

  render(<App/>, el);
});
