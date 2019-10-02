import { GeoSearchResults } from "../lib/geosearch.js";
import { GeoSearchRequester } from "./geo-autocomplete.js";

type GeoDatalistProps = {
  address: string,
  id: string,
};

type State = {
  addressList: string[]
};

export class GeoDatalist extends Component<GeoDatalistProps, State> {
  requester: GeoSearchRequester;

  constructor(props: GeoDatalistProps) {
    super(props);
    this.state = {
      addressList: []
    };
    this.requester = new GeoSearchRequester({
      createAbortController: () => new AbortController(),
      fetch,
      throttleMs: 250,
      onError: this.handleRequesterError.bind(this),
      onResults: this.handleRequesterResults.bind(this)
    });
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

  componentDidMount() {
    this.requester.changeSearchRequest(this.props.address);
  }

  componentDidUpdate(prevProps: GeoDatalistProps) {
    if (prevProps.address !== this.props.address) {
      this.requester.changeSearchRequest(this.props.address);
    }
  }

  componentWillUnmount() {
    this.requester.shutdown();
  }

  render() {
    return (
      <datalist id={this.props.id}>
        {this.state.addressList
          .filter(address => address !== this.props.address)
          .map((address, i) => <option key={i} value={address} />)}
      </datalist>
    );
  }
}
