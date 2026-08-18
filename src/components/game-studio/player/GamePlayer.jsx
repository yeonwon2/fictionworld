import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Menu, X, Sparkles, Heart, Droplet, Coins, Star, Brain, Flame, Book, Circle, Zap, Gem, Package, ScrollText, Gift, Skull, GitBranch, Dices, Lock, User, History, LogOut, RotateCcw, ArrowLeft, ChevronDown, Crown } from 'lucide-react';
import { THEMES, PRESENTATION_ART, ENDING_TYPES, CHOICE_LABELS, statStyle, dicebearAvatar, customThemeStyle, GAME_PRESENTATIONS } from '@/lib/gameStudio/rpgThemes';
import { palaceRankIndex, palaceProgressToNext } from '@/lib/gameStudio/palaceScriptParser';
import { rebirthEraIndex, rebirthEraProgress, rebirthUnclaimedBonus } from '@/lib/gameStudio/rebirthScriptParser';
import DiceRollOverlay, { applyDiceResult } from '@/components/game-studio/player/DiceRollOverlay';
import CombatScreen from '@/components/game-studio/player/CombatScreen';

const STAT_ICONS = { heart: Heart, droplet: Droplet, coins: Coins, star: Star, brain: Brain, flame: Flame, book: Book, circle: Circle, sparkles: Sparkles, crown: Crown };

export default function GamePlayer({ gameData, onExit }) {
  const meta = gameData.meta;
  const presentation = meta.presentation || 'dialogue';
  const heroineArt = PRESENTATION_ART[presentation] || PRESENTATION_ART.dialogue;
  const posterArt = meta.posterImage || meta.playerAvatar || heroineArt;
  const posterTag = GAME_PRESENTATIONS[presentation]?.name || '';
  const archetype = meta.archetype || 'none';
  const statsConfig = meta.statsConfig || [];
  const theme = THEMES[meta.theme] || THEMES['fantasy-parchment'];
  const litrpg = meta.litrpg || { ranks: ['Luyện Khí', 'Trúc Cơ', 'Kim Đan', 'Nguyên Anh'], expPerRank: 100 };
  const palace = meta.palace || { ranks: [], favorStat: '', favorLabel: '', deathThreshold: 0, stepFavor: 15 };
  const rebirth = meta.rebirth || { moneyStat: '', moneyLabel: 'Vốn', deathThreshold: 0, eras: [], bonusStat: '' };
  const mysterySlots = (meta.mystery && meta.mystery.inventorySlots) || 4;
  // Túi đồ chỉ giới hạn số ô cho archetype "mystery" (cơ chế giải đố cố ý
  // giới hạn) — mọi archetype khác (tức mọi game từ Xưởng Offline/Hệ Thống/
  // NPC, archetype luôn là "none"/"romance") phải nhặt được KHÔNG GIỚI HẠN
  // vật phẩm, đúng như nhãn "∞" đã hiện sẵn trong menu túi đồ.
  const canCarryMore = useCallback((invLen) => archetype !== 'mystery' || invLen < mysterySlots, [archetype, mysterySlots]);
  // Tab "Túi đồ" trước đây chỉ hiện cho archetype "mystery"/"litrpg" — nhưng
  // cả 3 xưởng (Offline/Hệ Thống/NPC) đều có cú pháp "→ Vật phẩm:"/"→ Cần vật
  // phẩm:" mà archetype luôn là "none"/"romance", nên tab bị ẩn dù game có
  // dùng vật phẩm thật, khiến người chơi không thấy mình đang có/thiếu gì.
  const hasItemMechanic = useMemo(() => (
    Object.values(gameData.nodes || {}).some((n) => n.grantItem || (n.choices || []).some((c) => c.grantItem || c.requiresItem))
  ), [gameData.nodes]);

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
    lastChoiceText: null,
    lastDeltas: {},
  }));
  const [screen, setScreen] = useState('scene');
  const [typed, setTyped] = useState('');
  const [typingDone, setTypingDone] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [choicesOpen, setChoicesOpen] = useState(true);
  const [bioOpen, setBioOpen] = useState(false);
  const [systemPopup, setSystemPopup] = useState(null);
  const [events, setEvents] = useState([]);
  const [forceKey, setForceKey] = useState(0);
  const [shake, setShake] = useState(false);
  const [dicePending, setDicePending] = useState(null);
  const [combatActive, setCombatActive] = useState(false);
  const [posterOpen, setPosterOpen] = useState(meta.poster !== false);
  // "Niên đại làm giàu" đã chạm tới (mốc cao nhất từng nhận thưởng) — riêng với
  // mốc đã vượt rồi tụt xuống: niên đại HIỆN TẠI vẫn giữ (max(derived, reached)),
  // nhưng thu nhập chỉ cộng MỘT LẦN mỗi mốc, không bao giờ cộng lại.
  const [eraReached, setEraReached] = useState(() => rebirthEraIndex((meta.initialStats || {})[rebirth.moneyStat] || 0, rebirth));
  const typingRef = useRef(null);
  const fullTextRef = useRef('');
  const rtRef = useRef(rt);
  rtRef.current = rt;
  const eraReachedRef = useRef(eraReached);
  eraReachedRef.current = eraReached;

  const palaceRankIdx = palaceRankIndex(rt.stats[palace.favorStat] || 0, palace);
  const palaceRankLabel = palace.ranks?.[palaceRankIdx] || '—';
  const palaceProgress = palaceProgressToNext(rt.stats[palace.favorStat] || 0, palace, palaceRankIdx);

  // Niên đại làm giàu — niên đại HIỆN TẠI = mốc cao nhất đã từng chạm (giữ vững
  // khi vốn tụt xuống dưới mốc), tiến độ thì theo Vốn thực tại.
  const rebirthMoney = rt.stats[rebirth.moneyStat] || 0;
  const derivedEraIdx = rebirthEraIndex(rebirthMoney, rebirth);
  const eraIdx = Math.max(derivedEraIdx, eraReached);
  const eraLabel = rebirth.eras?.[eraIdx]?.label || '—';
  const eraProgress = rebirthEraProgress(rebirthMoney, rebirth, eraIdx);
  const nextEra = rebirth.eras?.[eraIdx + 1];

  const node = gameData.nodes[rt.nodeId] || gameData.nodes['start_node'];

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
    for (const sc of statsConfig) if (sc.isVital && (s[sc.key] || 0) <= (sc.deathThreshold ?? 0)) return true;
    return false;
  }, [statsConfig]);

  // Cộng thu nhập thời đại MỘT LẦN khi Vốn chạm mốc niên đại mới — gọi SAU khi
  // đã áp mọi cộng/trừ vốn. Thay đổi trực tiếp "stats", bổ sung sự kiện vào
  // "ev", trả về mốc niên đại mới đã đạt (gọi để lưu vào state eraReached).
  const advanceEra = useCallback((stats, reachedVal, ev) => {
    if (archetype !== 'rebirth') return reachedVal;
    const key = rebirth.moneyStat;
    const bkey = rebirth.bonusStat || key;
    const money = stats[key] || 0;
    const newEra = rebirthEraIndex(money, rebirth);
    if (newEra <= reachedVal) return reachedVal;
    const bonus = rebirthUnclaimedBonus(newEra, reachedVal, rebirth);
    if (bonus > 0) {
      stats[bkey] = (stats[bkey] || 0) + bonus;
      ev.push(['◆', `Thu nhập thời đại +${bonus} ${rebirth.moneyLabel}`]);
    }
    ev.push(['✦', 'Bước sang niên đại mới: ' + ((rebirth.eras && rebirth.eras[newEra]?.label) || 'Niên đại mới')]);
    return newEra;
  }, [archetype, rebirth]);

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

  // Node entry effect — khi poster mở đầu còn phủ màn hình thì CHƯA xử lý vào
  // cảnh; phải đợi người chơi bấm "Bắt đầu" (posterOpen = false) thì thông báo
  // hệ thống, sự kiện ngẫu nhiên, nhiệm vụ... mới chạy, không hiện sớm nữa.
  useEffect(() => {
    if (posterOpen) return;
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
          if (ev.grantItem && !inv.includes(ev.grantItem) && canCarryMore(inv.length)) { inv.push(ev.grantItem); }
          pushEvent(ev.icon || '•', ev.text || 'Sự kiện bất ngờ!');
        }
      }
    }
    // Niên đại làm giàu — thu nhập thời đại cộng MỘT LẦN khi Vốn chạm mốc mới.
    {
      const evEra = [];
      const nextEra = advanceEra(ns, eraReachedRef.current, evEra);
      if (nextEra !== eraReachedRef.current) setEraReached(nextEra);
      for (const [ic, tx] of evEra) pushEvent(ic, tx);
    }
    if (n.systemPopup && n.systemPopup.title) { setSystemPopup(n.systemPopup); playTing(); }
    if (n.grantItem && !inv.includes(n.grantItem) && canCarryMore(inv.length)) {
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
    setChoicesOpen(true);
    startTypewriter(n.text);
    return () => { if (typingRef.current) clearInterval(typingRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rt.nodeId, forceKey, posterOpen]);

  const skipTyping = () => {
    if (typingRef.current) { clearInterval(typingRef.current); typingRef.current = null; }
    setTyped(fullTextRef.current);
    setTypingDone(true);
  };

  const meetsStatReq = (req, s, reqMax) => {
    if (!req && !reqMax) return true;
    for (const k in (req || {})) if ((s[k] || 0) < req[k]) return false;
    if (reqMax) for (const k2 in reqMax) if ((s[k2] || 0) > reqMax[k2]) return false;
    return true;
  };

  const choiceStatus = (c) => {
    if (!meetsStatReq(c.statRequirements, rt.stats, c.statRequirementsMax)) {
      const parts = [];
      for (const k in (c.statRequirements || {})) {
        const lbl = statsConfig.find((s) => s.key === k)?.label || k;
        parts.push(`${lbl} ≥ ${c.statRequirements[k]} (cần ${c.statRequirements[k] - (rt.stats[k] || 0)})`);
      }
      for (const k2 in (c.statRequirementsMax || {})) {
        const lbl2 = statsConfig.find((s) => s.key === k2)?.label || k2;
        parts.push(`${lbl2} ≤ ${c.statRequirementsMax[k2]} (đang ${rt.stats[k2] || 0})`);
      }
      return { ok: false, reason: parts.join(', ') };
    }
    if (c.requiresItem && !rt.inventory.includes(c.requiresItem)) {
      return { ok: false, reason: 'Cần vật phẩm: ' + c.requiresItem };
    }
    if (c.requiresFlag && !rt.flags.includes(c.requiresFlag)) {
      return { ok: false, reason: 'Cần cờ: ' + c.requiresFlag };
    }
    if (c.requiresFlagAbsent && rt.flags.includes(c.requiresFlagAbsent)) {
      return { ok: false, reason: 'Chỉ khi chưa có cờ: ' + c.requiresFlagAbsent };
    }
    if (c.requiresNpcAffinity) {
      const reqs = c.requiresNpcAffinity;
      for (const n in reqs) {
        if ((rt.npcAffinity[n] || 0) < reqs[n]) {
          const have = rt.npcAffinity[n] || 0;
          return { ok: false, reason: `Cần hảo cảm ${n} ≥ ${reqs[n]} (đang ${have}, thiếu ${reqs[n] - have})` };
        }
      }
    }
    if (c.requiresNpcAffinityMax) {
      const maxs = c.requiresNpcAffinityMax;
      for (const n in maxs) {
        if ((rt.npcAffinity[n] || 0) > maxs[n]) {
          const have = rt.npcAffinity[n] || 0;
          return { ok: false, reason: `Cần hảo cảm ${n} ≤ ${maxs[n]} (đang ${have})` };
        }
      }
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
    // Hệ quả chỉ số hiện qua badge "Lượt N" ở đầu văn bản (rpg-turn-delta), không
    // cần lặp lại bằng toast nữa — toast chỉ dành cho vật phẩm/cờ truyện/nhiệm vụ.
    const ev = [];
    // Niên đại làm giàu — thu nhập thời đại cộng MỘT LẦN khi Vốn chạm mốc mới.
    let nextEraReached = eraReachedRef.current;
    nextEraReached = advanceEra(ns, nextEraReached, ev);
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
    if (c.grantItem && !inventory.includes(c.grantItem) && canCarryMore(inventory.length)) { inventory.push(c.grantItem); ev.push(['•', 'Nhặt được: ' + c.grantItem]); }
    if (c.removeItem) inventory = inventory.filter((x) => x !== c.removeItem);
    if (c.unlockSkill && !skills.includes(c.unlockSkill)) { skills.push(c.unlockSkill); ev.push(['•', 'Mở khóa kỹ năng: ' + c.unlockSkill]); }
    if (c.completeQuestId && quests[c.completeQuestId]) { quests[c.completeQuestId] = { ...quests[c.completeQuestId], status: 'completed' }; ev.push(['•', 'Hoàn thành nhiệm vụ: ' + quests[c.completeQuestId].title]); }
    if (c.npcAffinity) for (const n in c.npcAffinity) npcAffinity[n] = (npcAffinity[n] || 0) + c.npcAffinity[n];

    const dead = checkGameOver(ns);
    const newRt = { ...rt, stats: ns, exp, rankIndex, systemPoints, inventory, flags, skills, quests, npcAffinity, lastChoiceText: c.text, lastDeltas: { ...(c.statModifiers || {}) } };
    if (!dead) {
      newRt.history = [...rt.history, rt.nodeId];
      if (c.targetNodeId && gameData.nodes[c.targetNodeId]) newRt.nodeId = c.targetNodeId;
    }
    setRt(newRt);
    if (nextEraReached !== eraReachedRef.current) setEraReached(nextEraReached);
    for (const [ic, tx] of ev) pushEvent(ic, tx);
    if (c.systemPopup && c.systemPopup.title) { setSystemPopup(c.systemPopup); playTing(); }
    if (dead) { setScreen('gameover'); triggerShake(); }
  };

  const onDiceDone = (result) => {
    const c = dicePending.choice;
    const { stats: newStats, target, mods } = applyDiceResult(c.diceRoll, result, rt.stats);
    const evEra = [];
    let nextEraReached = eraReachedRef.current;
    nextEraReached = advanceEra(newStats, nextEraReached, evEra);
    const dead = checkGameOver(newStats);
    const newRt = { ...rt, stats: newStats, lastChoiceText: c.text, lastDeltas: { ...mods } };
    if (!dead) {
      newRt.history = [...rt.history, rt.nodeId];
      if (target && gameData.nodes[target]) newRt.nodeId = target;
    }
    setRt(newRt);
    if (nextEraReached !== eraReachedRef.current) setEraReached(nextEraReached);
    setDicePending(null);
    for (const [ic, tx] of evEra) pushEvent(ic, tx);
    pushEvent('•', result.crit ? (result.outcome === 'success' ? 'CRITICAL thành công!' : 'CRITICAL thất bại!') : (result.outcome === 'success' ? 'Quay trúng!' : 'Quay trượt...'));
    if (dead) { setScreen('gameover'); triggerShake(); }
  };

  const onCombatEnd = ({ result, stats: combatStats }) => {
    const n = gameData.nodes[rt.nodeId] || {};
    const ns = { ...rt.stats, ...combatStats };
    let inv = [...rt.inventory];
    const ev = [];
    let nextEraReached = eraReachedRef.current;
    let target = null;
    if (result === 'win') {
      const loot = (n.combat && n.combat.loot) || {};
      if (loot.statModifiers) for (const k in loot.statModifiers) ns[k] = (ns[k] || 0) + loot.statModifiers[k];
      if (loot.grantItem && !inv.includes(loot.grantItem) && canCarryMore(inv.length)) { inv.push(loot.grantItem); ev.push(['•', 'Nhặt được: ' + loot.grantItem]); }
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
    nextEraReached = advanceEra(ns, nextEraReached, ev);
    const dead = result === 'lose' || checkGameOver(ns);
    const newRt = { ...rt, stats: ns, inventory: inv, lastChoiceText: null, lastDeltas: {} };
    if (!dead && target && gameData.nodes[target]) {
      newRt.history = [...rt.history, rt.nodeId];
      newRt.nodeId = target;
    }
    setRt(newRt);
    if (nextEraReached !== eraReachedRef.current) setEraReached(nextEraReached);
    setCombatActive(false);
    for (const [ic, tx] of ev) pushEvent(ic, tx);
    if (dead) { setScreen('gameover'); triggerShake(); }
  };

  const reset = () => {
    setRt({
      nodeId: 'start_node', stats: { ...meta.initialStats }, history: [],
      inventory: [], quests: {}, flags: [], skills: [], exp: 0, rankIndex: 0, systemPoints: 0, npcAffinity: {},
      lastChoiceText: null, lastDeltas: {},
    });
    setEraReached(rebirthEraIndex((meta.initialStats || {})[rebirth.moneyStat] || 0, rebirth));
    setForceKey((k) => k + 1);
    setScreen('scene');
    setCombatActive(false);
    setDicePending(null);
    setSheetOpen(false);
    setChoicesOpen(true);
    setBioOpen(false);
  };
  const themeStyle = meta.theme === 'custom' && meta.customTheme
    ? customThemeStyle(meta.customTheme)
    : { ...theme.vars };
  // Trước đây .rpg-vn-frame là 1 card đặc phủ gần kín khung nên nền của .rpg-root
  // không cần tô — giờ các vùng con đã tách rời, thoáng hơn, nên khung ngoài phải
  // tự tô nền theo theme, nếu không chữ màu sáng (dành cho nền tối) sẽ lộ trên nền
  // trang bên ngoài. Dùng backgroundColor (không phải shorthand background) để
  // không đè mất --rpg-bg-image (theme gradient) hay data-bg-pattern đặt qua CSS.
  const rootStyle = { ...themeStyle, backgroundColor: 'var(--rpg-bg)', color: 'var(--rpg-text)' };
  const endingMeta = ENDING_TYPES[node?.endingType];
  const showInventoryTab = archetype === 'mystery' || archetype === 'litrpg' || archetype === 'rebirth' || hasItemMechanic;
  const showQuestTab = archetype === 'litrpg';
  const rankLabel = litrpg.ranks?.[rt.rankIndex] || '—';
  const expPct = Math.min(100, ((rt.exp / (litrpg.expPerRank || 100)) * 100));
  const turn = rt.history.length + 1;
  const isCustomTheme = meta.theme === 'custom';
  const ambientEffect = isCustomTheme ? (meta.customTheme?.effect || 'none') : (theme.effect || 'none');

  return (
    <div style={rootStyle} data-presentation={presentation} data-bg-pattern={isCustomTheme ? (meta.customTheme?.bgPattern || 'plain') : undefined} data-panel-shape={isCustomTheme ? (meta.customTheme?.panelShape || 'panel') : undefined} className={`rpg-root rpg-${presentation} rounded-2xl overflow-hidden flex flex-col min-h-[600px] relative${shake ? ' animate-shake' : ''}`}>
      <div className={`rpg-effect rpg-effect-${ambientEffect}`} aria-hidden="true" />
      {posterOpen && (
        <div className="rpg-poster" style={{ backgroundImage: `url(${posterArt})` }}>
          <div className={`rpg-effect rpg-effect-${ambientEffect}`} aria-hidden="true" />
          <div className="rpg-poster-shade" />
          <div className="rpg-poster-inner">
            {posterTag && <div className="rpg-poster-badge">{posterTag}</div>}
            <h1 className="rpg-poster-title">{meta.title || 'Trò Chơi'}</h1>
            {meta.player_name && <div className="rpg-poster-sub">{meta.player_name}</div>}
            {meta.player_bio && <p className="rpg-poster-bio">{meta.player_bio}</p>}
            <button className="rpg-poster-btn" onClick={() => setPosterOpen(false)}>Bắt đầu</button>
          </div>
        </div>
      )}
      <div className="relative z-10 flex flex-col flex-1 p-3 sm:p-4 gap-3" style={{ background: 'transparent' }}>
        {/* Thanh trên cùng — nút thoát, avatar, tên game + lượt, điểm hệ thống, menu */}
        <div className="rpg-topbar">
          {onExit && (
            <button className="rpg-topbar-btn" onClick={onExit} title="Quay lại"><ArrowLeft size={16} /></button>
          )}
          <img src={meta.playerAvatar || dicebearAvatar(meta.player_name)} alt="" className="rpg-topbar-avatar" />
          <div className="rpg-topbar-info">
            <div className="rpg-topbar-title">{meta.title || 'Trò Chơi'}</div>
            <div className="rpg-topbar-subtitle">{meta.player_name || 'Người Chơi'} · Lượt {turn}</div>
          </div>
          {archetype === 'litrpg' && (
            <span className="rpg-topbar-points"><Gem size={12} /> {rt.systemPoints}</span>
          )}
          <button className="rpg-topbar-btn" onClick={() => setSheetOpen(true)} title="Menu">
            <Menu size={16} />
          </button>
        </div>

        {/* Hàng chỉ số dạng thanh — icon + số + thanh tiến độ cho từng chỉ số */}
        {statsConfig.length > 0 && (
          <div className="rpg-stats-row">
            {statsConfig.map((sc) => {
              const st = statStyle(sc.key);
              const Icon = STAT_ICONS[st.icon] || Circle;
              const val = rt.stats[sc.key] || 0;
              const max = sc.max || (sc.default > 0 ? sc.default : 100);
              const pct = Math.max(0, Math.min(100, (val / max) * 100));
              return (
                <div key={sc.key} className="rpg-stat-bar">
                  <div className="rpg-stat-bar-top">
                    <Icon size={12} style={{ color: st.color }} />
                    <span className="rpg-stat-bar-label">{sc.label}</span>
                    <span className="rpg-stat-bar-value">{val}</span>
                  </div>
                  <div className="rpg-stat-bar-track">
                    <div className="rpg-stat-bar-fill" style={{ width: pct + '%', background: st.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Chi tiết nhân vật — thu gọn/mở rộng, chỉ hiện khi có tiểu sử */}
        {meta.player_bio && (
          <div>
            <button className={`rpg-detail-toggle${bioOpen ? ' open' : ''}`} onClick={() => setBioOpen((v) => !v)}>
              <span>Chi tiết nhân vật</span>
              <ChevronDown size={14} />
            </button>
            {bioOpen && (
              <div className="rpg-detail-panel">
                <p className="text-xs leading-relaxed" style={{ color: 'var(--rpg-muted)' }}>{meta.player_bio}</p>
              </div>
            )}
          </div>
        )}

        {/* Thanh Cảnh giới/EXP — chỉ archetype Hệ Thống */}
        {archetype === 'litrpg' && (
          <div className="flex items-center gap-3 rounded-xl px-3 py-2 flex-wrap" style={{ background: 'color-mix(in srgb, var(--rpg-panel) 55%, transparent)' }}>
            <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--rpg-accent2)', color: '#fff' }}><Zap size={11} /> {rankLabel}</span>
            <div className="flex-1 min-w-[120px]">
              <div className="text-[10px] mb-0.5" style={{ color: 'var(--rpg-muted)' }}>EXP: {rt.exp}/{litrpg.expPerRank || 100}</div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--rpg-panel-2)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: expPct + '%', background: 'var(--rpg-accent2)' }} />
              </div>
            </div>
          </div>
        )}

        {/* Bảng cấp bậc tần phi + thế lực hậu cung — chỉ archetype Cung Đấu */}
        {archetype === 'palace' && (
          <PalaceCourtBoard palace={palace} palaceRankIdx={palaceRankIdx} palaceRankLabel={palaceRankLabel} palaceProgress={palaceProgress} npcAffinity={rt.npcAffinity} />
        )}

        {/* Bảng gia sản — niên đại làm giàu theo Vốn — chỉ archetype Trọng Sinh */}
        {archetype === 'rebirth' && (
          <RebirthWealthBoard rebirth={rebirth} eraIdx={eraIdx} eraLabel={eraLabel} eraProgress={eraProgress} nextEra={nextEra} assetCount={rt.inventory.length} />
        )}

        {/* Combat */}
        {screen === 'scene' && combatActive && node?.combat && (
          <CombatScreen combat={node.combat} rt={rt} statsConfig={statsConfig} rankIndex={rt.rankIndex} onEnd={onCombatEnd} themeStyle={themeStyle} pushEvent={pushEvent} />
        )}
        {/* Scene */}
        {screen === 'scene' && node && !combatActive && (
          <VNScenePanel
            node={node} typed={typed} typingDone={typingDone} skipTyping={skipTyping}
            choiceStatus={choiceStatus} choose={choose} statsConfig={statsConfig}
            defaultNpcAvatar={meta.defaultNpcAvatar}
            turn={turn} lastChoiceText={rt.lastChoiceText} lastDeltas={rt.lastDeltas}
            choicesOpen={choicesOpen} setChoicesOpen={setChoicesOpen}
          />
        )}

        {/* Game Over */}
        {screen === 'gameover' && (
          <div className="flex flex-col items-center gap-4 rounded-2xl p-8 m-auto max-w-md text-center" style={{ background: 'color-mix(in srgb, var(--rpg-panel) 80%, transparent)' }}>
            <div className="inline-flex items-center gap-2 text-2xl font-bold px-5 py-2 rounded-full" style={{ background: '#ef4444', color: '#fff' }}><Skull size={22} /> {meta.gameOverTitle || 'GAME OVER'}</div>
            <p className="text-base" style={{ color: 'var(--rpg-text)' }}>{meta.gameOverText || 'Bạn đã gục ngã. Số phận đã khép lại quá sớm...'}</p>
            <Summary statsConfig={statsConfig} rt={rt} />
            <Button onClick={reset} style={{ background: 'var(--rpg-accent2)', color: '#fff' }}><RotateCcw size={15} className="mr-1.5" />Bắt đầu lại</Button>
          </div>
        )}

        {/* Ending */}
        {screen === 'ending' && node && (
          <div className="flex flex-col items-center gap-4 rounded-2xl p-8 m-auto max-w-md text-center" style={{ background: 'color-mix(in srgb, var(--rpg-panel) 80%, transparent)' }}>
            <div className="text-xl font-bold px-5 py-2 rounded-full" style={{ background: endingMeta?.color || '#888', color: '#fff' }}>{endingMeta?.icon} {endingMeta?.label || 'Kết Thúc'}</div>
            <p className="text-base leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--rpg-text)' }}>{node.text}</p>
            <Summary statsConfig={statsConfig} rt={rt} />
            <Button onClick={reset} style={{ background: 'var(--rpg-accent2)', color: '#fff' }}><RotateCcw size={15} className="mr-1.5" />Chơi lại từ đầu</Button>
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
          <div className="max-w-sm w-full rounded-xl p-5 text-center relative" style={{ background: 'var(--rpg-panel)', boxShadow: '0 0 24px color-mix(in srgb, var(--rpg-accent2) 30%, transparent)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles size={18} style={{ color: 'var(--rpg-accent)' }} />
              <span className="font-bold tracking-widest text-sm uppercase" style={{ color: 'var(--rpg-accent2)' }}>{systemPopup.title || 'Hệ Thống'}</span>
            </div>
            <p className="text-sm leading-relaxed mb-4 whitespace-pre-wrap" style={{ color: 'var(--rpg-text)' }}>{systemPopup.text}</p>
            <Button size="sm" onClick={() => setSystemPopup(null)} style={{ background: 'var(--rpg-accent2)', color: '#fff' }}>Đã hiểu</Button>
            <button className="absolute top-2 right-2 opacity-60 hover:opacity-100" style={{ color: 'var(--rpg-accent2)' }} onClick={() => setSystemPopup(null)}><X size={16} /></button>
          </div>
        </div>
      )}

      {/* Bottom sheet — nhân vật / chỉ số / túi đồ / nhiệm vụ / quan hệ / lịch sử */}
      {sheetOpen && (
        <GameMenuSheet
          onClose={() => setSheetOpen(false)}
          meta={meta}
          rt={rt}
          gameData={gameData}
          statsConfig={statsConfig}
          archetype={archetype}
          showInventoryTab={showInventoryTab}
          showQuestTab={showQuestTab}
          mysterySlots={mysterySlots}
          onReset={reset}
          onExit={onExit}
        />
      )}

      {/* Event toasts — fixed theo viewport để luôn thấy được kể cả khi khung game rất cao trên điện thoại */}
      <div className="fixed left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none w-[calc(100%-24px)] max-w-sm" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}>
        {events.map((e) => (
          <div key={e.id} className="rpg-toast animate-in slide-in-from-bottom w-full text-center">
            {e.icon} {e.text}
          </div>
        ))}
      </div>
    </div>
  );
}

// Khung Visual Novel — vùng cảnh (ảnh, chỉ khi có) tách khỏi khối dẫn truyện/thoại,
// tách khỏi khối lựa chọn — không còn 1 card lớn ôm hết mọi thứ. Dẫn truyện
// (node.speaker rỗng) hiện như văn xuôi tiểu thuyết; NPC nói (có speaker) hiện
// nhãn tên + avatar nhỏ (nếu có) trong khung bán trong suốt nhẹ.
export function VNScenePanel({ node, typed, typingDone, skipTyping, choiceStatus, choose, statsConfig, defaultNpcAvatar, turn, lastChoiceText, lastDeltas, choicesOpen, setChoicesOpen }) {
  const art = node.npcAvatar || defaultNpcAvatar || node.bgImage || '';
  const hasArt = !!art;
  const isNarration = !node.speaker || !node.speaker.trim();
  const choiceCount = (node.choices || []).length;
  // Màn hình "Bạn muốn theo đuổi ai?" của archetype Công Lược (romance) — mọi
  // lựa chọn của node đều gắn npcCard (do npcScriptParser.js gán) — vẽ thành
  // lưới thẻ bài thay vì danh sách nút chữ suông. Vẫn dùng chung engine chọn
  // (choose()) như lựa chọn bình thường, chỉ khác cách hiển thị.
  const isNpcSelect = choiceCount > 0 && (node.choices || []).every((c) => c.npcCard);
  // Khi danh sách lựa chọn không chiếm chỗ (đang gõ chữ, đã bấm "Ẩn", hoặc
  // không có lựa chọn nào) thì mở rộng khung chữ hết cỡ thay vì cuộn trong ô nhỏ.
  const choicesVisible = typingDone && choicesOpen && choiceCount > 0;
  const scrollClass = 'rpg-vn-text-scroll scrollbar-thin' + (choicesVisible ? '' : ' expanded');
  return (
    <div className="rpg-vn-frame flex flex-col flex-1">
      {hasArt && (
        <div className="rpg-vn-scene">
          <img src={art} alt={node.speaker || ''} className="rpg-vn-scene-img" />
          <div className="rpg-vn-scene-fade" />
        </div>
      )}

      {isNarration ? (
        <div className="rpg-vn-narration">
          <TurnHeader turn={turn} lastDeltas={lastDeltas} statsConfig={statsConfig} />
          {lastChoiceText && <RecapCard text={lastChoiceText} />}
          <div className={scrollClass}>
            <p className="rpg-vn-narration-text">{typed}{!typingDone && <span className="animate-pulse">▋</span>}</p>
          </div>
          {!typingDone && <button onClick={skipTyping} className="rpg-vn-skip">Bỏ qua ⏭</button>}
        </div>
      ) : (
        <div className="rpg-vn-dialogue">
          <div className="rpg-vn-dialogue-head">
            {hasArt && <img src={art} alt="" className="rpg-vn-avatar" />}
            <span className="rpg-vn-name">{node.speaker}</span>
          </div>
          <TurnHeader turn={turn} lastDeltas={lastDeltas} statsConfig={statsConfig} />
          {lastChoiceText && <RecapCard text={lastChoiceText} />}
          <div className={scrollClass}>
            <p className="rpg-vn-dialogue-text">{typed}{!typingDone && <span className="animate-pulse">▋</span>}</p>
          </div>
          {!typingDone && <button onClick={skipTyping} className="rpg-vn-skip">Bỏ qua ⏭</button>}
        </div>
      )}

      <div className="rpg-vn-choices">
        {typingDone && choiceCount > 0 && !isNpcSelect && (
          <div className="rpg-choices-header">
            <span className="rpg-choices-title">Bạn sẽ làm gì? <span className="rpg-choices-count">({choiceCount} lựa chọn)</span></span>
            <button className="rpg-choices-toggle" onClick={() => setChoicesOpen((v) => !v)}>
              {choicesOpen ? 'Ẩn' : 'Hiện'} <ChevronDown size={12} style={{ transform: choicesOpen ? 'rotate(180deg)' : 'none' }} />
            </button>
          </div>
        )}
        {typingDone && isNpcSelect && (
          <div className="rpg-npc-select-grid">
            {node.choices.map((c, i) => (
              <button key={i} onClick={() => choose(c)} className="rpg-npc-card">
                {c.npcCard.image && <img src={c.npcCard.image} alt={c.npcCard.name} className="rpg-npc-card-img" />}
                <span className="rpg-npc-card-body">
                  <span className="rpg-npc-card-name">{c.npcCard.name}</span>
                  {c.npcCard.tagline && <span className="rpg-npc-card-tagline">{c.npcCard.tagline}</span>}
                  <span className="rpg-npc-card-btn">Theo đuổi</span>
                </span>
              </button>
            ))}
          </div>
        )}
        {typingDone && !isNpcSelect && choicesOpen && (node.choices || []).map((c, i) => {
          const st = choiceStatus(c);
          const lbl = c.label ? CHOICE_LABELS[c.label] : null;
          return (
            <button key={i} disabled={!st.ok} onClick={() => choose(c)} className="rpg-vn-choice">
              <span className="rpg-vn-choice-idx">{st.ok ? i + 1 : <Lock size={11} />}</span>
              <span className="rpg-vn-choice-body">
                <span className="rpg-vn-choice-row">
                  {lbl && <span className="rpg-vn-choice-label" style={{ background: lbl.color + '22', color: lbl.color }}>{lbl.text}</span>}
                  {c.diceRoll && <span className="rpg-vn-choice-dice"><Dices size={11} /> {statsConfig.find((s) => s.key === c.diceRoll.stat)?.label || c.diceRoll.stat || 'May rủi'} ≥{c.diceRoll.difficulty}</span>}
                  <span className="min-w-0 break-words">{c.text}</span>
                </span>
                {!st.ok && <div className="rpg-vn-choice-reason">{st.reason}</div>}
              </span>
            </button>
          );
        })}
        {typingDone && choiceCount === 0 && <p className="rpg-vn-empty">Không có lựa chọn tiếp theo. Hãy thêm lựa chọn trong Studio.</p>}
      </div>
    </div>
  );
}

// Nhãn "Lượt N" + các badge chỉ số vừa thay đổi ở lượt trước — đặt ngay trên
// đoạn văn bản để người chơi thấy hệ quả lựa chọn của mình mà không cần mở menu.
function TurnHeader({ turn, lastDeltas, statsConfig }) {
  const entries = Object.entries(lastDeltas || {}).filter(([, v]) => v);
  return (
    <div className="rpg-turn-row">
      <span className="rpg-turn-label">Lượt {turn}</span>
      <span className="rpg-turn-divider" />
      {entries.map(([k, v]) => {
        const label = statsConfig.find((s) => s.key === k)?.label || k;
        return (
          <span key={k} className={`rpg-turn-delta ${v > 0 ? 'pos' : 'neg'}`}>
            {label} {v > 0 ? '+' : ''}{v}
          </span>
        );
      })}
    </div>
  );
}

// Thẻ nhắc lại lựa chọn vừa chọn ở lượt trước, hiện ngay trên đoạn văn bản mới.
function RecapCard({ text }) {
  return (
    <div className="rpg-recap-card">
      <div className="rpg-recap-label">Bạn đã chọn</div>
      <div className="rpg-recap-text">{text}</div>
    </div>
  );
}

function Summary({ statsConfig, rt }) {
  return (
    <div className="w-full text-left rounded-lg p-3" style={{ background: 'var(--rpg-panel-2)' }}>
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

function GameMenuSheet({ onClose, meta, rt, gameData, statsConfig, archetype, showInventoryTab, showQuestTab, mysterySlots, onReset, onExit }) {
  const affinityEntries = Object.entries(rt.npcAffinity || {});
  const historyEntries = [...rt.history].slice(-20).reverse().map((id) => {
    const n = gameData.nodes[id];
    if (!n) return null;
    return { id, speaker: n.speaker && n.speaker.trim() ? n.speaker : 'Dẫn truyện', text: (n.text || '').slice(0, 140) };
  }).filter(Boolean);

  return (
    <>
      <div className="rpg-sheet-overlay" onClick={onClose} />
      <div className="rpg-sheet">
        <div className="rpg-sheet-handle" />
        <div className="rpg-sheet-body scrollbar-thin">
          {meta.player_bio && (
            <div className="rpg-sheet-section">
              <div className="rpg-sheet-section-title"><User size={13} /> Nhân vật</div>
              <div className="flex items-start gap-3">
                <img src={meta.playerAvatar || dicebearAvatar(meta.player_name)} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
                <div>
                  <div className="font-semibold text-sm" style={{ color: 'var(--rpg-text)' }}>{meta.player_name || 'Người Chơi'}</div>
                  <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--rpg-muted)' }}>{meta.player_bio}</p>
                </div>
              </div>
            </div>
          )}

          {statsConfig.length > 0 && (
            <div className="rpg-sheet-section">
              <div className="rpg-sheet-section-title"><Sparkles size={13} /> Chỉ số</div>
              <div className="grid grid-cols-2 gap-1.5">
                {statsConfig.map((sc) => {
                  const st = statStyle(sc.key);
                  const Icon = STAT_ICONS[st.icon] || Circle;
                  return (
                    <div key={sc.key} className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ background: 'var(--rpg-panel-2)' }}>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: st.color + '22', color: st.color }}>
                        <Icon size={12} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[9px] truncate" style={{ color: 'var(--rpg-muted)' }}>{sc.label}</div>
                        <div className="font-bold text-xs" style={{ color: 'var(--rpg-text)' }}>{rt.stats[sc.key] || 0}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {archetype === 'litrpg' && rt.skills.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {rt.skills.map((s) => <span key={s} className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: 'var(--rpg-panel-2)', color: 'var(--rpg-text)' }}>{s}</span>)}
                </div>
              )}
              {archetype === 'isekai' && rt.flags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {rt.flags.map((f) => <span key={f} className="px-1.5 py-0.5 rounded text-[10px] inline-flex items-center gap-1" style={{ background: 'var(--rpg-panel-2)', color: 'var(--rpg-text)' }}><GitBranch size={9} />{f}</span>)}
                </div>
              )}
            </div>
          )}

          {showInventoryTab && (
            <div className="rpg-sheet-section">
              <div className="rpg-sheet-section-title"><Package size={13} /> Túi đồ ({rt.inventory.length}/{archetype === 'mystery' ? mysterySlots : '∞'})</div>
              {rt.inventory.length === 0 ? <p className="text-xs italic" style={{ color: 'var(--rpg-muted)' }}>Túi đồ trống.</p> : (
                <div className="grid grid-cols-2 gap-1.5">
                  {rt.inventory.map((it, i) => (
                    <div key={i} className="px-2 py-1.5 rounded text-xs text-center inline-flex items-center justify-center gap-1" style={{ background: 'var(--rpg-panel-2)', color: 'var(--rpg-text)' }}><Package size={11} /> {it}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {showQuestTab && (
            <div className="rpg-sheet-section">
              <div className="rpg-sheet-section-title"><ScrollText size={13} /> Nhiệm vụ ({Object.values(rt.quests).filter((q) => q.status === 'active').length})</div>
              {Object.keys(rt.quests).length === 0 ? <p className="text-xs italic" style={{ color: 'var(--rpg-muted)' }}>Chưa có nhiệm vụ.</p> : (
                <div className="space-y-1.5">
                  {Object.values(rt.quests).map((q) => (
                    <div key={q.id} className="rounded p-2 text-xs" style={{ background: 'var(--rpg-panel-2)', opacity: q.status === 'completed' ? 0.6 : 1 }}>
                      <div className="flex justify-between font-semibold">
                        <span>{q.status === 'completed' ? '✓' : '•'} {q.title}</span>
                        <span className="text-[10px]" style={{ color: q.status === 'completed' ? '#39d14a' : 'var(--rpg-accent2)' }}>{q.status === 'completed' ? 'Hoàn thành' : 'Đang làm'}</span>
                      </div>
                      {q.desc && <p className="mt-0.5" style={{ color: 'var(--rpg-muted)' }}>{q.desc}</p>}
                      {q.reward && <p className="mt-0.5 flex items-center gap-1"><Gift size={11} /> {q.reward}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {affinityEntries.length > 0 && (
            <div className="rpg-sheet-section">
              <div className="rpg-sheet-section-title"><Heart size={13} /> Quan hệ</div>
              <div className="space-y-1">
                {affinityEntries.map(([n, v]) => (
                  <div key={n} className="flex justify-between text-xs" style={{ color: 'var(--rpg-text)' }}>
                    <span>{n}</span><b style={{ color: v >= 0 ? '#39d14a' : '#ff4d4d' }}>{v > 0 ? '+' : ''}{v}</b>
                  </div>
                ))}
              </div>
            </div>
          )}

          {historyEntries.length > 0 && (
            <div className="rpg-sheet-section">
              <div className="rpg-sheet-section-title"><History size={13} /> Lịch sử</div>
              <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin pr-1">
                {historyEntries.map((h, i) => (
                  <div key={h.id + i} className="text-xs">
                    <div className="font-semibold" style={{ color: 'var(--rpg-accent2)' }}>{h.speaker}</div>
                    <p style={{ color: 'var(--rpg-muted)' }}>{h.text}{h.text.length >= 140 ? '…' : ''}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rpg-sheet-section">
            <button className="rpg-sheet-item" onClick={onReset}><RotateCcw size={15} /> Chơi lại từ đầu</button>
            {onExit && <button className="rpg-sheet-item" onClick={onExit}><LogOut size={15} /> Thoát</button>}
          </div>
        </div>
      </div>
    </>
  );
}

// Bảng cung đấu — cấp bậc tần phi hiện tại + tiến độ thăng chức theo Sủng Ái,
// và "Hậu Cung · Thế Lực": danh sách phi tần/Thái Hậu với hảo cảm hiện tại.
function PalaceCourtBoard({ palace, palaceRankIdx, palaceRankLabel, palaceProgress, npcAffinity }) {
  const nextRank = palace.ranks?.[palaceRankIdx + 1];
  const entries = Object.entries(npcAffinity || {});
  return (
    <div className="flex flex-col gap-2 rounded-xl px-3 py-2" style={{ background: 'color-mix(in srgb, var(--rpg-panel) 55%, transparent)' }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--rpg-accent2)', color: '#fff' }}>
          <Crown size={11} /> {palaceRankLabel || '—'}
        </span>
        <div className="flex-1 min-w-[120px]">
          <div className="text-[10px] mb-0.5" style={{ color: 'var(--rpg-muted)' }}>
            {palace.favorLabel || 'Sủng Ái'} · {palaceRankIdx + 1}/{palace.ranks?.length || 1}
            {nextRank ? ` · còn ${Math.max(0, Math.round((100 - palaceProgress) / 100 * (palace.stepFavor || 15)))} điểm đến ${nextRank}` : ' · đã đạt đỉnh'}
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--rpg-panel-2)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: Math.max(0, Math.min(100, palaceProgress)) + '%', background: 'var(--rpg-accent2)' }} />
          </div>
        </div>
      </div>
      {entries.length > 0 && (
        <div>
          <div className="text-[10px] mb-1 font-bold uppercase tracking-wider" style={{ color: 'var(--rpg-muted)' }}>Hậu Cung · Thế Lực</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {entries.map(([name, v]) => (
              <div key={name} className="flex justify-between items-center gap-2 text-xs">
                <span className="truncate" style={{ color: 'var(--rpg-text)' }}>{name}</span>
                <span className="flex items-center gap-1 shrink-0">
                  <Heart size={10} className={v >= 0 ? 'text-emerald-400' : 'text-red-400'} />
                  <b style={{ color: v >= 0 ? '#4ade80' : '#ff4d4d' }}>{v > 0 ? '+' : ''}{v}</b>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Bảng gia sản — niên đại làm giàu hiện tại theo Vốn + tiến độ tới niên đại kế
// (mốc vốn + thu nhập thời đại), kèm số tài sản đang nắm giữ (vật phẩm).
function RebirthWealthBoard({ rebirth, eraIdx, eraLabel, eraProgress, nextEra, assetCount }) {
  const erasLen = rebirth.eras?.length || 1;
  return (
    <div className="flex flex-col gap-2 rounded-xl px-3 py-2" style={{ background: 'color-mix(in srgb, var(--rpg-panel) 55%, transparent)' }}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--rpg-accent2)', color: '#fff' }}>
          <Coins size={11} /> {eraLabel || '—'}
        </span>
        <div className="flex-1 min-w-[120px]">
          <div className="text-[10px] mb-0.5" style={{ color: 'var(--rpg-muted)' }}>
            {rebirth.moneyLabel || 'Vốn'} · Niên đại {Math.min(eraIdx + 1, erasLen)}/{erasLen}
            {assetCount > 0 ? ` · Tài sản ${assetCount}` : ''}
            {nextEra ? ` · cần ${nextEra.at} ${rebirth.moneyLabel} để tới ${nextEra.label} (+${nextEra.bonus || 0})` : ' · đã đạt đỉnh'}
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--rpg-panel-2)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: Math.max(0, Math.min(100, eraProgress)) + '%', background: 'var(--rpg-accent2)' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
