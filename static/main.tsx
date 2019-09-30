/// <reference path="../node_modules/preact/dist/preact.d.ts" /> 

class App extends preact.Component {
  render() {
    return (
      <div>
        <h1>nyc-doffer</h1>
        <form method="GET">
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

  preact.render(<App/>, el);
});
