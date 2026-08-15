import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Save, FolderOpen, RotateCcw, Lock, X, Sparkles, Heart, Droplet, Coins, Star, Brain, Flame, Book, Circle, Zap, Gem, Package, ScrollText, Gift, Skull, GitBranch, Dices } from 'lucide-react';
import { THEMES, ENDING_TYPES, CHOICE_LABELS, statStyle, dicebearAvatar } from '@/lib/gameStudio/rpgThemes';
import DiceRollOverlay, { applyDiceResult } from '@/components/game-studio/player/DiceRollOverlay';
import CombatScreen from '@/components/game-studio/player/CombatScreen';

const STAT_ICONS = { heart: Heart, droplet: Droplet, coins: Coins, star: Star, brain: Brain, flame: Flame, book: Book, circle: Circle };

export default function GamePlayer({ gameData }) {
  const meta = gameData.meta;
  const archetype = meta.archetype || 'none';
  const statsConfig = meta.statsConfig || [];
  const theme = THEMES[meta.theme] || THEMES['fantasy-parchment'];
  const litrpg = meta.litrpg || { ranks: ['Luyện Khí', 'Trúc Cơ', 'Kim Đan', 'Nguyên Anh'], expPerRank: 100 };
  const mysterySlots = (meta.mystery && meta.mystery.inventorySlots) || 4;

  const [rt, setRt] = useState(() => ({
    nodeId: 'start_node',
    stats: { ...meta.initialStats },
    history: [],
    inventory: [],
    quests: {},
    flags: [],
    skills: [],
    exp: 0,
    rankIndex: 0,
    systemPoints: 0,
    npcAffinity: {},
  }));
  const [screen, setScreen] = useState('scene');
  const [typed, setTyped] = useState('');
  const [typingDone, setTypingDone] = useState(false);
  const [activeTab, setActiveTab] = useState('stats');
  const [systemPopup, setSystemPopup] = useState(null);
  const [events, setEvents] = useState([]);
  const [forceKey, setForceKey] = useState(0);
  const [shake, setShake] = useState(false);
  const [dicePending, setDicePending] = useState(null);
  const [combatActive, setCombatActive] = useState(false);
  const typingRef = useRef(null);
  const fullTextRef = useRef('');
  const rtRef = useRef(rt);
  rtRef.current = rt;

  const node = gameData.nodes[rt.nodeId] || gameData.nodes['start_node'];
  const SAVE_KEY = 'rpg_play_' + (meta.title || 'game').replace(/[^a-z0-9]/gi, '_');

  const playTing = useCallback(() => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;
      const notes = [{ f: 880, t: 0, d: 0.18 }, { f: 1320, t: 0.12, d: 0.4 }];
      for (const n of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = n.f;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.0001, now + n.t);
        gain.gain.exponentialRampToValueAtTime(0.25, now + n.t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.d);
        osc.start(now + n.t);
        osc.stop(now + n.t + n.d);
      }
    } catch (e) {}
  }, []);

  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 520);
  }, []);

  const checkGameOver = useCallback((s) => {
    for (const sc of statsConfig) if (sc.isVital && (s[sc.key] || 0) <= 0) return true;
    return false;
  }, [statsConfig]);

  const startTypewriter = useCallback((text) => {
    if (typingRef.current) clearInterval(typingRef.current);
    fullTextRef.current = text || '';
    setTyped('');
    setTypingDone(false);
    let i = 0;
    typingRef.current = setInterval(() => {
      i++;
      setTyped(fullTextRef.current.slice(0, i));
      if (i >= fullTextRef.current.length) {
        clearInterval(typingRef.current);
        typingRef.current = null;
        setTypingDone(true);
      }
    }, 18);
  }, []);

  const pushEvent = useCallback((icon, text) => {
    const id = Date.now() + Math.random();
    setEvents((prev) => [...prev, { id, icon, text }]);
    setTimeout(() => setEvents((prev) => prev.filter((e) => e.id !== id)), 3800);
  }, []);

  // Node entry effect
  useEffect(() => {
    const cur = rtRef.current;
    const n = gameData.nodes[cur.nodeId];
    if (!n) return;
    if (checkGameOver(cur.stats)) { setScreen('gameover'); triggerShake(); return; }
    if (n.isEnding) {
      setScreen('ending');
      if (n.endingType === 'BAD_END') triggerShake();
      return;
    }
    setScreen('scene');
    if (n.combat && n.combat.enemy) { setCombatActive(true); } else { setCombatActive(false); }

    let inv = [...cur.inventory];
    let flags = [...cur.flags];
    let quests = { ...cur.quests };
    let ns = { ...cur.stats };
    // Random events — roll on entry
    if (n.randomEvents && n.randomEvents.length) {
      for (const ev of n.randomEvents) {
        if (Math.random() < (ev.chance || 0.2)) {
          if (ev.statModifiers) for (const k in ev.statModifiers) ns[k] = (ns[k] || 0) + ev.statModifiers[k];
          if (ev.grantItem && !inv.includes(ev.grantItem) && inv.length < mysterySlots) { inv.push(ev.grantItem); }
          pushEvent(ev.icon || '•', ev.text || 'Sự kiện bất ngờ!');
        }
      }
    }
    if (n.systemPopup && n.systemPopup.title) { setSystemPopup(n.systemPopup); playTing(); }
    if (n.grantItem && !inv.includes(n.grantItem) && inv.length < mysterySlots) {
      inv.push(n.grantItem);
      pushEvent('•', 'Nhặt được: ' + n.grantItem);
    }
    if (n.setFlags) {
      for (const f of n.setFlags) {
        if (!flags.includes(f)) { flags.push(f); pushEvent('•', 'Kích hoạt hiệu ứng Cánh bướm: ' + f); }
      }
    }
    if (n.quest && n.quest.id && !quests[n.quest.id]) {
      quests[n.quest.id] = { ...n.quest, status: 'active' };
      pushEvent('•', 'Nhiệm vụ mới: ' + n.quest.title);
    }
    setRt((prev) => ({ ...prev, stats: ns, inventory: inv, flags, quests }));
    startTypewriter(n.text);
    return () => { if (typingRef.current) clearInterval(typingRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rt.nodeId, forceKey]);

  const skipTyping = () => {
    if (typingRef.current) { clearInterval(typingRef.current); typingRef.current = null; }
    setTyped(fullTextRef.current);
    setTypingDone(true);
  };

  const meetsStatReq = (req, s) => {
    if (!req) return true;
    for (const k in req) if ((s[k] || 0) < req[k]) return false;
    return true;
  };

  const choiceStatus = (c) => {
    if (!meetsStatReq(c.statRequirements, rt.stats)) {
      const parts = [];
      for (const k in (c.statRequirements || {})) {
        const lbl = statsConfig.find((s) => s.key === k)?.label || k;
        parts.push(`${lbl} ≥ ${c.statRequirements[k]} (cần ${c.statRequirements[k] - (rt.stats[k] || 0)})`);
      }
      return { ok: false, reason: parts.join(', ') };
    }
    if (c.requiresItem && !rt.inventory.includes(c.requiresItem)) {
      return { ok: false, reason: 'Cần vật phẩm: ' + c.requiresItem };
    }
    if (c.requiresFlag && !rt.flags.includes(c.requiresFlag)) {
      return { ok: false, reason: 'Cần cờ: ' + c.requiresFlag };
    }
    return { ok: true };
  };

  const choose = (c) => {
    const st = choiceStatus(c);
    if (!st.ok) return;
    // Dice roll choice — defer to overlay
    if (c.diceRoll) { setDicePending({ choice: c }); return; }

    const ns = { ...rt.stats };
    for (const k in (c.statModifiers || {})) ns[k] = (ns[k] || 0) + c.statModifiers[k];
    const ev = [];
    // Thông báo hệ quả SAU khi đã chọn — cố ý không hiện trước để không lộ kết quả.
    for (const k in (c.statModifiers || {})) {
      const v = c.statModifiers[k];
      const sc = statsConfig.find((s) => s.key === k);
      ev.push(['•', `${sc?.label || k} ${v > 0 ? '+' : ''}${v}`]);
    }
    let exp = rt.exp, rankIndex = rt.rankIndex, systemPoints = rt.systemPoints;
    let inventory = [...rt.inventory], flags = [...rt.flags], skills = [...rt.skills];
    let quests = { ...rt.quests }, npcAffinity = { ...rt.npcAffinity };

    if (c.exp) {
      exp = rt.exp + c.exp;
      const ranks = litrpg.ranks || [];
      const per = litrpg.expPerRank || 100;
      while (exp >= per && rankIndex < ranks.length - 1) {
        exp -= per;
        rankIndex++;
        ev.push(['•', 'Đột phá Cảnh giới! Đạt ' + ranks[rankIndex]]);
      }
    }
    if (c.systemPoints) systemPoints = rt.systemPoints + c.systemPoints;
    if (c.grantFlag && !flags.includes(c.grantFlag)) { flags.push(c.grantFlag); ev.push(['•', 'Kích hoạt hiệu ứng Cánh bướm: ' + c.grantFlag]); }
    if (c.grantItem && !inventory.includes(c.grantItem) && inventory.length < mysterySlots) { inventory.push(c.grantItem); ev.push(['•', 'Nhặt được: ' + c.grantItem]); }
    if (c.removeItem) inventory = inventory.filter((x) => x !== c.removeItem);
    if (c.unlockSkill && !skills.includes(c.unlockSkill)) { skills.push(c.unlockSkill); ev.push(['•', 'Mở khóa kỹ năng: ' + c.unlockSkill]); }
    if (c.completeQuestId && quests[c.completeQuestId]) { quests[c.completeQuestId] = { ...quests[c.completeQuestId], status: 'completed' }; ev.push(['•', 'Hoàn thành nhiệm vụ: ' + quests[c.completeQuestId].title]); }
    if (c.npcAffinity) for (const n in c.npcAffinity) npcAffinity[n] = (npcAffinity[n] || 0) + c.npcAffinity[n];

    const dead = checkGameOver(ns);
    const newRt = { ...rt, stats: ns, exp, rankIndex, systemPoints, inventory, flags, skills, quests, npcAffinity };
    if (!dead) {
      newRt.history = [...rt.history, rt.nodeId];
      if (c.targetNodeId && gameData.nodes[c.targetNodeId]) newRt.nodeId = c.targetNodeId;
    }
    setRt(newRt);
    for (const [ic, tx] of ev) pushEvent(ic, tx);
    if (c.systemPopup && c.systemPopup.title) { setSystemPopup(c.systemPopup); playTing(); }
    if (dead) { setScreen('gameover'); triggerShake(); }
  };

  const onDiceDone = (result) => {
    const c = dicePending.choice;
    const { stats: newStats, target } = applyDiceResult(c.diceRoll, result, rt.stats);
    const dead = checkGameOver(newStats);
    const newRt = { ...rt, stats: newStats };
    if (!dead) {
      newRt.history = [...rt.history, rt.nodeId];
      if (target && gameData.nodes[target]) newRt.nodeId = target;
    }
    setRt(newRt);
    setDicePending(null);
    pushEvent('•', result.crit ? (result.outcome === 'success' ? 'CRITICAL thành công!' : 'CRITICAL thất bại!') : (result.outcome === 'success' ? 'Quay trúng!' : 'Quay trượt...'));
    if (dead) { setScreen('gameover'); triggerShake(); }
  };

  const onCombatEnd = ({ result, stats: combatStats }) => {
    const n = gameData.nodes[rt.nodeId] || {};
    const ns = { ...rt.stats, ...combatStats };
    let inv = [...rt.inventory];
    const ev = [];
    let target = null;
    if (result === 'win') {
      const loot = (n.combat && n.combat.loot) || {};
      if (loot.statModifiers) for (const k in loot.statModifiers) ns[k] = (ns[k] || 0) + loot.statModifiers[k];
      if (loot.grantItem && !inv.includes(loot.grantItem) && inv.length < mysterySlots) { inv.push(loot.grantItem); ev.push(['•', 'Nhặt được: ' + loot.grantItem]); }
      if (loot.exp) {
        let exp = rt.exp + loot.exp; let rankIndex = rt.rankIndex;
        const ranks = litrpg.ranks || []; const per = litrpg.expPerRank || 100;
        while (exp >= per && rankIndex < ranks.length - 1) { exp -= per; rankIndex++; ev.push(['•', 'Đột phá! Đạt ' + ranks[rankIndex]]); }
        ns.exp = exp; ns.rankIndex = rankIndex;
      }
      target = n.combat && n.combat.winTarget;
      ev.push(['•', 'Chiến thắng ' + (n.combat?.enemy?.name || 'kẻ thù') + '!']);
    } else if (result === 'flee') {
      target = n.combat && n.combat.fleeTarget;
    } else {
      target = n.combat && n.combat.loseTarget;
    }
    const dead = result === 'lose' || checkGameOver(ns);
    const newRt = { ...rt, stats: ns, inventory: inv };
    if (!dead && target && gameData.nodes[target]) {
      newRt.history = [...rt.history, rt.nodeId];
      newRt.nodeId = target;
    }
    setRt(newRt);
    setCombatActive(false);
    for (const [ic, tx] of ev) pushEvent(ic, tx);
    if (dead) { setScreen('gameover'); triggerShake(); }
  };

  const reset = () => {
    setRt({
      nodeId: 'start_node', stats: { ...meta.initialStats }, history: [],
      inventory: [], quests: {}, flags: [], skills: [], exp: 0, rankIndex: 0, systemPoints: 0, npcAffinity: {},
    });
    setForceKey((k) => k + 1);
    setScreen('scene');
    setCombatActive(false);
    setDicePending(null);
  };
  const save = () => localStorage.setItem(SAVE_KEY, JSON.stringify(rt));
  const load = () => {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (s) { setRt(s); setForceKey((k) => k + 1); }
    } catch (e) {}
  };

  const themeStyle = {};
  for (const k of Object.keys(theme.vars)) themeStyle[k] = theme.vars[k];
  const endingMeta = ENDING_TYPES[node?.endingType];
  const showTabs = archetype !== 'none';
  const showInventoryTab = archetype === 'mystery' || archetype === 'litrpg';
  const showQuestTab = archetype === 'litrpg';
  const rankLabel = litrpg.ranks?.[rt.rankIndex] || '—';
  const expPct = Math.min(100, ((rt.exp / (litrpg.expPerRank || 100)) * 100));

  return (
    <div style={themeStyle} className={`rpg-root rounded-2xl overflow-hidden flex flex-col min-h-[600px] relative neon-border${shake ? ' animate-shake' : ''}`}>
      <div className="absolute inset-0 bg-cover bg-center opacity-25 pointer-events-none" style={{ backgroundImage: `url(${node?.bgImage || ''})` }} />
      <div className="relative z-10 flex flex-col flex-1 p-3 sm:p-4 gap-3" style={{ background: 'color-mix(in srgb, var(--rpg-panel) 10%, transparent)', backdropFilter: 'blur(2px)' }}>
        {/* Status bar */}
        <div className="flex justify-between items-start gap-2 rounded-xl p-2.5 flex-wrap" style={{ background: 'color-mix(in srgb, var(--rpg-panel) 65%, transparent)', border: '1px solid var(--rpg-accent)44', backdropFilter: 'blur(10px)', boxShadow: '0 0 14px var(--rpg-accent)11' }}>
          <div className="flex items-center gap-2.5">
            <img src={meta.playerAvatar || dicebearAvatar(meta.player_name)} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" style={{ border: '2px solid var(--rpg-accent)', boxShadow: '0 0 10px var(--rpg-accent)66' }} />
            <div className="min-w-0">
              <div className="font-bold text-sm truncate" style={{ color: 'var(--rpg-text)' }}>{meta.player_name || 'Người Chơi'}</div>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {statsConfig.map((sc) => {
                  const st = statStyle(sc.key);
                  const Icon = STAT_ICONS[st.icon] || Circle;
                  return (
                    <span key={sc.key} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: st.color + '1f', border: `1px solid ${st.color}66`, color: st.color, boxShadow: `0 0 6px ${st.color}33` }}>
                      <Icon size={11} /> {rt.stats[sc.key] || 0}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={save} title="Lưu tiến trình chơi thử này vào trình duyệt (không phải lưu game)"><Save size={13} className="mr-1" />Lưu tiến trình</Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={load} title="Tải lại tiến trình chơi thử đã lưu"><FolderOpen size={13} className="mr-1" />Tải tiến trình</Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={reset}><RotateCcw size={13} className="mr-1" />Chơi lại</Button>
          </div>
        </div>

        {/* Archetype bars */}
        {archetype === 'litrpg' && (
          <div className="flex items-center gap-3 rounded-lg px-3 py-2 flex-wrap" style={{ background: 'color-mix(in srgb, var(--rpg-panel) 88%, transparent)', border: '1px solid var(--rpg-border)' }}>
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded" style={{ background: 'var(--rpg-accent)', color: 'var(--rpg-panel)' }}><Zap size={11} /> {rankLabel}</span>
            <div className="flex-1 min-w-[120px]">
              <div className="text-[10px] mb-0.5" style={{ color: 'var(--rpg-muted)' }}>EXP: {rt.exp}/{litrpg.expPerRank || 100}</div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--rpg-panel-2)', border: '1px solid var(--rpg-border)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: expPct + '%', background: 'var(--rpg-accent2)' }} />
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--rpg-text)' }}><Gem size={12} /> Điểm HT: <b>{rt.systemPoints}</b></span>
          </div>
        )}

        {/* Tabs */}
        {showTabs && (
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--rpg-border)' }}>
            <div className="flex">
              <TabBtn active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} theme={theme}>Chỉ số</TabBtn>
              {showInventoryTab && <TabBtn active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} theme={theme}><Package size={12} className="inline mr-1 -mt-0.5" />Túi đồ ({rt.inventory.length}/{archetype === 'mystery' ? mysterySlots : '∞'})</TabBtn>}
              {showQuestTab && <TabBtn active={activeTab === 'quests'} onClick={() => setActiveTab('quests')} theme={theme}><ScrollText size={12} className="inline mr-1 -mt-0.5" />Nhiệm vụ ({Object.values(rt.quests).filter((q) => q.status === 'active').length})</TabBtn>}
            </div>
            <div className="p-2.5 text-xs" style={{ background: 'color-mix(in srgb, var(--rpg-panel) 80%, transparent)', color: 'var(--rpg-text)' }}>
              {activeTab === 'stats' && (
                <div className="space-y-1.5">
                  {statsConfig.map((sc) => (
                    <div key={sc.key} className="flex justify-between"><span>{sc.label}</span><b>{rt.stats[sc.key] || 0}</b></div>
                  ))}
                  {archetype === 'isekai' && (
                    <>
                      {rt.flags.length > 0 && (
                        <div className="pt-1.5 border-t" style={{ borderColor: 'var(--rpg-border)' }}>
                          <div className="font-semibold mb-1 flex items-center gap-1" style={{ color: 'var(--rpg-accent2)' }}><GitBranch size={12} /> Story Flags</div>
                          <div className="flex flex-wrap gap-1">{rt.flags.map((f) => <span key={f} className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: 'var(--rpg-panel-2)', border: '1px solid var(--rpg-border)' }}>{f}</span>)}</div>
                        </div>
                      )}
                      {Object.keys(rt.npcAffinity).length > 0 && (
                        <div className="pt-1.5 border-t" style={{ borderColor: 'var(--rpg-border)' }}>
                          <div className="font-semibold mb-1" style={{ color: 'var(--rpg-accent2)' }}>Độ hảo cảm NPC</div>
                          {Object.entries(rt.npcAffinity).map(([n, v]) => (
                            <div key={n} className="flex justify-between"><span>{n}</span><b style={{ color: v >= 0 ? '#39d14a' : '#ff4d4d' }}>{v > 0 ? '+' : ''}{v}</b></div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  {archetype === 'litrpg' && rt.skills.length > 0 && (
                    <div className="pt-1.5 border-t" style={{ borderColor: 'var(--rpg-border)' }}>
                      <div className="font-semibold mb-1 flex items-center gap-1" style={{ color: 'var(--rpg-accent2)' }}><Sparkles size={12} /> Kỹ năng</div>
                      <div className="flex flex-wrap gap-1">{rt.skills.map((s) => <span key={s} className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: 'var(--rpg-panel-2)', border: '1px solid var(--rpg-border)' }}>{s}</span>)}</div>
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'inventory' && (
                <div>
                  {rt.inventory.length === 0 ? <p style={{ color: 'var(--rpg-muted)' }} className="italic">Túi đồ trống.</p> : (
                    <div className="grid grid-cols-2 gap-1.5">
                      {rt.inventory.map((it, i) => (
                        <div key={i} className="px-2 py-1.5 rounded text-center inline-flex items-center justify-center gap-1" style={{ background: 'var(--rpg-panel-2)', border: '1px solid var(--rpg-border)' }}><Package size={12} /> {it}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'quests' && (
                <div>
                  {Object.keys(rt.quests).length === 0 ? <p style={{ color: 'var(--rpg-muted)' }} className="italic">Chưa có nhiệm vụ.</p> : (
                    <div className="space-y-1.5">
                      {Object.values(rt.quests).map((q) => (
                        <div key={q.id} className="rounded p-2" style={{ background: 'var(--rpg-panel-2)', border: '1px solid var(--rpg-border)', opacity: q.status === 'completed' ? 0.6 : 1 }}>
                          <div className="flex justify-between font-semibold">
                            <span>{q.status === 'completed' ? '✓' : '•'} {q.title}</span>
                            <span className="text-[10px]" style={{ color: q.status === 'completed' ? '#39d14a' : 'var(--rpg-accent2)' }}>{q.status === 'completed' ? 'Hoàn thành' : 'Đang làm'}</span>
                          </div>
                          {q.desc && <p className="text-[11px] mt-0.5" style={{ color: 'var(--rpg-muted)' }}>{q.desc}</p>}
                          {q.reward && <p className="text-[11px] mt-0.5 flex items-center gap-1"><Gift size={11} /> {q.reward}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Combat */}
        {screen === 'scene' && combatActive && node?.combat && (
          <CombatScreen combat={node.combat} rt={rt} statsConfig={statsConfig} rankIndex={rt.rankIndex} onEnd={onCombatEnd} themeStyle={themeStyle} pushEvent={pushEvent} />
        )}
        {/* Scene */}
        {screen === 'scene' && node && !combatActive && (
          <div className="flex flex-col flex-1 gap-3 rounded-2xl p-5 relative" style={{ background: 'color-mix(in srgb, var(--rpg-panel) 70%, transparent)', border: '2px solid var(--rpg-accent)', boxShadow: '0 0 18px var(--rpg-accent)22, inset 0 0 30px rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)' }}>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase px-2.5 py-1 rounded-full" style={{ background: 'var(--rpg-accent2)22', color: 'var(--rpg-accent2)', border: '1px solid var(--rpg-accent2)66' }}>{node.speaker}</div>
            </div>
            <div className="text-base leading-relaxed whitespace-pre-wrap min-h-[80px]" style={{ color: 'var(--rpg-text)' }}>{typed}{!typingDone && <span className="animate-pulse">▋</span>}</div>
            {!typingDone && <button onClick={skipTyping} className="self-start text-xs px-2.5 py-1 rounded" style={{ border: '1px solid var(--rpg-border)', color: 'var(--rpg-muted)' }}>Bỏ qua ⏭</button>}
            <div className="flex flex-col gap-2.5 mt-auto">
              {typingDone && (node.choices || []).map((c, i) => {
                const st = choiceStatus(c);
                const lbl = c.label ? CHOICE_LABELS[c.label] : null;
                return (
                  <button key={i} disabled={!st.ok} onClick={() => choose(c)} className="rpg-choice-btn text-left rounded-xl px-4 py-3 text-sm flex flex-col gap-1" style={st.ok ? { background: 'var(--rpg-panel-2)', color: 'var(--rpg-text)', border: '1px solid var(--rpg-accent)55' } : { background: 'transparent', color: 'var(--rpg-muted)', border: '2px dashed var(--rpg-border)', opacity: 0.6, cursor: 'not-allowed' }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      {!st.ok && <Lock size={14} className="shrink-0" />}
                      {lbl && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0" style={{ background: lbl.color + '22', color: lbl.color }}>[{lbl.text}]</span>}
                      {c.diceRoll && <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0" style={{ background: '#a855f722', color: '#c084fc' }}><Dices size={11} /> {statsConfig.find((s) => s.key === c.diceRoll.stat)?.label || c.diceRoll.stat || 'May rủi'} ≥{c.diceRoll.difficulty}</span>}
                      <span className="min-w-0 break-words">{c.text}</span>
                    </div>
                    {!st.ok && <div className="text-[11px] mt-0.5">🔒 {st.reason}</div>}
                  </button>
                );
              })}
              {typingDone && (node.choices || []).length === 0 && <p className="text-xs italic" style={{ color: 'var(--rpg-muted)' }}>Không có lựa chọn tiếp theo. Hãy thêm lựa chọn trong Studio.</p>}
            </div>
          </div>
        )}

        {/* Game Over */}
        {screen === 'gameover' && (
          <div className="flex flex-col items-center gap-4 rounded-2xl p-8 m-auto max-w-md text-center" style={{ background: 'color-mix(in srgb, var(--rpg-panel) 92%, transparent)', border: '3px solid var(--rpg-border)' }}>
            <div className="inline-flex items-center gap-2 text-2xl font-bold px-5 py-2 rounded-full" style={{ background: '#ff4d4d', color: '#fff', border: '2px solid var(--rpg-border)' }}><Skull size={22} /> GAME OVER</div>
            <p className="text-base" style={{ color: 'var(--rpg-text)' }}>Bạn đã gục ngã. Số phận đã khép lại quá sớm...</p>
            <Summary statsConfig={statsConfig} rt={rt} />
            <Button onClick={reset} style={{ background: 'var(--rpg-accent)', color: 'var(--rpg-panel)' }}><RotateCcw size={15} className="mr-1.5" />Bắt đầu lại</Button>
          </div>
        )}

        {/* Ending */}
        {screen === 'ending' && node && (
          <div className="flex flex-col items-center gap-4 rounded-2xl p-8 m-auto max-w-md text-center" style={{ background: 'color-mix(in srgb, var(--rpg-panel) 92%, transparent)', border: '3px solid var(--rpg-border)' }}>
            <div className="text-xl font-bold px-5 py-2 rounded-full" style={{ background: endingMeta?.color || '#888', color: '#fff', border: '2px solid var(--rpg-border)' }}>{endingMeta?.icon} {endingMeta?.label || 'Kết Thúc'}</div>
            <p className="text-base leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--rpg-text)' }}>{node.text}</p>
            <Summary statsConfig={statsConfig} rt={rt} />
            <Button onClick={reset} style={{ background: 'var(--rpg-accent)', color: 'var(--rpg-panel)' }}><RotateCcw size={15} className="mr-1.5" />Chơi lại từ đầu</Button>
          </div>
        )}
      </div>

      {/* Dice Roll overlay */}
      {dicePending && (
        <DiceRollOverlay diceRoll={dicePending.choice.diceRoll} stats={rt.stats} statLabel={statsConfig.find((s) => s.key === dicePending.choice.diceRoll.stat)?.label || dicePending.choice.diceRoll.stat} onDone={onDiceDone} />
      )}

      {/* System Popup modal */}
      {systemPopup && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setSystemPopup(null)}>
          <div className="max-w-sm w-full rounded-xl p-5 text-center relative" style={{ background: 'var(--rpg-panel)', border: '2px solid var(--rpg-accent)', boxShadow: '0 0 24px color-mix(in srgb, var(--rpg-accent) 30%, transparent), inset 0 0 20px color-mix(in srgb, var(--rpg-accent2) 15%, transparent)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles size={18} style={{ color: 'var(--rpg-accent)' }} />
              <span className="font-bold tracking-widest text-sm uppercase" style={{ color: 'var(--rpg-accent)' }}>{systemPopup.title || 'Hệ Thống'}</span>
            </div>
            <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--rpg-text)' }}>{systemPopup.text}</p>
            <Button size="sm" onClick={() => setSystemPopup(null)} style={{ background: 'var(--rpg-accent)', color: 'var(--rpg-panel)' }}>Đã hiểu</Button>
            <button className="absolute top-2 right-2 opacity-60 hover:opacity-100" style={{ color: 'var(--rpg-accent)' }} onClick={() => setSystemPopup(null)}><X size={16} /></button>
          </div>
        </div>
      )}

      {/* Event toasts */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-2 pointer-events-none">
        {events.map((e) => (
          <div key={e.id} className="rounded-lg px-3 py-2 text-xs font-medium shadow-lg animate-in slide-in-from-right" style={{ background: 'color-mix(in srgb, var(--rpg-accent) 90%, transparent)', color: 'var(--rpg-panel)', border: '1px solid var(--rpg-border)' }}>
            {e.icon} {e.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, theme, children }) {
  return (
    <button onClick={onClick} className="flex-1 px-3 py-1.5 text-xs font-medium transition" style={active ? { background: 'var(--rpg-accent)', color: 'var(--rpg-panel)' } : { background: 'var(--rpg-panel-2)', color: 'var(--rpg-muted)' }}>
      {children}
    </button>
  );
}

function Summary({ statsConfig, rt }) {
  return (
    <div className="w-full text-left rounded-lg p-3" style={{ background: 'var(--rpg-panel-2)', border: '1px solid var(--rpg-border)' }}>
      <div className="font-bold text-sm mb-2" style={{ color: 'var(--rpg-accent2)' }}>Thành tích</div>
      {statsConfig.map((sc) => (
        <div key={sc.key} className="flex justify-between text-sm py-1" style={{ borderBottom: '1px dashed var(--rpg-border)', color: 'var(--rpg-text)' }}>
          <span>{sc.label}</span><b>{rt.stats[sc.key] || 0}</b>
        </div>
      ))}
      <div className="flex justify-between text-sm py-1" style={{ color: 'var(--rpg-text)' }}><span>Số phân cảnh đã qua</span><b>{rt.history.length}</b></div>
    </div>
  );
}