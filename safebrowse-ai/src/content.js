(function(){
  const BLOCK_WORDS = ["explicit","nsfw","xxx","torrent"]; // MVP heuristic

  function getHost(){
    try { return location.hostname.replace(/^www\./,''); } catch(e){ return ''; }
  }
  function shouldBlock(text){
    const lower = text.toLowerCase();
    return BLOCK_WORDS.some(w => lower.includes(w));
  }
  function showInterstitial(reason){
    document.documentElement.innerHTML = `
      <div style="font-family: system-ui; margin: 4rem; text-align: center;">
        <h1>Safeguard</h1>
        <p>This page was blocked by local rules (MVP).</p>
        <p><b>Reason:</b> ${reason}</p>
        <button id="sg-override">Show anyway</button>
      </div>`;
    document.getElementById('sg-override').onclick = () => location.reload();
  }

  function scan(){
    const text = document.body && document.body.innerText ? document.body.innerText.slice(0, 40000) : "";
    if(shouldBlock(text)) showInterstitial("keyword heuristic match");
  }

  chrome.storage.sync.get({enabled:true, allowlist:[]}, (cfg)=>{
    if(!cfg.enabled) return;
    const host = getHost();
    if(cfg.allowlist && cfg.allowlist.includes(host)) return; // allowlisted
    scan();
  });
})();
