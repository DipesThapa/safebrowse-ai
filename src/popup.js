const enabledEl = document.getElementById('enabled');
const allowHost = document.getElementById('allowHost');
const addAllow = document.getElementById('addAllow');
const clearAllow = document.getElementById('clearAllow');
const allowList = document.getElementById('allowList');
const hint = document.getElementById('hint');
// PIN removed — simplified UI

function render(list){
  allowList.innerHTML = '';
  (list||[]).forEach((h, idx)=>{
    const li = document.createElement('li');
    li.textContent = h + ' ';
    const rm = document.createElement('button');
    rm.textContent = '×';
    rm.onclick = async ()=>{
      const next = list.slice(0, idx).concat(list.slice(idx+1));
      chrome.storage.sync.set({allowlist: next}, ()=>render(next));
    };
    li.appendChild(rm);
    allowList.appendChild(li);
  });
}

function normalizeHost(raw){
  let s = (raw||'').trim().toLowerCase();
  s = s.replace(/^https?:\/\//,'').replace(/^www\./,'').replace(/\/.*$/,'');
  return s;
}

function validHostname(s){
  // letters, digits, dashes + dots, 1–253 chars, no spaces
  if(!s || s.length>253 || /\s/.test(s)) return false;
  return /^[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(s);
}

chrome.storage.sync.get({enabled:true, allowlist:[]}, (cfg)=>{
  enabledEl.checked = cfg.enabled;
  render(cfg.allowlist||[]);
});

enabledEl.addEventListener('change', async ()=>{
  chrome.storage.sync.set({enabled: enabledEl.checked});
});

addAllow.addEventListener('click', async ()=>{
  const host = normalizeHost(allowHost.value);
  if(!validHostname(host)){
    hint.style.color = '#a00';
    hint.textContent = 'invalid hostname — use e.g. example.com';
    return;
  }
  chrome.storage.sync.get({allowlist:[]}, (cfg)=>{
    const set = new Set(cfg.allowlist||[]);
    set.add(host);
    const next = Array.from(set);
    chrome.storage.sync.set({allowlist: next}, ()=>{
      allowHost.value=''; hint.style.color='#666'; hint.textContent='enter a hostname only (no http/https)';
      render(next);
    });
  });
});

clearAllow.addEventListener('click', async ()=>{
  chrome.storage.sync.set({allowlist: []}, ()=>render([]));
});
