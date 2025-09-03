const enabledEl = document.getElementById('enabled');
const allowHost = document.getElementById('allowHost');
const addAllow = document.getElementById('addAllow');
const allowList = document.getElementById('allowList');

function render(list){
  allowList.innerHTML = '';
  list.forEach((h, idx)=>{
    const li = document.createElement('li');
    li.textContent = h + ' ';
    const rm = document.createElement('button');
    rm.textContent = '×';
    rm.onclick = ()=>{
      list.splice(idx,1);
      chrome.storage.sync.set({allowlist: list}, ()=>render(list));
    };
    li.appendChild(rm);
    allowList.appendChild(li);
  });
}

chrome.storage.sync.get({enabled:true, allowlist:[]}, (cfg)=>{
  enabledEl.checked = cfg.enabled;
  render(cfg.allowlist);
});

enabledEl.addEventListener('change', ()=>{
  chrome.storage.sync.set({enabled: enabledEl.checked});
});

addAllow.addEventListener('click', ()=>{
  const host = (allowHost.value || '').trim();
  if(!host) return;
  chrome.storage.sync.get({allowlist:[]}, (cfg)=>{
    const list = Array.from(new Set([...(cfg.allowlist||[]), host]));
    chrome.storage.sync.set({allowlist:list}, ()=>{
      allowHost.value = '';
      render(list);
    });
  });
});
