(function(){
  const BLOCK_WORDS = ["explicit","nsfw","xxx","torrent"]; // MVP heuristic

  function getHost(){
    try { return location.hostname.replace(/^www\./,'').toLowerCase(); } catch{ return ''; }
  }

  async function loadBlocklist(){
    try {
      const url = chrome.runtime.getURL('data/blocklist.json');
      const res = await fetch(url);
      if(!res.ok) return {domains:[]};
      return await res.json();
    } catch(_e){ return {domains:[]}; }
  }

  function shouldBlock(text){
    const lower = text.toLowerCase();
    return BLOCK_WORDS.some(w => lower.includes(w));
  }

  function showInterstitial(reason){
    // Safely replace the document without using innerHTML
    const doc = document;
    while (doc.documentElement.firstChild) {
      doc.documentElement.removeChild(doc.documentElement.firstChild);
    }

    const wrap = doc.createElement('div');
    Object.assign(wrap.style, { fontFamily: 'system-ui, sans-serif', margin: '4rem', textAlign: 'center' });

    const h1 = doc.createElement('h1');
    h1.textContent = 'Safeguard';
    wrap.appendChild(h1);

    const p1 = doc.createElement('p');
    p1.textContent = 'This page was blocked by local rules (MVP).';
    wrap.appendChild(p1);

    const p2 = doc.createElement('p');
    const b = doc.createElement('b');
    b.textContent = 'Reason: ';
    const reasonText = doc.createElement('span');
    reasonText.textContent = String(reason || '');
    p2.appendChild(b);
    p2.appendChild(reasonText);
    wrap.appendChild(p2);

    const button = doc.createElement('button');
    button.id = 'sg-override';
    let remaining = 5;
    button.disabled = true;
    const updateBtn = () => { button.textContent = remaining > 0 ? `Show anyway (${remaining})` : 'Show anyway'; };
    updateBtn();
    const timer = setInterval(() => { remaining -= 1; updateBtn(); if (remaining <= 0) { clearInterval(timer); button.disabled = false; } }, 1000);
    button.addEventListener('click', () => {
      try {
        const host = getHost();
        if (host) sessionStorage.setItem('sg-ov:' + host, '1');
      } catch(_e) {}
      location.reload();
    });
    wrap.appendChild(button);

    doc.documentElement.appendChild(wrap);
  }

  async function scan(){
    const cfg = await new Promise(r => chrome.storage.sync.get({enabled:true, allowlist:[]}, r));
    if(!cfg.enabled) return;
    const host = getHost();
    try {
      if (host && sessionStorage.getItem('sg-ov:' + host) === '1') return; // temporary override for this host (tab/session)
    } catch(_e) {}
    if((cfg.allowlist||[]).includes(host)) return; // allowlisted

    const BL = await loadBlocklist();
    if(BL.domains && BL.domains.includes(host)) { showInterstitial("domain blocklist"); return; }

    const text = document.body && document.body.innerText ? document.body.innerText.slice(0, 40000) : "";
    if(shouldBlock(text)) showInterstitial("keyword heuristic match");
  }

  scan();
})();
