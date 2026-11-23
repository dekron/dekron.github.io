document.documentElement.classList.add('js');
window.__dvFailsafe=function(){if(!window.__dvReady){document.documentElement.classList.remove('js');var b=document.getElementById('boot');if(b)b.remove();if(document.body)document.body.classList.add('ready');}};
window.addEventListener('error', function (event) {
  // Optional resources such as Three.js must not interrupt the page.
  if (event.target !== window && !(event.target instanceof HTMLScriptElement && event.target.type === 'module')) return;
  window.__dvFailsafe();
}, true);
setTimeout(window.__dvFailsafe,7000);
