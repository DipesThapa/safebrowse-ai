chrome.runtime.onInstalled.addListener(()=>{
  console.log('Safeguard installed');
  initBadge();
  rebuildDynamicRules();
});

function setBadge(enabled){
  const text = enabled ? 'ON' : '';
  try {
    chrome.action.setBadgeText({ text });
    if (enabled) chrome.action.setBadgeBackgroundColor({ color: '#16a34a' }); // green
  } catch(_e) {}
}

async function initBadge(){
  const { enabled = true } = await new Promise(r => chrome.storage.sync.get({ enabled: true }, r));
  setBadge(enabled);
}

chrome.storage.onChanged.addListener((changes, area)=>{
  if (area !== 'sync') return;
  if (Object.prototype.hasOwnProperty.call(changes, 'enabled')){
    setBadge(Boolean(changes.enabled.newValue));
  }
  if (Object.prototype.hasOwnProperty.call(changes, 'allowlist')){
    // Rebuild allow rules when allowlist changes
    rebuildDynamicRules();
  }
});

// Also set badge when the service worker starts
initBadge();
// Rebuild dynamic rules on service worker start to ensure rules are present
try { rebuildDynamicRules(); } catch(_e) {}

// ---- DNR dynamic rules (blocklist + allowlist) ----
async function loadJsonResource(path){
  try{
    const url = chrome.runtime.getURL(path);
    const res = await fetch(url);
    if(!res.ok) return null;
    return await res.json();
  }catch(_e){ return null; }
}

function domainToRegex(domain){
  // Match domain and all subdomains, http/https
  const esc = domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return `^https?://([a-z0-9-]+\\.)*${esc}(/|$)`;
}

async function rebuildDynamicRules(){
  try{
    const cfg = await new Promise(r => chrome.storage.sync.get({ allowlist: [] }, r));
    const allowlist = Array.isArray(cfg.allowlist) ? cfg.allowlist : [];
    const block = await loadJsonResource('data/blocklist.json');
    const blockDomains = (block && Array.isArray(block.domains)) ? block.domains : [];

    let id = 20000; // dynamic IDs start here
    const rules = [];

    // Allow rules take precedence via higher priority
    for(const d of allowlist){
      const rx = domainToRegex(String(d).trim().toLowerCase());
      rules.push({
        id: id++,
        priority: 10000,
        action: { type: 'allow' },
        condition: { regexFilter: rx, resourceTypes: ['main_frame'] }
      });
    }

    // Block rules for domains in blocklist
    for(const d of blockDomains){
      const rx = domainToRegex(String(d).trim().toLowerCase());
      rules.push({
        id: id++,
        priority: 10,
        action: { type: 'block' },
        condition: { regexFilter: rx, resourceTypes: ['main_frame'] }
      });
    }

    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    const removeRuleIds = existing.map(r => r.id);
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules: rules });
    console.log('[Safeguard] DNR dynamic rules updated:', rules.length);
  }catch(e){
    console.error('[Safeguard] Failed to rebuild DNR rules', e);
  }
}
