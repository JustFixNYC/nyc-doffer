/// <reference path="../node_modules/preact/dist/preact.d.ts" /> 

window.addEventListener('DOMContentLoaded', () => {
  console.log("SUP");

  const el = document.getElementById('app');

  if (!el) throw new Error('App container not found');

  const hi = <div>hai2u</div>;

  preact.render(hi, el);
});
