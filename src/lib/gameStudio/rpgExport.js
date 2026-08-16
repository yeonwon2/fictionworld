import { THEMES, PRESENTATION_ART, FONT_OPTIONS, BUTTON_SHAPES, PANEL_SHAPES } from './rpgThemes';

function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function themesForExport() {
  const out = {};
  for (const k of Object.keys(THEMES)) out[k] = { vars: THEMES[k].vars };
  return out;
}

function fontFamiliesForExport() {
  const out = {};
  for (const f of FONT_OPTIONS) out[f.id] = f.family;
  return out;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Không đọc được ảnh'));
    reader.readAsDataURL(blob);
  });
}

async function inlineImage(url) {
  if (!url || String(url).startsWith('data:')) return url || '';
  const response = await fetch(new URL(url, window.location.origin).href);
  if (!response.ok) throw new Error(`Không tải được ảnh (${response.status}): ${url}`);
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error(`Tài nguyên không phải ảnh: ${url}`);
  return blobToDataUrl(blob);
}

export async function prepareOfflineGame(gameData) {
  const game = structuredClone(gameData);
  const presentation = game.meta?.presentation || 'dialogue';
  const defaultArt = PRESENTATION_ART[presentation] || PRESENTATION_ART.dialogue;
  game.meta.defaultArt = defaultArt;
  const urls = new Set([defaultArt, game.meta.playerAvatar, game.meta.defaultNpcAvatar].filter(Boolean));
  for (const node of Object.values(game.nodes || {})) {
    if (node.bgImage) urls.add(node.bgImage);
    if (node.npcAvatar) urls.add(node.npcAvatar);
    if (node.combat?.enemy?.avatar) urls.add(node.combat.enemy.avatar);
  }
  game.meta.offlineAssets = {};
  // Đóng gói TỪNG ảnh độc lập — 1 ảnh lỗi (link chết, chặn CORS...) không được
  // phép làm hỏng cả file xuất ra. Ảnh lỗi bị bỏ qua, engine tự vẽ gradient
  // theo màu theme thay thế (xem asset() trong ENGINE_JS), không có ảnh vỡ.
  const failed = [];
  await Promise.all([...urls].map(async (url) => {
    try {
      game.meta.offlineAssets[url] = await inlineImage(url);
    } catch (e) {
      failed.push({ url, reason: e.message || String(e) });
    }
  }));
  game.meta.offlineAssetFailures = failed;
  return game;
}

// Engine JS: NO backticks, NO ${} — uses string concatenation only.
const ENGINE_JS = [
  '(function(){',
  '  var GAME = GAME_DATA;',
  '  var THEMES = THEMES_MAP;',
  '  var meta = GAME.meta || {};',
  '  var presentation = meta.presentation || "dialogue";',
  '  var archetype = meta.archetype || "none";',
  '  var themeId = meta.theme || "fantasy-parchment";',
  '  var root = document.documentElement;',
  '  var FONT_FAMILIES = FONT_FAMILIES_MAP, BTN_SHAPES = BTN_SHAPES_MAP, PANEL_SHAPES = PANEL_SHAPES_MAP;',
  '  var vars;',
  '  if (themeId === "custom" && meta.customTheme) {',
  '    var ct = meta.customTheme, cc = ct.colors || {}; var btn = BTN_SHAPES[ct.buttonShape] || BTN_SHAPES.soft; var pnl = PANEL_SHAPES[ct.panelShape] || PANEL_SHAPES.panel;',
  '    vars = { "--rpg-bg": cc.bg, "--rpg-panel": cc.panel, "--rpg-panel-2": cc.panel2, "--rpg-text": cc.text, "--rpg-muted": cc.muted, "--rpg-accent": cc.accent, "--rpg-accent2": cc.accent2, "--rpg-border": cc.border, "--rpg-font": FONT_FAMILIES[ct.font] || FONT_FAMILIES["be-vietnam-pro"], "--rpg-btn-radius": btn.radius, "--rpg-panel-radius": pnl.radius, "--rpg-panel-border": pnl.border === "none" ? "none" : (pnl.border + " color-mix(in srgb, " + (cc.accent || "#d7b078") + " 70%, transparent)"), "--rpg-panel-shadow": pnl.shadow };',
  '    document.documentElement.setAttribute("data-bg-pattern", ct.bgPattern || "plain");',
  '  } else {',
  '    var theme = THEMES[themeId] || THEMES["fantasy-parchment"];',
  '    vars = (theme && theme.vars) || {};',
  '  }',
  '  for (var vk in vars){ if (vars[vk]) root.style.setProperty(vk, vars[vk]); }',
  '  document.body.className = "rpg-" + presentation;',
  '',
  '  var statsConfig = meta.statsConfig || [];',
  '  if(!statsConfig.length){ var _is=meta.initialStats||{}; for(var _kk in _is){ statsConfig.push({key:_kk,label:_kk,default:_is[_kk],isVital:(_kk==="hp"||_kk==="san")}); } }',
  '  var litrpg = meta.litrpg || { ranks:["Luyện Khí","Trúc Cơ","Kim Đan","Nguyên Anh"], expPerRank:100 };',
  '  var mysterySlots = (meta.mystery && meta.mystery.inventorySlots) || 4;',
  '  function vitalKeys(){ var r=[]; for(var i=0;i<statsConfig.length;i++){ if(statsConfig[i].isVital) r.push(statsConfig[i].key); } return r; }',
  '  function statLabel(key){ for(var i=0;i<statsConfig.length;i++){ if(statsConfig[i].key===key) return statsConfig[i].label||key; } return key; }',
  '  var LABELS = { rebirth:{t:"Trọng Sinh",c:"#a855f7"}, modern:{t:"Tri Thức Hiện Đại",c:"#0ea5e9"} };',
  '  var ENDINGS = { TRUE_END:{l:"Kết Thúc Thật",i:"V"}, GOOD_END:{l:"Kết Thúc Tốt",i:"*"}, NORMAL_END:{l:"Kết Thúc Thường",i:"="}, BAD_END:{l:"Kết Thúc Xấu",i:"X"} };',
  '  var STAT_STYLES={hp:{c:"#ff4d6d",i:"❤"},mp:{c:"#3b82f6",i:"💧"},mana:{c:"#3b82f6",i:"💧"},gold:{c:"#fbbf24",i:"🪙"},money:{c:"#fbbf24",i:"🪙"},reputation:{c:"#a855f7",i:"⭐"},san:{c:"#22d3ee",i:"🧠"},stamina:{c:"#f97316",i:"🔥"},exp:{c:"#a3e635",i:"✨"},pastKnowledge:{c:"#38bdf8",i:"📖"}};',
  '  function statStyle(k){ return STAT_STYLES[k]||{c:"#94a3b8",i:"⚪"}; }',
  '  var LILYHUB_AVATARS=["https://www.lilyhub.top/avatars/a13.webp","https://www.lilyhub.top/avatars/a14.webp","https://www.lilyhub.top/avatars/a15.webp","https://www.lilyhub.top/avatars/a16.webp","https://www.lilyhub.top/avatars/a17.webp","https://www.lilyhub.top/avatars/a18.webp","https://www.lilyhub.top/avatars/a19.webp","https://www.lilyhub.top/avatars/a20.webp","https://www.lilyhub.top/avatars/a22.webp","https://www.lilyhub.top/avatars/a23.webp","https://www.lilyhub.top/avatars/a24.webp","https://www.lilyhub.top/avatars/a25.webp","https://www.lilyhub.top/avatars/a26.webp","https://www.lilyhub.top/avatars/a27.webp","https://www.lilyhub.top/avatars/a28.webp"];',
  '  function dicebear(seed){ var s=String(seed||"Hero"); var h=0; for(var i=0;i<s.length;i++){ h=(h*31+s.charCodeAt(i))>>>0; } return LILYHUB_AVATARS[h%LILYHUB_AVATARS.length]; }',
  '  function asset(url){ return (meta.offlineAssets&&meta.offlineAssets[url])||url||""; }',
  '',
  '  var SAVE_KEY = "rpg_save_" + (meta.title||"game").replace(/[^a-z0-9]/gi,"_");',
  '  var state = { nodeId:"start_node", stats:Object.assign({}, meta.initialStats||{}), history:[], inventory:[], quests:{}, flags:[], skills:[], exp:0, rankIndex:0, systemPoints:0, npcAffinity:{} };',
  '  var activeTab = "stats";',
  '  var panelOpen = false;',
  '  function load(){ try{ var s=localStorage.getItem(SAVE_KEY); if(s){ var p=JSON.parse(s); if(p&&p.stats){ state=Object.assign({}, state, p); } } }catch(e){} }',
  '  function save(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }catch(e){} }',
  '  function reset(){ state = { nodeId:"start_node", stats:Object.assign({}, meta.initialStats||{}), history:[], inventory:[], quests:{}, flags:[], skills:[], exp:0, rankIndex:0, systemPoints:0, npcAffinity:{} }; }',
  '',
  '  function esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }',
  '  var typingTimer=null, typingFull="";',
  '  function clearTyping(){ if(typingTimer){ clearInterval(typingTimer); typingTimer=null; } }',
  '  function startTypewriter(text, el, onDone){ clearTyping(); typingFull=text||""; var i=0; el.textContent=""; typingTimer=setInterval(function(){ i++; el.textContent=typingFull.slice(0,i); if(i>=typingFull.length){ clearTyping(); if(onDone) onDone(); } },18); }',
  '',
  '  function playTing(){ try{ var Ctx=window.AudioContext||window.webkitAudioContext; var ctx=new Ctx(); if(ctx.state==="suspended"){ ctx.resume(); } var now=ctx.currentTime; var notes=[{f:880,t:0,d:0.18},{f:1320,t:0.12,d:0.4}]; for(var ni=0;ni<notes.length;ni++){ var n=notes[ni]; var osc=ctx.createOscillator(); var gain=ctx.createGain(); osc.connect(gain); gain.connect(ctx.destination); osc.frequency.value=n.f; osc.type="sine"; gain.gain.setValueAtTime(0.0001,now+n.t); gain.gain.exponentialRampToValueAtTime(0.25,now+n.t+0.02); gain.gain.exponentialRampToValueAtTime(0.0001,now+n.t+n.d); osc.start(now+n.t); osc.stop(now+n.t+n.d); } }catch(e){} }',
  '  function triggerShake(){ var g=document.getElementById("game"); if(!g) return; g.classList.remove("rpg-shake"); void g.offsetWidth; g.classList.add("rpg-shake"); setTimeout(function(){ g.classList.remove("rpg-shake"); },520); }',
  '',
  '  function pushEvent(icon, text){ var c=document.getElementById("rpg-events"); if(!c) return; var d=document.createElement("div"); d.className="rpg-toast"; d.innerHTML=icon+" "+esc(text); c.appendChild(d); setTimeout(function(){ if(d.parentNode) d.parentNode.removeChild(d); },3800); }',
  '',
  '  function showSystemPopup(p){ if(!p||!p.title) return; var c=document.getElementById("rpg-syspopup"); if(!c) return; playTing(); c.innerHTML=\'<div class="rpg-sys-overlay" id="sysOverlay"><div class="rpg-sys-box"><div class="rpg-sys-title"><span class="rpg-sys-icon">✦</span> \'+esc(p.title)+\'</div><div class="rpg-sys-text">\'+esc(p.text||"")+\'</div><button class="rpg-sys-btn" id="sysClose">Đã hiểu</button></div></div>\'; c.style.display="block"; var ov=document.getElementById("sysOverlay"); var cl=document.getElementById("sysClose"); if(ov) ov.addEventListener("click", function(){ c.innerHTML=""; c.style.display="none"; }); if(cl) cl.addEventListener("click", function(){ c.innerHTML=""; c.style.display="none"; }); }',
  '',
  '  function rollDice(dr, s){ var stat=dr.stat; var bonus=stat?Math.floor((s[stat]||0)/10):0; var raw=1+Math.floor(Math.random()*20); var total=raw+bonus; var diff=dr.difficulty||10; var margin=total-diff; var out=total>=diff?"success":"fail"; var crit=null; if(raw===20||(out==="success"&&margin>=(dr.critThreshold||5))){out="success";crit="crit_success";}else if(raw===1||(out==="fail"&&margin<=-(dr.critFailThreshold||1))){out="fail";crit="crit_fail";} return {raw:raw,bonus:bonus,total:total,diff:diff,margin:margin,outcome:out,crit:crit}; }',
  '  function applyDice(dr, r, s){ var mods=r.outcome==="success"?(dr.successMods||{}):(dr.failMods||{}); var fm=Object.assign({},mods); if(r.crit==="crit_success"){for(var k in fm){if(fm[k]>0)fm[k]=Math.round(fm[k]*1.8);}}else if(r.crit==="crit_fail"){for(var k2 in fm){if(fm[k2]<0)fm[k2]=Math.round(fm[k2]*1.6);}} var ns=Object.assign({},s); for(var k3 in fm){ns[k3]=(ns[k3]||0)+fm[k3];} var tgt=r.outcome==="success"?(dr.successTarget||dr.targetNodeId):(dr.failTarget||dr.targetNodeId); return {stats:ns,mods:fm,target:tgt}; }',
  '  function showDiceRoll(c){ var c2=document.getElementById("rpg-syspopup"); if(!c2) return; var stat=statLabel(c.diceRoll.stat||""); var bonus=c.diceRoll.stat?Math.floor((state.stats[c.diceRoll.stat]||0)/10):0; c2.innerHTML=\'<div class="rpg-dice-overlay"><div class="rpg-dice-box"><div class="rpg-sys-title">🎲 Quay Xúc Xắc Định Mệnh</div><div class="rpg-dice-stat">Dựa trên \'+esc(stat)+\' (thường +\'+bonus+\')</div><div class="rpg-dice" id="diceFace">?</div><div id="diceHint" class="rpg-dice-hint">Đang quay...</div></div></div>\'; c2.style.display="block"; var face=document.getElementById("diceFace"); var hint=document.getElementById("diceHint"); var ticks=0; var iv=setInterval(function(){ ticks++; if(ticks>14){ clearInterval(iv); var r=rollDice(c.diceRoll, state.stats); face.textContent=r.raw; face.className="rpg-dice "+(r.outcome==="success"?"win":"lose"); hint.innerHTML=""; var s1=document.createElement("div"); s1.innerHTML="<b>"+r.raw+(r.bonus>0?" + "+r.bonus:"")+" = "+r.total+" / "+r.diff+"</b>"; hint.appendChild(s1); var s2=document.createElement("div"); s2.className="rpg-dice-res"; s2.style.color=r.outcome==="success"?"#39d14a":"#ff4d4d"; s2.textContent=r.crit==="crit_success"?"CRITICAL THÀNH CÔNG!":r.crit==="crit_fail"?"CRITICAL THẤT BẠI!":(r.outcome==="success"?"THÀNH CÔNG":"THẤT BẠI"); hint.appendChild(s2); var btn=document.createElement("button"); btn.className="rpg-sys-btn"; btn.textContent="Tiếp tục"; btn.addEventListener("click", function(){ c2.innerHTML=""; c2.style.display="none"; resolveDice(c, r); }); hint.appendChild(btn); } else { face.textContent=1+Math.floor(Math.random()*20); face.style.transform="rotate("+(ticks*24)+"deg)"; } },70); }',
  '  function resolveDice(c, r){ var res=applyDice(c.diceRoll, r, state.stats); state.stats=res.stats; pushEvent("🎲", r.crit?(r.outcome==="success"?"CRITICAL thành công!":"CRITICAL thất bại!"):(r.outcome==="success"?"Quay trúng!":"Quay trượt...")); var dead=checkGameOver(res.stats); if(!dead){ state.history.push(state.nodeId); if(res.target && GAME.nodes[res.target]) state.nodeId=res.target; } save(); render(); }',
  '',
  '  var combatState=null;',
  '  function startCombat(node){ combatState={ node:node, enemyHp:node.combat.enemy.hp, enemyMaxHp:node.combat.enemy.hp, playerHp:state.stats.hp||100, playerMaxHp:state.stats.hp||100, playerMp:state.stats.mp||state.stats.mana||30, defending:false, turn:"player", over:null, log:[{t:"start",text:(node.combat.enemy.name||"Kẻ thù")+" xuất hiện! "+(node.combat.enemy.intro||"")}] }; renderCombat(); }',
  '  function renderCombat(){ var cs=combatState; if(!cs) return; var node=cs.node; var cb=node.combat; var e=cb.enemy; var s=""; s+=\'<div class="rpg-combat"><div class="rpg-combat-tag">⚔️ Chiến Đấu</div>\'; s+=\'<div class="rpg-combat-enemy"><img class="rpg-combat-avatar" src="\'+esc(asset(e.avatar)||dicebear(e.name))+\'"/><div class="rpg-combat-enemyinfo"><div class="rpg-combat-name">\'+esc(e.name||"Kẻ thù")+\'</div><div class="rpg-hpbar"><div class="rpg-hpfill" style="width:\'+Math.max(0,Math.min(100,cs.enemyHp/cs.enemyMaxHp*100))+\'%"></div></div><div class="rpg-hpnum">\'+cs.enemyHp+\'/\'+cs.enemyMaxHp+\'</div>\'+(e.intro?\'<div class="rpg-combat-intro">\'+esc(e.intro)+\'</div>\':"")+\'</div></div>\'; s+=\'<div class="rpg-combat-player"><div class="rpg-mpbar-wrap"><span>HP</span><div class="rpg-hpbar"><div class="rpg-hpfill" style="width:\'+Math.max(0,Math.min(100,cs.playerHp/cs.playerMaxHp*100))+\'%"></div></div><span>\'+cs.playerHp+\'</span></div><div class="rpg-mpbar-wrap"><span>MP</span><div class="rpg-mpbar"><div class="rpg-mpfill" style="width:\'+Math.max(0,Math.min(100,cs.playerMp/30*100))+\'%"></div></div><span>\'+cs.playerMp+\'</span></div></div>\'; s+=\'<div class="rpg-combat-log" id="combatLog">\'; for(var i=0;i<cs.log.length;i++){ var l=cs.log[i]; s+=\'<div class="rpg-clog rpg-clog-\'+l.t+\'">\'+esc(l.text)+\'</div>\'; } s+=\'</div>\'; if(!cs.over){ s+=\'<div class="rpg-combat-actions"><button class="rpg-cbtn red" data-act="atk">⚔️ Tấn công</button><button class="rpg-cbtn sky" data-act="def">🛡 Phòng thủ</button>\'; if(state.skills && state.skills.length){ s+=\'<button class="rpg-cbtn violet" data-act="skill">✨ \'+esc(state.skills[0])+\' (15MP)</button>\'; } s+=\'<button class="rpg-cbtn outline" data-act="flee">🏃 Bỏ chạy</button></div>\'; if(cs.turn==="enemy"){ s+=\'<div class="rpg-clog-hint">Lượt địch hành động...</div>\'; } } else { s+=\'<div class="rpg-combat-over">\'+(cs.over==="win"?"🏆 Chiến thắng!":cs.over==="flee"?"🏃 Đã rút lui":"💀 Thất bại...")+\'<button class="rpg-sys-btn" id="combatDone">Tiếp tục</button></div>\'; } s+=\'</div>\'; var container=document.getElementById("game"); container.innerHTML=renderStatusBar()+renderArchBar()+s; bindStatusBar(); var btns=container.querySelectorAll(".rpg-cbtn"); for(var j=0;j<btns.length;j++){ (function(b){ b.addEventListener("click", function(){ combatAct(b.getAttribute("data-act")); }); })(btns[j]); } var cd=container.querySelector("#combatDone"); if(cd) cd.addEventListener("click", finishCombat); }',
  '  function combatAct(act){ var cs=combatState; if(!cs||cs.over||cs.turn!=="player") return; var e=cs.node.combat.enemy; var pAtk=12+(state.rankIndex||0)*3+((state.skills||[]).length*2); if(act==="atk"){ var crit=Math.random()<0.15; var dmg=Math.max(1,Math.round((pAtk-e.defense)*(0.85+Math.random()*0.3))); if(crit) dmg=Math.round(dmg*1.6); cs.enemyHp=Math.max(0,cs.enemyHp-dmg); cs.log.push({t:crit?"crit":"player",text:"Bạn tấn công"+(crit?" (CRITICAL!)":"")+" gây "+dmg+" sát thương."}); if(cs.enemyHp<=0){ cs.over="win"; cs.log.push({t:"win",text:"Bạn đã đánh bại "+(e.name||"kẻ thù")+"!"}); } else { cs.turn="enemy"; } renderCombat(); if(cs.turn==="enemy"&&!cs.over) setTimeout(combatEnemyTurn,600); return; } if(act==="def"){ cs.defending=true; cs.log.push({t:"defend",text:"Bạn giơ khiên phòng thủ."}); cs.turn="enemy"; renderCombat(); setTimeout(combatEnemyTurn,600); return; } if(act==="skill"){ if(cs.playerMp<15){ cs.log.push({t:"warn",text:"Không đủ MP!"}); renderCombat(); return; } cs.playerMp-=15; var sdmg=Math.max(1,Math.round((pAtk-e.defense)*1.8)+Math.floor(Math.random()*6)); cs.enemyHp=Math.max(0,cs.enemyHp-sdmg); cs.log.push({t:"skill",text:"Kỹ năng bùng nổ! Gây "+sdmg+" sát thương."}); if(cs.enemyHp<=0){ cs.over="win"; cs.log.push({t:"win",text:"Chiến thắng!"}); } else { cs.turn="enemy"; } renderCombat(); if(cs.turn==="enemy"&&!cs.over) setTimeout(combatEnemyTurn,600); return; } if(act==="flee"){ var fc=cs.node.combat.fleeChance!=null?cs.node.combat.fleeChance:0.4; if(Math.random()<fc){ cs.over="flee"; cs.log.push({t:"flee",text:"Bỏ chạy thành công!"}); } else { cs.log.push({t:"warn",text:"Bỏ chạy thất bại!"}); cs.turn="enemy"; } renderCombat(); if(cs.turn==="enemy"&&!cs.over) setTimeout(combatEnemyTurn,600); return; } }',
  '  function combatEnemyTurn(){ var cs=combatState; if(!cs||cs.over) return; var e=cs.node.combat.enemy; var dmg=Math.max(1,Math.round(e.attack*(0.85+Math.random()*0.3))); if(cs.defending) dmg=Math.max(1,Math.round(dmg*0.4)); cs.defending=false; cs.playerHp=Math.max(0,cs.playerHp-dmg); cs.log.push({t:"enemy",text:(e.name||"Kẻ thù")+" gây "+dmg+" sát thương."}); if(cs.playerHp<=0){ cs.over="lose"; cs.log.push({t:"lose",text:"Bạn đã gục ngã..."}); } else { cs.turn="player"; } renderCombat(); }',
  '  function finishCombat(){ var cs=combatState; if(!cs) return; var node=cs.node; var ns=Object.assign({}, state.stats, {hp:cs.playerHp, mp:cs.playerMp}); var inv=state.inventory.slice(); var target=null; if(cs.over==="win"){ var loot=node.combat.loot||{}; if(loot.statModifiers){ for(var k in loot.statModifiers){ ns[k]=(ns[k]||0)+loot.statModifiers[k]; } } if(loot.grantItem && inv.indexOf(loot.grantItem)<0 && inv.length<mysterySlots){ inv.push(loot.grantItem); pushEvent("📦","Nhặt được: "+loot.grantItem); } if(loot.exp){ var exp=state.exp+loot.exp; var ri=state.rankIndex; var ranks=litrpg.ranks||[]; var per=litrpg.expPerRank||100; while(exp>=per && ri<ranks.length-1){ exp-=per; ri++; pushEvent("⚡","Đột phá! Đạt "+ranks[ri]); } ns.exp=exp; ns.rankIndex=ri; } target=node.combat.winTarget; pushEvent("🏆","Chiến thắng "+(node.combat.enemy.name||"kẻ thù")+"!"); } else if(cs.over==="flee"){ target=node.combat.fleeTarget; } else { target=node.combat.loseTarget; } state.stats=ns; state.inventory=inv; var dead=cs.over==="lose"||checkGameOver(ns); combatState=null; if(!dead && target && GAME.nodes[target]){ state.history.push(state.nodeId); state.nodeId=target; } save(); render(); }',
  '',
  '  function meetsStatReq(req, s){ if(!req) return true; for(var k in req){ if((s[k]||0) < req[k]) return false; } return true; }',
  '  function checkGameOver(s){ var vks=vitalKeys(); for(var i=0;i<vks.length;i++){ if((s[vks[i]]||0)<=0) return true; } return false; }',
  '',
  '  function choiceStatus(c){ if(!meetsStatReq(c.statRequirements, state.stats)){ var parts=[]; for(var k in (c.statRequirements||{})){ parts.push(statLabel(k)+" >= "+c.statRequirements[k]+" (cần "+(c.statRequirements[k]-(state.stats[k]||0))+")"); } return {ok:false, reason:parts.join(", ")}; } if(c.requiresItem && state.inventory.indexOf(c.requiresItem)<0){ return {ok:false, reason:"Cần vật phẩm: "+c.requiresItem}; } if(c.requiresFlag && state.flags.indexOf(c.requiresFlag)<0){ return {ok:false, reason:"Cần có: "+c.requiresFlag}; } if(c.requiresFlagAbsent && state.flags.indexOf(c.requiresFlagAbsent)>=0){ return {ok:false, reason:"Chỉ khi chưa có cờ: "+c.requiresFlagAbsent}; } return {ok:true}; }',
  '',
  '  function renderStatusBar(){ var s="";',
  '    s+=\'<div class="rpg-player">\';',
  '    s+=\'<img class="rpg-avatar" src="\'+esc(asset(meta.playerAvatar)||dicebear(meta.player_name))+\'"/>\';',
  '    s+=\'<div class="rpg-playerinfo"><div class="rpg-playername">\'+esc(meta.player_name||"Người Chơi")+\'</div></div></div>\';',
  '    s+=\'<div class="rpg-savebtns">\'+(meta.player_bio?\'<button id="btnBio">ℹ️ Nhân vật</button>\':"")+\'<button id="btnReset">Chơi lại</button></div>\';',
  '    return s; }',
  '',
  '  function renderArchBar(){ if(archetype!=="litrpg") return ""; var pct=Math.min(100, (state.exp/(litrpg.expPerRank||100))*100); var rank=(litrpg.ranks||[])[state.rankIndex]||"—"; return \'<div class="rpg-archbar"><span class="rpg-rank">⚡ \'+esc(rank)+\'</span><div class="rpg-expwrap"><div class="rpg-explabel">EXP: \'+state.exp+\'/\'+(litrpg.expPerRank||100)+\'</div><div class="rpg-expbar"><div class="rpg-expfill" style="width:\'+pct+\'%"></div></div></div><span class="rpg-sp">💎 Điểm HT: <b>\'+state.systemPoints+\'</b></span></div>\'; }',
  '',
  '  function renderTabs(){ if(archetype==="none") return ""; var showInv=(archetype==="mystery"||archetype==="litrpg"); var showQuest=(archetype==="litrpg"); var s=\'<div class="rpg-tabs-wrap">\';',
  '    s+=\'<div class="rpg-tabs"><button class="rpg-tab\'+(panelOpen&&activeTab==="stats"?" active":"")+\'" data-tab="stats">Chỉ số</button>\';',
  '    if(showInv){ s+=\'<button class="rpg-tab\'+(panelOpen&&activeTab==="inventory"?" active":"")+\'" data-tab="inventory">🎒 Túi đồ (\'+state.inventory.length+(archetype==="mystery"?"/"+mysterySlots:"")+\')</button>\'; }',
  '    if(showQuest){ var act=0; for(var q in state.quests){ if(state.quests[q].status==="active") act++; } s+=\'<button class="rpg-tab\'+(panelOpen&&activeTab==="quests"?" active":"")+\'" data-tab="quests">📜 Nhiệm vụ (\'+act+\')</button>\'; }',
  '    s+=\'<button class="rpg-tab-toggle" id="tabToggle">\'+(panelOpen?"▲":"▼")+\'</button></div>\';',
  '    if(panelOpen){ s+=\'<div class="rpg-tab-content">\'+renderTabContent()+\'</div>\'; }',
  '    s+=\'</div>\'; return s; }',
  '',
  '  function renderTabContent(){ if(activeTab==="inventory"){ return renderInventory(); } if(activeTab==="quests"){ return renderQuests(); } return renderStatsTab(); }',
  '  function renderStatsTab(){ var s=\'<div class="rpg-stat-grid">\'; for(var i=0;i<statsConfig.length;i++){ var sc=statsConfig[i]; var st=statStyle(sc.key); s+=\'<div class="rpg-stat-card" style="border-color:\'+st.c+\'33"><span class="rpg-stat-icon" style="background:\'+st.c+\'22;color:\'+st.c+\'">\'+st.i+\'</span><span class="rpg-stat-info"><span class="rpg-stat-label">\'+esc(sc.label||sc.key)+\'</span><span class="rpg-stat-value">\'+(state.stats[sc.key]||0)+\'</span></span></div>\'; } s+=\'</div>\';',
  '    if(archetype==="isekai"){ if(state.flags.length){ s+=\'<div class="rpg-tab-sec">🦋 Story Flags</div><div class="rpg-chips">\'; for(var i=0;i<state.flags.length;i++){ s+=\'<span class="rpg-chip">\'+esc(state.flags[i])+\'</span>\'; } s+=\'</div>\'; } var na=state.npcAffinity; var has=false; for(var n in na){ has=true; } if(has){ s+=\'<div class="rpg-tab-sec">💬 Độ hảo cảm NPC</div>\'; for(var n in na){ s+=\'<div class="rpg-tab-row"><span>\'+esc(n)+\'</span><b style="color:\'+(na[n]>=0?"#39d14a":"#ff4d4d")+\'">\'+(na[n]>0?"+":"")+na[n]+\'</b></div>\'; } } }',
  '    if(archetype==="litrpg" && state.skills.length){ s+=\'<div class="rpg-tab-sec">✨ Kỹ năng</div><div class="rpg-chips">\'; for(var i=0;i<state.skills.length;i++){ s+=\'<span class="rpg-chip">\'+esc(state.skills[i])+\'</span>\'; } s+=\'</div>\'; }',
  '    return s; }',
  '  function renderInventory(){ if(!state.inventory.length) return \'<p class="rpg-empty">Túi đồ trống.</p>\'; var s=\'<div class="rpg-inv-grid">\'; for(var i=0;i<state.inventory.length;i++){ s+=\'<div class="rpg-inv-slot">🎒 \'+esc(state.inventory[i])+\'</div>\'; } s+=\'</div>\'; return s; }',
  '  function renderQuests(){ var has=false; for(var q in state.quests){ has=true; } if(!has) return \'<p class="rpg-empty">Chưa có nhiệm vụ.</p>\'; var s=""; for(var q in state.quests){ var qq=state.quests[q]; s+=\'<div class="rpg-quest\'+(qq.status==="completed"?" done":"")+\'"><div class="rpg-quest-head"><span>\'+(qq.status==="completed"?"✅":"📜")+\' \'+esc(qq.title)+\'</span><span class="rpg-quest-st">\'+(qq.status==="completed"?"Hoàn thành":"Đang làm")+\'</span></div>\'; if(qq.desc) s+=\'<div class="rpg-quest-desc">\'+esc(qq.desc)+\'</div>\'; if(qq.reward) s+=\'<div class="rpg-quest-rew">🎁 \'+esc(qq.reward)+\'</div>\'; s+=\'</div>\'; } return s; }',
  '',
  '  function renderScene(node){ var s="";',
  '    s+=\'<div class="rpg-statusbar">\'+renderStatusBar()+\'</div>\';',
  '    s+=renderArchBar();',
  '    s+=renderTabs();',
  '    var art=node.npcAvatar||meta.defaultNpcAvatar||node.bgImage||""; var initial=(node.speaker||"?").trim().charAt(0).toUpperCase()||"?";',
  '    s+=\'<div class="rpg-vn-frame">\';',
  '    s+=\'<div class="rpg-vn-portrait">\';',
  '    if(art){ s+=\'<img class="rpg-vn-portrait-img" src="\'+esc(asset(art))+\'"/>\'; } else { s+=\'<div class="rpg-vn-portrait-fallback"><span class="rpg-vn-monogram">\'+esc(initial)+\'</span></div>\'; }',
  '    if(node.speaker){ s+=\'<div class="rpg-vn-speaker-scrim"><span class="rpg-vn-speaker-tag">\'+esc(node.speaker)+\'</span></div>\'; }',
  '    s+=\'</div>\';',
  '    s+=\'<div class="rpg-vn-dialogue"><div class="rpg-vn-text" id="dialogue"></div><button class="rpg-vn-skip" id="skipBtn">Bỏ qua ⏭</button></div>\';',
  '    s+=\'<div class="rpg-vn-choices" id="choices"></div>\';',
  '    s+=\'</div>\';',
  '    return s; }',
  '',
  '  function renderChoices(node){ var el=document.getElementById("choices"); if(!el) return; var s="";',
  '    for(var i=0;i<(node.choices||[]).length;i++){ var c=node.choices[i]; var st=choiceStatus(c);',
  '      s+=\'<button class="rpg-vn-choice" data-idx="\'+i+\'"\'+(st.ok?"":" disabled")+\'>\';',
  '      s+=\'<div class="rpg-vn-choice-row">\';',
  '      if(!st.ok){ s+=\'<span class="rpg-lock">🔒</span> \'; }',
  '      if(c.label && LABELS[c.label]){ s+=\'<span class="rpg-vn-choice-label" style="background:\'+LABELS[c.label].c+\'22;color:\'+LABELS[c.label].c+\'">[\'+LABELS[c.label].t+\']</span> \'; }',
  '      if(c.diceRoll){ s+=\'<span class="rpg-vn-choice-dice">🎲 \'+esc(statLabel(c.diceRoll.stat||""))+\' ≥\'+c.diceRoll.difficulty+\'</span> \'; }',
  '      s+=\'<span>\'+esc(c.text||"")+\'</span>\';',
  '      s+=\'</div>\';',
  '      if(!st.ok){ s+=\'<div class="rpg-vn-choice-reason">🔒 \'+esc(st.reason)+\'</div>\'; }',
  '      s+=\'</button>\'; }',
  '    if((node.choices||[]).length===0 && !node.isEnding){ s+=\'<p class="rpg-vn-empty">Không có lựa chọn. <button id="btnReset2">Chơi lại</button></p>\'; }',
  '    el.innerHTML=s;',
  '    var btns=el.querySelectorAll(".rpg-vn-choice"); for(var j=0;j<btns.length;j++){ (function(b){ b.addEventListener("click", function(){ choose(node, parseInt(b.getAttribute("data-idx"))); }); })(btns[j]); }',
  '    var r2=el.querySelector("#btnReset2"); if(r2){ r2.addEventListener("click", function(){ reset(); render(); }); } }',
  '',
  '  function choose(node, idx){ var c=(node.choices||[])[idx]; if(!c) return; var st=choiceStatus(c); if(!st.ok) return;',
  '    if(c.diceRoll){ showDiceRoll(c); return; }',
  '    var ns=Object.assign({}, state.stats); for(var k in (c.statModifiers||{})){ ns[k]=(ns[k]||0)+c.statModifiers[k]; }',
  '    var ev=[]; var exp=state.exp, rankIndex=state.rankIndex, systemPoints=state.systemPoints; var inv=state.inventory.slice(), flags=state.flags.slice(), skills=state.skills.slice(); var quests=Object.assign({}, state.quests); var npcAffinity=Object.assign({}, state.npcAffinity);',
  '    if(c.exp){ exp=state.exp+c.exp; var ranks=litrpg.ranks||[]; var per=litrpg.expPerRank||100; while(exp>=per && rankIndex<ranks.length-1){ exp-=per; rankIndex++; ev.push(["⚡","Đột phá Cảnh giới! Đạt "+ranks[rankIndex]]); } }',
  '    if(c.systemPoints){ systemPoints=state.systemPoints+c.systemPoints; }',
  '    if(c.grantFlag && flags.indexOf(c.grantFlag)<0){ flags.push(c.grantFlag); ev.push(["🦋","Kích hoạt hiệu ứng Cánh bướm: "+c.grantFlag]); }',
  '    if(c.grantItem && inv.indexOf(c.grantItem)<0 && inv.length<mysterySlots){ inv.push(c.grantItem); ev.push(["📦","Nhặt được: "+c.grantItem]); }',
  '    if(c.removeItem){ inv=inv.filter(function(x){ return x!==c.removeItem; }); }',
  '    if(c.unlockSkill && skills.indexOf(c.unlockSkill)<0){ skills.push(c.unlockSkill); ev.push(["✨","Mở khóa kỹ năng: "+c.unlockSkill]); }',
  '    if(c.completeQuestId && quests[c.completeQuestId]){ quests[c.completeQuestId]=Object.assign({}, quests[c.completeQuestId], {status:"completed"}); ev.push(["✅","Hoàn thành nhiệm vụ: "+quests[c.completeQuestId].title]); }',
  '    if(c.npcAffinity){ for(var n in c.npcAffinity){ npcAffinity[n]=(npcAffinity[n]||0)+c.npcAffinity[n]; } }',
  '    state.stats=ns; state.exp=exp; state.rankIndex=rankIndex; state.systemPoints=systemPoints; state.inventory=inv; state.flags=flags; state.skills=skills; state.quests=quests; state.npcAffinity=npcAffinity;',
  '    for(var i=0;i<ev.length;i++){ pushEvent(ev[i][0], ev[i][1]); }',
  '    if(c.systemPopup && c.systemPopup.title){ showSystemPopup(c.systemPopup); }',
  '    var dead=checkGameOver(ns);',
  '    if(!dead){ state.history.push(state.nodeId); if(c.targetNodeId && GAME.nodes[c.targetNodeId]){ state.nodeId=c.targetNodeId; } }',
  '    save(); render(); }',
  '',
  '  function renderSummary(){ var s=\'<div class="rpg-sum-title">Thành tích</div>\'; for(var i=0;i<statsConfig.length;i++){ var sc=statsConfig[i]; s+=\'<div class="rpg-sum-row"><span>\'+esc(sc.label||sc.key)+\'</span><b>\'+(state.stats[sc.key]||0)+\'</b></div>\'; } s+=\'<div class="rpg-sum-row"><span>Số cảnh đã qua</span><b>\'+state.history.length+\'</b></div>\'; return s; }',
  '',
  '  function renderGameOver(){ return \'<div class="rpg-bg"></div><div class="rpg-ending"><div class="rpg-ending-badge bad">GAME OVER</div><div class="rpg-ending-text">Bạn đã gục ngã. Số phận đã khép lại quá sớm...</div><div class="rpg-summary">\'+renderSummary()+\'</div><button class="rpg-restart" id="goRestart">Bắt đầu lại</button></div>\'; }',
  '',
  '  function renderEnding(node){ var et=node.endingType||"NORMAL_END"; var em=ENDINGS[et]||{l:"Kết Thúc",i:"T"}; return \'<div class="rpg-bg" style="background-image:url(\\\'\'+esc(asset(node.bgImage)||"")+\'\\\')"></div><div class="rpg-ending"><div class="rpg-ending-badge \'+et.toLowerCase()+\'">\'+em.i+" "+em.l+\'</div><div class="rpg-ending-text">\'+esc(node.text||"")+\'</div><div class="rpg-summary">\'+renderSummary()+\'</div><button class="rpg-restart" id="endRestart">Chơi lại từ đầu</button></div>\'; }',
  '',
  '  function bindStatusBar(){ var bb=document.getElementById("btnBio"); if(bb) bb.addEventListener("click", function(){ showSystemPopup({title:meta.player_name||"Nhân vật", text:meta.player_bio||""}); }); var br=document.getElementById("btnReset"); if(br) br.addEventListener("click", function(){ reset(); render(); }); }',
  '  function bindTabs(){ var tb=document.querySelectorAll(".rpg-tab"); for(var i=0;i<tb.length;i++){ (function(b){ b.addEventListener("click", function(){ activeTab=b.getAttribute("data-tab"); panelOpen=true; var tw=document.querySelector(".rpg-tabs-wrap"); if(tw){ tw.outerHTML=renderTabs(); bindTabs(); } }); })(tb[i]); } var tt=document.getElementById("tabToggle"); if(tt){ tt.addEventListener("click", function(){ panelOpen=!panelOpen; var tw=document.querySelector(".rpg-tabs-wrap"); if(tw){ tw.outerHTML=renderTabs(); bindTabs(); } }); } }',
  '',
  '  function render(){ clearTyping(); var node=GAME.nodes[state.nodeId]; if(!node){ state.nodeId="start_node"; node=GAME.nodes["start_node"]; } if(!node){ document.getElementById("game").innerHTML=\'<div class="rpg-error">Không có dữ liệu game.</div>\'; return; }',
  '    var dead=checkGameOver(state.stats); var container=document.getElementById("game");',
  '    if(dead){ container.innerHTML=renderStatusBar()+renderArchBar()+renderTabs()+renderGameOver(); bindStatusBar(); bindTabs(); triggerShake(); var r=document.getElementById("goRestart"); if(r) r.addEventListener("click", function(){ reset(); render(); }); return; }',
  '    if(node.isEnding){ container.innerHTML=renderStatusBar()+renderArchBar()+renderTabs()+renderEnding(node); bindStatusBar(); bindTabs(); if(node.endingType==="BAD_END"){ triggerShake(); } var er=document.getElementById("endRestart"); if(er) er.addEventListener("click", function(){ reset(); render(); }); return; }',
  '    if(node.combat && node.combat.enemy && !node.isEnding){ startCombat(node); return; }',
  '    container.innerHTML=renderScene(node); bindStatusBar(); bindTabs();',
  '    // entry processing',
  '    var inv=state.inventory.slice(), flags=state.flags.slice(), quests=Object.assign({}, state.quests); var ns=Object.assign({}, state.stats);',
  '    if(node.randomEvents && node.randomEvents.length){ for(var ei=0;ei<node.randomEvents.length;ei++){ var ev=node.randomEvents[ei]; if(Math.random()<(ev.chance||0.2)){ if(ev.statModifiers){ for(var ek in ev.statModifiers){ ns[ek]=(ns[ek]||0)+ev.statModifiers[ek]; } } if(ev.grantItem && inv.indexOf(ev.grantItem)<0 && inv.length<mysterySlots){ inv.push(ev.grantItem); } pushEvent(ev.icon||"🎲", ev.text||"Sự kiện bất ngờ!"); } } }',
  '    if(node.systemPopup && node.systemPopup.title){ showSystemPopup(node.systemPopup); }',
  '    if(node.grantItem && inv.indexOf(node.grantItem)<0 && inv.length<mysterySlots){ inv.push(node.grantItem); pushEvent("📦","Nhặt được: "+node.grantItem); }',
  '    if(node.setFlags){ for(var i=0;i<node.setFlags.length;i++){ if(flags.indexOf(node.setFlags[i])<0){ flags.push(node.setFlags[i]); pushEvent("🦋","Kích hoạt hiệu ứng Cánh bướm: "+node.setFlags[i]); } } }',
  '    if(node.quest && node.quest.id && !quests[node.quest.id]){ quests[node.quest.id]=Object.assign({}, node.quest, {status:"active"}); pushEvent("📜","Nhiệm vụ mới: "+node.quest.title); }',
  '    state.stats=ns; state.inventory=inv; state.flags=flags; state.quests=quests;',
  '    var skipBtn=document.getElementById("skipBtn"); var dialogue=document.getElementById("dialogue"); var done=false;',
  '    startTypewriter(node.text||"", dialogue, function(){ done=true; renderChoices(node); });',
  '    if(skipBtn){ skipBtn.addEventListener("click", function(){ clearTyping(); dialogue.textContent=typingFull; if(!done){ done=true; renderChoices(node); } }); } }',
  '',
  '  load(); render();',
  '})();',
].join('\n');

const ENGINE_CSS = `
:root{--rpg-bg:#0F172A;--rpg-panel:#1E293B;--rpg-panel-2:#334155;--rpg-text:#f1f5f9;--rpg-muted:#94a3b8;--rpg-accent:#22d3ee;--rpg-accent2:#a855f7;--rpg-border:#22d3ee55;--rpg-font:Inter,system-ui,sans-serif;}
*{box-sizing:border-box;}
html,body{margin:0;padding:0;height:100%;}
body{background:var(--rpg-bg);color:var(--rpg-text);font-family:var(--rpg-font);min-height:100vh;}
#game{display:flex;flex-direction:column;position:relative;max-width:900px;margin:0 auto;width:100%;padding:16px;gap:12px;}
.rpg-bg{position:absolute;inset:0;background-size:cover;background-position:center;opacity:0.3;z-index:0;border-radius:14px;}
.rpg-statusbar{position:relative;z-index:2;display:flex;justify-content:space-between;align-items:center;gap:12px;background:color-mix(in srgb,var(--rpg-panel) 70%,transparent);backdrop-filter:blur(10px);border:1px solid var(--rpg-accent)33;border-radius:14px;padding:10px 14px;flex-wrap:wrap;box-shadow:0 0 14px var(--rpg-accent)11;}
.rpg-player{display:flex;align-items:center;gap:10px;}
.rpg-avatar{width:44px;height:44px;border-radius:50%;border:2px solid var(--rpg-accent);object-fit:cover;box-shadow:0 0 10px var(--rpg-accent)66;}
.rpg-playerinfo{display:flex;flex-direction:column;gap:4px;}
.rpg-playername{font-weight:bold;font-size:15px;}
.rpg-savebtns{display:flex;gap:6px;}
.rpg-savebtns button{background:var(--rpg-accent);color:var(--rpg-panel);border:1px solid var(--rpg-border);border-radius:6px;padding:6px 10px;cursor:pointer;font-family:var(--rpg-font);font-size:12px;font-weight:bold;}
.rpg-savebtns button:hover{filter:brightness(1.1);}
.rpg-archbar{position:relative;z-index:2;display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:color-mix(in srgb,var(--rpg-panel) 70%,transparent);backdrop-filter:blur(8px);border:1px solid var(--rpg-accent)33;border-radius:12px;padding:8px 12px;}
.rpg-rank{font-size:12px;font-weight:bold;background:var(--rpg-accent);color:var(--rpg-panel);padding:3px 10px;border-radius:6px;}
.rpg-expwrap{flex:1;min-width:120px;}
.rpg-explabel{font-size:10px;color:var(--rpg-muted);margin-bottom:2px;}
.rpg-expbar{height:8px;border-radius:999px;overflow:hidden;background:var(--rpg-panel-2);border:1px solid var(--rpg-border);}
.rpg-expfill{height:100%;background:var(--rpg-accent2);border-radius:999px;transition:width .3s;}
.rpg-sp{font-size:12px;color:var(--rpg-text);}
.rpg-tabs-wrap{position:relative;z-index:2;border:1px solid var(--rpg-accent)33;border-radius:12px;overflow:hidden;backdrop-filter:blur(8px);}
.rpg-tabs{display:flex;}
.rpg-tab-toggle{padding:7px 10px;font-size:12px;border:none;cursor:pointer;background:var(--rpg-panel-2);color:var(--rpg-muted);flex-shrink:0;}
.rpg-tab{flex:1;padding:7px 10px;font-size:12px;font-family:var(--rpg-font);border:none;cursor:pointer;background:var(--rpg-panel-2);color:var(--rpg-muted);transition:background .15s;}
.rpg-tab.active{background:var(--rpg-accent);color:var(--rpg-panel);font-weight:bold;}
.rpg-tab-content{padding:10px;font-size:12px;background:color-mix(in srgb,var(--rpg-panel) 80%,transparent);color:var(--rpg-text);min-height:40px;}
.rpg-tab-row{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dashed var(--rpg-border);}
.rpg-stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;}
.rpg-stat-card{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:10px;background:var(--rpg-panel-2);border:1px solid;}
.rpg-stat-icon{width:24px;height:24px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;}
.rpg-stat-info{display:flex;flex-direction:column;min-width:0;}
.rpg-stat-label{font-size:9px;color:var(--rpg-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.rpg-stat-value{font-size:13px;font-weight:bold;color:var(--rpg-text);}
.rpg-tab-sec{font-weight:bold;margin:8px 0 4px;color:var(--rpg-accent2);}
.rpg-chips{display:flex;flex-wrap:wrap;gap:4px;}
.rpg-chip{padding:2px 8px;border-radius:6px;font-size:10px;background:var(--rpg-panel-2);border:1px solid var(--rpg-border);}
.rpg-inv-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;}
.rpg-inv-slot{padding:8px;text-align:center;border-radius:8px;background:var(--rpg-panel-2);border:1px solid var(--rpg-border);}
.rpg-quest{padding:8px;border-radius:8px;background:var(--rpg-panel-2);border:1px solid var(--rpg-border);margin-bottom:6px;}
.rpg-quest.done{opacity:0.6;}
.rpg-quest-head{display:flex;justify-content:space-between;font-weight:bold;font-size:12px;}
.rpg-quest-st{font-size:10px;color:var(--rpg-accent2);}
.rpg-quest.done .rpg-quest-st{color:#39d14a;}
.rpg-quest-desc{font-size:11px;color:var(--rpg-muted);margin-top:3px;}
.rpg-quest-rew{font-size:11px;margin-top:3px;}
.rpg-empty{color:var(--rpg-muted);font-style:italic;}
.rpg-vn-frame{border:var(--rpg-panel-border, 1.5px solid color-mix(in srgb, var(--rpg-accent) 70%, transparent));background:var(--rpg-panel);border-radius:var(--rpg-panel-radius, 16px);overflow:hidden;box-shadow:var(--rpg-panel-shadow, 0 16px 44px rgba(0,0,0,.32)), 0 0 0 1px color-mix(in srgb, var(--rpg-accent) 12%, transparent);position:relative;z-index:2;display:flex;flex-direction:column;}
.rpg-vn-portrait{height:clamp(260px, 50vh, 560px);width:100%;overflow:hidden;background:var(--rpg-panel-2);position:relative;}
.rpg-vn-portrait-img{width:100%;height:100%;object-fit:cover;object-position:center 15%;display:block;}
.rpg-vn-portrait-fallback{width:100%;height:100%;display:flex;align-items:center;justify-content:center;position:relative;background:radial-gradient(120% 90% at 50% 15%, color-mix(in srgb, var(--rpg-accent) 22%, transparent) 0%, transparent 60%),radial-gradient(140% 100% at 85% 100%, color-mix(in srgb, var(--rpg-accent2) 18%, transparent) 0%, transparent 55%),linear-gradient(160deg, color-mix(in srgb, var(--rpg-panel-2) 88%, transparent) 0%, var(--rpg-bg) 100%);}
.rpg-vn-portrait-fallback::before{content:'';position:absolute;inset:0;pointer-events:none;background-image:repeating-linear-gradient(135deg, color-mix(in srgb, var(--rpg-accent) 6%, transparent) 0px, transparent 1px, transparent 26px, color-mix(in srgb, var(--rpg-accent) 6%, transparent) 27px);}
[data-bg-pattern="plain"] .rpg-vn-portrait-fallback::before{background-image:none;}
[data-bg-pattern="dots"] .rpg-vn-portrait-fallback::before{background-image:radial-gradient(color-mix(in srgb, var(--rpg-accent) 20%, transparent) 1.6px, transparent 1.6px);background-size:18px 18px;}
[data-bg-pattern="glow"] .rpg-vn-portrait-fallback::before{background-image:none;box-shadow:inset 0 0 120px color-mix(in srgb, var(--rpg-accent2) 25%, transparent);}
.rpg-vn-monogram{font-family:var(--rpg-font);font-size:clamp(64px, 14vw, 132px);font-weight:700;color:color-mix(in srgb, var(--rpg-accent) 55%, var(--rpg-text));opacity:.28;line-height:1;user-select:none;text-shadow:0 0 40px color-mix(in srgb, var(--rpg-accent) 40%, transparent);}
.rpg-vn-speaker-scrim{position:absolute;left:0;right:0;bottom:0;padding:28px 16px 12px;background:linear-gradient(to top, rgba(0,0,0,.72) 0%, transparent 100%);display:flex;}
.rpg-vn-speaker-tag{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:4px 12px;border-radius:999px;background:color-mix(in srgb, var(--rpg-accent2) 85%, transparent);color:#fff;box-shadow:0 2px 10px rgba(0,0,0,.35);}
.rpg-vn-dialogue{padding:16px 18px;border-top:1px solid color-mix(in srgb, var(--rpg-accent) 25%, transparent);background:color-mix(in srgb, var(--rpg-panel) 92%, transparent);display:flex;flex-direction:column;gap:8px;}
.rpg-vn-text{font-family:var(--rpg-font);font-size:1.02rem;line-height:1.75;white-space:pre-wrap;color:var(--rpg-text);min-height:64px;max-height:32vh;overflow-y:auto;padding-right:2px;}
.rpg-vn-skip{align-self:flex-start;font-size:11px;padding:4px 10px;border-radius:8px;border:1px solid var(--rpg-border);color:var(--rpg-muted);background:transparent;cursor:pointer;font-family:var(--rpg-font);}
.rpg-vn-skip:hover{color:var(--rpg-text);}
.rpg-vn-choices{padding:14px 18px 18px;border-top:1px solid color-mix(in srgb, var(--rpg-accent) 18%, transparent);background:color-mix(in srgb, var(--rpg-panel-2) 55%, transparent);display:flex;flex-direction:column;gap:10px;}
.rpg-vn-choice{text-align:left;border-radius:var(--rpg-btn-radius, 12px);padding:12px 16px;font-size:14px;background:var(--rpg-panel-2);color:var(--rpg-text);border:1px solid color-mix(in srgb, var(--rpg-accent) 35%, transparent);cursor:pointer;font-family:var(--rpg-font);transition:transform .15s ease, box-shadow .15s ease, background .15s ease;}
.rpg-vn-choice:not(:disabled):hover{transform:translateY(-2px);box-shadow:0 0 16px color-mix(in srgb, var(--rpg-accent) 55%, transparent);background:color-mix(in srgb, var(--rpg-accent) 16%, var(--rpg-panel-2));}
.rpg-vn-choice:disabled{opacity:.55;cursor:not-allowed;border-style:dashed;color:var(--rpg-muted);}
.rpg-vn-choice-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.rpg-vn-choice-label{font-size:10px;font-weight:700;padding:2px 6px;border-radius:6px;}
.rpg-vn-choice-dice{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;padding:2px 6px;border-radius:6px;background:#a855f722;color:#c084fc;}
.rpg-vn-choice-reason{font-size:11px;margin-top:4px;color:var(--rpg-muted);}
.rpg-vn-empty{font-size:12px;font-style:italic;color:var(--rpg-muted);}
.rpg-lock{font-size:13px;}
body.rpg-adventure .rpg-vn-choice{border-radius:10px;border-left:3px solid var(--rpg-accent);text-transform:uppercase;letter-spacing:.06em;font-size:12px;}
body.rpg-transmigration .rpg-vn-frame{background-image:linear-gradient(rgba(78,45,58,.1) 1px,transparent 1px);background-size:100% 28px;}
body.rpg-transmigration .rpg-vn-choice::before{content:'章';margin-right:8px;color:var(--rpg-accent);}
body.rpg-system .rpg-vn-choice{border-radius:5px;box-shadow:inset 3px 0 var(--rpg-accent);}
body.rpg-system .rpg-vn-frame{border-radius:6px;}
body.rpg-detective .rpg-vn-choice{border-radius:2px;border-style:dashed;font-family:ui-monospace,monospace;}
body.rpg-detective .rpg-vn-choice::before{content:'EVIDENCE / ';color:var(--rpg-accent);font-size:9px;letter-spacing:.1em;}
body.rpg-detective{background-image:radial-gradient(circle at 20% 20%,color-mix(in srgb,var(--rpg-accent) 10%,transparent),transparent 35%);}
.rpg-ending{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;gap:16px;background:color-mix(in srgb,var(--rpg-panel) 75%,transparent);backdrop-filter:blur(12px);border:2px solid var(--rpg-accent);border-radius:18px;padding:32px;margin:auto;max-width:560px;text-align:center;box-shadow:0 0 24px var(--rpg-accent)22,0 16px 50px rgba(0,0,0,0.6);}
.rpg-ending-badge{font-size:24px;font-weight:bold;padding:8px 20px;border-radius:999px;border:2px solid var(--rpg-border);}
.rpg-ending-badge.true_end{background:#ffd700;color:#3a2817;border-color:#b8860b;}
.rpg-ending-badge.good_end{background:#39d14a;color:#fff;border-color:#1e7a2c;}
.rpg-ending-badge.normal_end{background:#00bcd4;color:#fff;border-color:#00798a;}
.rpg-ending-badge.bad_end{background:#ff4d4d;color:#fff;border-color:#8b0000;}
.rpg-ending-text{font-size:17px;line-height:1.7;}
.rpg-summary{width:100%;text-align:left;background:var(--rpg-panel-2);border-radius:10px;padding:14px;border:1px solid var(--rpg-border);}
.rpg-sum-title{font-weight:bold;margin-bottom:8px;color:var(--rpg-accent2);}
.rpg-sum-row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed var(--rpg-border);font-size:14px;}
.rpg-sum-row:last-child{border-bottom:none;}
.rpg-restart{background:var(--rpg-accent);color:var(--rpg-panel);border:2px solid var(--rpg-border);border-radius:10px;padding:12px 24px;cursor:pointer;font-family:var(--rpg-font);font-size:16px;font-weight:bold;}
.rpg-restart:hover{filter:brightness(1.1);transform:translateY(-1px);}
.rpg-error{color:#ff4d4d;padding:40px;text-align:center;}
#rpg-events{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom, 0px) + 12px);z-index:50;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none;width:calc(100% - 24px);max-width:380px;}
.rpg-toast{background:var(--rpg-accent);color:var(--rpg-panel);border:1px solid var(--rpg-border);border-radius:8px;padding:8px 14px;font-size:12px;font-weight:medium;box-shadow:0 4px 14px rgba(0,0,0,0.3);animation:rpgslide .3s ease;width:100%;text-align:center;}
@keyframes rpgslide{from{transform:translateY(20px);opacity:0;}to{transform:translateY(0);opacity:1;}}
.rpg-shake{animation:rpgShake 0.5s cubic-bezier(.36,.07,.19,.97) both;}
@keyframes rpgShake{10%,90%{transform:translateX(-2px);}20%,80%{transform:translateX(4px);}30%,50%,70%{transform:translateX(-8px);}40%,60%{transform:translateX(8px);}}
#rpg-syspopup{position:fixed;inset:0;z-index:60;display:none;}
.rpg-sys-overlay{position:absolute;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;padding:16px;}
.rpg-sys-box{max-width:360px;width:100%;border-radius:14px;padding:22px;text-align:center;background:var(--rpg-panel);border:2px solid var(--rpg-accent);box-shadow:0 0 24px color-mix(in srgb,var(--rpg-accent) 30%,transparent), inset 0 0 20px color-mix(in srgb,var(--rpg-accent2) 15%,transparent);position:relative;}
.rpg-sys-title{color:var(--rpg-accent);font-weight:bold;letter-spacing:2px;font-size:13px;text-transform:uppercase;margin-bottom:10px;}
.rpg-sys-icon{color:var(--rpg-accent);}
.rpg-sys-text{color:var(--rpg-text);font-size:14px;line-height:1.6;margin-bottom:18px;}
.rpg-sys-btn{background:var(--rpg-accent);color:var(--rpg-panel);border:none;border-radius:8px;padding:8px 20px;font-weight:bold;cursor:pointer;}
.rpg-sys-btn:hover{filter:brightness(1.1);}
.rpg-dice-overlay{position:absolute;inset:0;background:rgba(0,0,0,0.78);display:flex;align-items:center;justify-content:center;padding:16px;}
.rpg-dice-box{max-width:320px;width:100%;border-radius:14px;padding:22px;text-align:center;background:linear-gradient(135deg,#0a0a1f,#1a0a2e);border:2px solid #a855f7;box-shadow:0 0 30px #a855f766;}
.rpg-dice-stat{font-size:11px;color:#c084fc;margin-bottom:10px;}
.rpg-dice{width:72px;height:72px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:38px;font-weight:900;font-family:ui-monospace,monospace;margin:14px auto;background:#a855f722;border:2px solid #a855f7;box-shadow:0 0 20px #a855f766;}
.rpg-dice.win{background:#39d14a22;border-color:#39d14a;box-shadow:0 0 20px #39d14a66;}
.rpg-dice.lose{background:#ff4d4d22;border-color:#ff4d4d;box-shadow:0 0 20px #ff4d4d66;}
.rpg-dice-hint{font-size:13px;color:#f0f0f0;min-height:60px;}
.rpg-dice-res{font-size:16px;font-weight:bold;margin:8px 0;}
.rpg-combat{position:relative;z-index:2;display:flex;flex-direction:column;gap:10px;flex:1;background:color-mix(in srgb,var(--rpg-panel) 78%,transparent);border:2px solid #ef4444;border-radius:16px;padding:20px;box-shadow:0 0 22px #ef444444;}
.rpg-combat-tag{align-self:flex-start;font-size:12px;font-weight:bold;color:#ef4444;background:#ef444422;border:1px solid #ef444466;padding:4px 12px;border-radius:999px;text-transform:uppercase;letter-spacing:1px;}
.rpg-combat-enemy{display:flex;gap:12px;align-items:center;background:color-mix(in srgb,var(--rpg-panel-2) 80%,transparent);border:1px solid var(--rpg-border);border-radius:12px;padding:12px;}
.rpg-combat-avatar{width:56px;height:56px;border-radius:10px;border:2px solid #ef4444;object-fit:cover;box-shadow:0 0 10px #ef444466;}
.rpg-combat-enemyinfo{flex:1;min-width:0;}
.rpg-combat-name{font-weight:bold;font-size:15px;}
.rpg-combat-intro{font-size:11px;color:var(--rpg-muted);font-style:italic;margin-top:4px;}
.rpg-hpbar{flex:1;height:14px;border-radius:999px;overflow:hidden;background:var(--rpg-panel);border:1px solid var(--rpg-border);margin:6px 0;}
.rpg-hpfill{height:100%;background:linear-gradient(90deg,#ef4444,#f87171);border-radius:999px;transition:width .3s;}
.rpg-hpnum{font-size:11px;font-family:ui-monospace,monospace;font-weight:bold;color:#f87171;}
.rpg-combat-player{background:color-mix(in srgb,var(--rpg-panel-2) 80%,transparent);border:1px solid var(--rpg-border);border-radius:10px;padding:8px 12px;}
.rpg-mpbar-wrap{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:bold;margin:3px 0;}
.rpg-mpbar{flex:1;height:10px;border-radius:999px;overflow:hidden;background:var(--rpg-panel);border:1px solid var(--rpg-border);}
.rpg-mpfill{height:100%;background:#3b82f6;border-radius:999px;transition:width .3s;}
.rpg-combat-log{flex:1;min-height:90px;max-height:140px;overflow-y:auto;background:color-mix(in srgb,var(--rpg-panel) 92%,transparent);border:1px solid var(--rpg-border);border-radius:10px;padding:10px;font-size:12px;display:flex;flex-direction:column;gap:3px;}
.rpg-clog{color:var(--rpg-text);}
.rpg-clog-crit{color:#fde047;font-weight:bold;}
.rpg-clog-player{color:#86efac;}
.rpg-clog-enemy{color:#fca5a5;}
.rpg-clog-skill{color:#c4b5fd;}
.rpg-clog-defend{color:#7dd3fc;}
.rpg-clog-win{color:#39d14a;font-weight:bold;}
.rpg-clog-lose{color:#ff4d4d;font-weight:bold;}
.rpg-clog-warn{color:#fbbf24;}
.rpg-clog-hint{text-align:center;font-size:11px;color:var(--rpg-muted);animation:rpgpulse 1s infinite;}
@keyframes rpgpulse{50%{opacity:0.5;}}
.rpg-combat-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.rpg-cbtn{padding:10px;border-radius:10px;border:1px solid var(--rpg-border);cursor:pointer;font-family:var(--rpg-font);font-size:13px;font-weight:bold;color:#fff;}
.rpg-cbtn.red{background:#dc2626;}.rpg-cbtn.sky{background:#0284c7;}.rpg-cbtn.violet{background:#7c3aed;}.rpg-cbtn.outline{background:transparent;color:var(--rpg-text);border:1px solid var(--rpg-border);}
.rpg-cbtn:hover{filter:brightness(1.15);}
.rpg-cbtn:disabled{opacity:0.5;cursor:not-allowed;}
.rpg-combat-over{text-align:center;font-size:18px;font-weight:bold;color:#39d14a;display:flex;flex-direction:column;align-items:center;gap:12px;}
@media(max-width:640px){ .rpg-statusbar{flex-direction:column;align-items:stretch;} .rpg-savebtns{justify-content:center;} .rpg-vn-portrait{height:clamp(150px, 28vh, 300px);} .rpg-vn-monogram{font-size:clamp(40px, 16vw, 80px);} .rpg-vn-text{max-height:22vh;} }
`;

export function generateStandaloneHTML(gameData) {
  const json = JSON.stringify(gameData).replace(/<\/script/gi, '<\\/script');
  const themesJson = JSON.stringify(themesForExport());
  const fontFamiliesJson = JSON.stringify(fontFamiliesForExport());
  const btnShapesJson = JSON.stringify(BUTTON_SHAPES);
  const panelShapesJson = JSON.stringify(PANEL_SHAPES);
  const title = escHtml((gameData.meta && gameData.meta.title) || 'RPG Game');
  const usesCustomTheme = gameData.meta && gameData.meta.theme === 'custom';
  const engine = ENGINE_JS
    .replace('THEMES_MAP', themesJson)
    .replace('FONT_FAMILIES_MAP', fontFamiliesJson)
    .replace('BTN_SHAPES_MAP', btnShapesJson)
    .replace('PANEL_SHAPES_MAP', panelShapesJson);
  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
${usesCustomTheme ? '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Noto+Serif:wght@400;600;700&family=Quicksand:wght@400;500;600;700&family=Playfair+Display:wght@400;600;700&display=swap">' : ''}
<style>
${ENGINE_CSS}
</style>
</head>
<body>
<div id="rpg-events"></div>
<div id="rpg-syspopup"></div>
<div id="game"></div>
<script>
var GAME_DATA = ${json};
${engine}
</script>
</body>
</html>`;
}

export function generateIframeCode(gameData) {
  const html = generateStandaloneHTML(gameData);
  const srcdoc = html.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return `<iframe srcdoc="${srcdoc}" width="100%" height="700" style="border:0;border-radius:12px;" loading="lazy" allowfullscreen></iframe>`;
}