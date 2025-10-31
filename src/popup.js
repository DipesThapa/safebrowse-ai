const enabledEl = document.getElementById('enabled');
const allowHost = document.getElementById('allowHost');
const addAllow = document.getElementById('addAllow');
const clearAllow = document.getElementById('clearAllow');
const allowList = document.getElementById('allowList');
const hint = document.getElementById('hint');
const setPinBtn = document.getElementById('setPin');
const pinStatus = document.getElementById('pinStatus');

function render(list){
  allowList.innerHTML = '';
  (list||[]).forEach((h, idx)=>{
    const li = document.createElement('li');
    li.textContent = h + ' ';
    const rm = document.createElement('button');
    rm.textContent = '×';
    rm.onclick = async ()=>{
      if (await pinRequiredAndFail()) return;
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

chrome.storage.sync.get({enabled:true, allowlist:[], pinHash:''}, (cfg)=>{
  enabledEl.checked = cfg.enabled;
  render(cfg.allowlist||[]);
  updatePinStatus(Boolean(cfg.pinHash));
});

enabledEl.addEventListener('change', async ()=>{
  if (await pinRequiredAndFail()) { enabledEl.checked = !enabledEl.checked; return; }
  chrome.storage.sync.set({enabled: enabledEl.checked});
});

addAllow.addEventListener('click', async ()=>{
  if (await pinRequiredAndFail()) return;
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
  if (await pinRequiredAndFail()) return;
  chrome.storage.sync.set({allowlist: []}, ()=>render([]));
});

// ----- PIN management -----
function updatePinStatus(hasPin){
  pinStatus.textContent = hasPin ? 'PIN set' : 'No PIN set';
}

async function digest(text){
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(text));
  const bytes = Array.from(new Uint8Array(buf));
  return bytes.map(b=>b.toString(16).padStart(2,'0')).join('');
}

async function verifyPinFlow(){
  const { pinHash = '' } = await new Promise(r=>chrome.storage.sync.get({pinHash:''}, r));
  if(!pinHash) return true; // no pin set
  const input = prompt('Enter PIN to proceed');
  if(input==null) return false;
  const h = await digest(input);
  return h === pinHash;
}

async function pinRequiredAndFail(){
  const ok = await verifyPinFlow();
  if(!ok){ hint.style.color = '#a00'; hint.textContent = 'PIN required'; }
  return !ok;
}

setPinBtn.addEventListener('click', async ()=>{
  const { pinHash = '' } = await new Promise(r=>chrome.storage.sync.get({pinHash:''}, r));
  if(pinHash){
    const ok = await verifyPinFlow();
    if(!ok) return;
  }
  const p1 = prompt(pinHash? 'Enter NEW PIN' : 'Set a PIN (4–12 digits recommended)');
  if(p1==null || p1==='') return;
  const p2 = prompt('Confirm PIN');
  if(p1!==p2){ alert('PINs do not match'); return; }
  const newHash = await digest(p1);
  chrome.storage.sync.set({pinHash: newHash}, ()=>updatePinStatus(true));
});
