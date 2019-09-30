/// <reference path="../node_modules/preact/dist/preact.d.ts" /> 

class App extends preact.Component {
  handleSubmit(e: Event) {
    e.preventDefault();
    alert("TODO: Implement this!");
  }

  render() {
    return (
      <div>
        <h1>nyc-doffer</h1>
        <form onSubmit={this.handleSubmit.bind(this)}>
          <label for="address">Address</label>
          <input type="text" id="address" name="address" />
          <input type="submit" value="Submit" />
        </form>
      </div>
    );
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('app');

  if (!el) throw new Error('App container not found');

  const protocol = location.protocol === "http:" ? "ws:" : "wss:";
  const websocketURL = `${protocol}//${location.host}`;
  const connection = new WebSocket(websocketURL);
  connection.onopen = () => {
    console.log("Connection opened!");
    connection.send('HALLO');
  };
  connection.onerror = (error) => {
    console.log("Connection error!", error);
  };
  connection.onmessage = (e) => {
    console.log("Connection message!", e.data);
  };

  preact.render(<App/>, el);
});
