(function(){
  // Expanded textual heuristic for adult content (non-exhaustive, on-device)
  const BLOCK_WORDS = [
    "porn","xxx","nsfw","explicit","adult","hentai","nude","nudity","sex",
    "pornography","erotic","hardcore","softcore","fetish","bdsm","camgirl","cam boy",
    "onlyfans","brazzers","xvideos","xhamster","redtube","youporn","spankbang",
    "blowjob","handjob","cum","orgasm","anal","threesome","milf","hentai","teen"
  ];

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
    const lower = (text||'').toLowerCase();
    return BLOCK_WORDS.some(w => lower.includes(w));
  }

  // --- On-screen media masking (images/videos) ---
  let styleInjected = false;
  function ensureStyles(){
    if (styleInjected) return; styleInjected = true;
    const st = document.createElement('style');
    st.textContent = `
      .sg-blur { filter: blur(28px) saturate(0.6) contrast(0.8) !important; }
      .sg-tag { position: absolute; top: 6px; left: 6px; background: rgba(185,28,28,0.9); color: #fff;
                padding: 2px 6px; font: 12px/1 system-ui,sans-serif; border-radius: 3px; z-index: 2147483647; }
      .sg-wrap { position: relative !important; display: inline-block; }
    `;
    document.documentElement.appendChild(st);
  }

  function textAround(el){
    try{
      const pieces = [];
      if (el.alt) pieces.push(el.alt);
      if (el.title) pieces.push(el.title);
      const aria = el.getAttribute && el.getAttribute('aria-label'); if (aria) pieces.push(aria);
      const src = (el.currentSrc || el.src || '').split(/[?#]/)[0];
      if (src) pieces.push(src.split('/').pop()||'');
      const fig = el.closest && el.closest('figure');
      if (fig){ const cap = fig.querySelector('figcaption'); if (cap) pieces.push(cap.innerText||''); }
      let sib = el.parentElement; let hops = 0;
      while (sib && hops < 2){ pieces.push(sib.innerText||''); sib = sib.parentElement; hops++; }
      return pieces.join(' ').slice(0, 2000);
    }catch(_e){ return ''; }
  }

  function mask(el){
    if (!el || el.__sg_masked) return; el.__sg_masked = true;
    ensureStyles();
    try {
      const parent = el.parentElement;
      if (parent && !parent.classList.contains('sg-wrap')){
        const wrap = document.createElement('span');
        wrap.className = 'sg-wrap';
        parent.insertBefore(wrap, el);
        wrap.appendChild(el);
      }
      el.classList.add('sg-blur');
      const tag = document.createElement('span');
      tag.className = 'sg-tag';
      tag.textContent = 'Blocked by Safeguard';
      const wrap2 = el.parentElement;
      if (wrap2 && wrap2.classList.contains('sg-wrap')) wrap2.appendChild(tag);
    } catch(_e) {}
  }

  const scanned = new WeakSet();
  function evaluateMedia(el){
    if (!el || scanned.has(el)) return false; scanned.add(el);
    // Heuristic: use surrounding text/attributes for a fast signal
    const t = textAround(el);
    return shouldBlock(t);
  }

  function initMediaFilter(){
    const io = new IntersectionObserver((entries)=>{
      for (const e of entries){
        if (!e.isIntersecting) continue;
        const el = e.target;
        try { if (evaluateMedia(el)) mask(el); } catch(_err){}
      }
    }, { root: null, threshold: 0.01 });

    const sel = 'img, video';
    document.querySelectorAll(sel).forEach(n=>io.observe(n));

    const mo = new MutationObserver((muts)=>{
      for (const m of muts){
        m.addedNodes && m.addedNodes.forEach((n)=>{
          if (!(n instanceof Element)) return;
          if (n.matches && n.matches(sel)) io.observe(n);
          n.querySelectorAll && n.querySelectorAll(sel).forEach(c=>io.observe(c));
        });
      }
    });
    mo.observe(document.documentElement, { subtree: true, childList: true });
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
    if(shouldBlock(text)) { showInterstitial("keyword heuristic match"); return; }

    // No page-level block: still protect by masking on-screen images/videos
    initMediaFilter();
  }

  scan();
})();
