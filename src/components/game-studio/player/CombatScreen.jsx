import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Swords, Shield, Zap, Footprints, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { dicebearAvatar } from '@/lib/gameStudio/rpgThemes';

// Turn-based combat. Player attacks / uses skill (MP cost) / defends / flees.
export default function CombatScreen({ combat, rt, statsConfig, rankIndex, onEnd, themeStyle, pushEvent }) {
  const enemy = combat.enemy || {};
  const [enemyHp, setEnemyHp] = useState(enemy.hp || 50);
  const enemyMaxHp = enemy.hp || 50;
  const [playerHp, setPlayerHp] = useState(rt.stats.hp || 100);
  const playerMaxHp = rt.stats.hp || 100;
  const [playerMp, setPlayerMp] = useState(rt.stats.mp || rt.stats.mana || 30);
  const [defending, setDefending] = useState(false);
  const [log, setLog] = useState([{ t: 'start', text: `${enemy.name || 'Kẻ thù'} xuất hiện! ${enemy.intro || ''}` }]);
  const [turn, setTurn] = useState('player'); // player | enemy
  const [over, setOver] = useState(null); // null | 'win' | 'lose' | 'flee'
  const [busy, setBusy] = useState(false);
  const logRef = useRef(null);

  const playerAttack = 12 + (rankIndex || 0) * 3 + Math.floor((rt.skills || []).length * 2);
  const playerDefense = 5;
  const enemyAttack = enemy.attack || 10;
  const enemyDefense = enemy.defense || 3;
  const skills = rt.skills || [];

  const addLog = useCallback((text, t = 'info') => {
    setLog((prev) => [...prev.slice(-6), { text, t }]);
  }, []);

  const variance = (d) => Math.round(d * (0.85 + Math.random() * 0.3));

  const enemyTurn = useCallback(() => {
    if (over) return;
    setBusy(true);
    setTimeout(() => {
      // Enemy skill?
      const eSkills = enemy.skills || [];
      let dmg = variance(enemyAttack);
      let skillName = null;
      if (eSkills.length && Math.random() < 0.3) {
        const sk = eSkills[Math.floor(Math.random() * eSkills.length)];
        dmg = variance(sk.damage || enemyAttack);
        skillName = sk.name;
      }
      if (defending) dmg = Math.max(1, Math.round(dmg * 0.4));
      setDefending(false);
      const newHp = Math.max(0, playerHp - dmg);
      setPlayerHp(newHp);
      addLog(`${enemy.name}${skillName ? ' dùng ' + skillName : ''} gây ${dmg} sát thương${defending ? ' (đã phòng thủ)' : ''}.`, 'enemy');
      if (newHp <= 0) {
        setOver('lose');
        addLog('Bạn đã gục ngã trong trận chiến...', 'lose');
      } else {
        setTurn('player');
      }
      setBusy(false);
    }, 700);
  }, [over, enemy, enemyAttack, defending, playerHp, addLog]);

  useEffect(() => {
    if (turn === 'enemy' && !over) {
      const t = setTimeout(enemyTurn, 500);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, over]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  const doAttack = () => {
    if (busy || over || turn !== 'player') return;
    setBusy(true);
    setDefending(false);
    const crit = Math.random() < 0.15;
    let dmg = variance(playerAttack - enemyDefense);
    if (crit) dmg = Math.round(dmg * 1.6);
    const newHp = Math.max(0, enemyHp - dmg);
    setEnemyHp(newHp);
    addLog(`Bạn tấn công${crit ? ' (CRITICAL!)' : ''} gây ${dmg} sát thương.`, crit ? 'crit' : 'player');
    if (newHp <= 0) {
      setOver('win');
      addLog(`Bạn đã đánh bại ${enemy.name}!`, 'win');
      setBusy(false);
    } else {
      setTurn('enemy');
      setBusy(false);
    }
  };

  const doSkill = (sk) => {
    if (busy || over || turn !== 'player') return;
    const cost = 15;
    if (playerMp < cost) { addLog('Không đủ Nội lực (MP) để dùng kỹ năng!', 'warn'); return; }
    setBusy(true);
    setDefending(false);
    setPlayerMp((m) => m - cost);
    const dmg = Math.round((playerAttack - enemyDefense) * 1.8) + Math.floor(Math.random() * 6);
    const newHp = Math.max(0, enemyHp - dmg);
    setEnemyHp(newHp);
    addLog(`Kỹ năng "${sk}" bùng nổ! Gây ${dmg} sát thương. (MP -${cost})`, 'skill');
    if (newHp <= 0) {
      setOver('win');
      addLog(`Bạn đã đánh bại ${enemy.name} bằng ${sk}!`, 'win');
      setBusy(false);
    } else {
      setTurn('enemy');
      setBusy(false);
    }
  };

  const doDefend = () => {
    if (busy || over || turn !== 'player') return;
    setDefending(true);
    addLog('Bạn giơ khiên phòng thủ, giảm 60% sát thương lượt sau.', 'defend');
    setTurn('enemy');
  };

  const doFlee = () => {
    if (busy || over || turn !== 'player') return;
    const chance = combat.fleeChance != null ? combat.fleeChance : 0.4;
    if (Math.random() < chance) {
      setOver('flee');
      addLog('Bạn bỏ chạy thành công!', 'flee');
    } else {
      addLog('Bỏ chạy thất bại! Địch nhân tấn công tự do.', 'warn');
      setTurn('enemy');
    }
  };

  const finish = () => {
    const finalStats = { ...rt.stats, hp: playerHp, mp: playerMp };
    onEnd({ result: over, stats: finalStats });
  };

  const hpPct = (h, max) => Math.max(0, Math.min(100, (h / max) * 100));

  return (
    <div className="flex flex-col flex-1 gap-3 rounded-2xl p-5 relative z-10" style={{ background: 'color-mix(in srgb, var(--rpg-panel) 78%, transparent)', border: '2px solid #ef4444', boxShadow: '0 0 22px #ef444444, inset 0 0 30px rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)' }}>
      <div className="flex items-center gap-2 text-xs font-bold tracking-wider uppercase px-2.5 py-1 rounded-full self-start" style={{ background: '#ef444422', color: '#ef4444', border: '1px solid #ef444466' }}>
        <Swords size={13} /> Chiến Đấu
      </div>

      {/* Enemy */}
      <div className="rounded-xl p-3" style={{ background: 'color-mix(in srgb, var(--rpg-panel-2) 80%, transparent)', border: '1px solid var(--rpg-border)' }}>
        <div className="flex items-center gap-3">
          <img src={enemy.avatar || dicebearAvatar(enemy.name)} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" style={{ border: '2px solid #ef4444', boxShadow: '0 0 10px #ef444466' }} />
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm truncate" style={{ color: 'var(--rpg-text)' }}>{enemy.name || 'Kẻ thù'}</div>
            <div className="flex items-center gap-1.5 mt-1">
              <Heart size={12} className="text-red-400 shrink-0" />
              <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: 'var(--rpg-panel)', border: '1px solid var(--rpg-border)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: hpPct(enemyHp, enemyMaxHp) + '%', background: 'linear-gradient(90deg, #ef4444, #f87171)' }} />
              </div>
              <span className="text-[11px] font-mono font-bold text-red-400">{enemyHp}/{enemyMaxHp}</span>
            </div>
            {enemy.intro && <div className="text-[11px] mt-1 italic" style={{ color: 'var(--rpg-muted)' }}>{enemy.intro}</div>}
          </div>
        </div>
      </div>

      {/* Player HP/MP */}
      <div className="rounded-xl p-2.5 flex gap-3" style={{ background: 'color-mix(in srgb, var(--rpg-panel-2) 80%, transparent)', border: '1px solid var(--rpg-border)' }}>
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <Heart size={12} className="text-red-400" />
            <span className="text-[10px] text-red-400 font-bold">Sinh lực</span>
            <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--rpg-panel)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: hpPct(playerHp, playerMaxHp) + '%', background: '#ef4444' }} />
            </div>
            <span className="text-[11px] font-mono text-red-400">{playerHp}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <Zap size={12} className="text-blue-400" />
            <span className="text-[10px] text-blue-400 font-bold">Nội lực</span>
            <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--rpg-panel)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: hpPct(playerMp, 30) + '%', background: '#3b82f6' }} />
            </div>
            <span className="text-[11px] font-mono text-blue-400">{playerMp}</span>
          </div>
        </div>
      </div>

      {/* Log */}
      <div ref={logRef} className="flex-1 rounded-xl p-3 overflow-y-auto scrollbar-thin min-h-[90px] max-h-[140px] text-xs space-y-1" style={{ background: 'color-mix(in srgb, var(--rpg-panel) 92%, transparent)', border: '1px solid var(--rpg-border)', color: 'var(--rpg-text)' }}>
        {log.map((l, i) => (
          <div key={i} style={{ color: l.t === 'enemy' ? '#fca5a5' : l.t === 'player' ? '#86efac' : l.t === 'crit' ? '#fde047' : l.t === 'skill' ? '#c4b5fd' : l.t === 'defend' ? '#7dd3fc' : l.t === 'win' ? '#39d14a' : l.t === 'lose' ? '#ff4d4d' : l.t === 'warn' ? '#fbbf24' : 'var(--rpg-text)', fontWeight: ['crit', 'win', 'lose'].includes(l.t) ? 'bold' : 'normal' }}>
            {l.text}
          </div>
        ))}
      </div>

      {/* Actions */}
      {!over && (
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" disabled={busy || turn !== 'player'} onClick={doAttack} className="bg-red-600 hover:bg-red-700 text-xs h-9"><Swords size={14} className="mr-1" /> Tấn công ({playerAttack})</Button>
          <Button size="sm" disabled={busy || turn !== 'player'} onClick={doDefend} className="bg-sky-600 hover:bg-sky-700 text-xs h-9"><Shield size={14} className="mr-1" /> Phòng thủ</Button>
          {skills.length > 0 && (
            <Button size="sm" disabled={busy || turn !== 'player' || playerMp < 15} onClick={() => doSkill(skills[0])} className="bg-violet-600 hover:bg-violet-700 text-xs h-9 col-span-2"><Zap size={14} className="mr-1" /> {skills[0]} (15 MP · {Math.round(playerAttack * 1.8)} dmg)</Button>
          )}
          <Button size="sm" disabled={busy || turn !== 'player'} onClick={doFlee} variant="outline" className="text-xs h-9 col-span-2"><Footprints size={14} className="mr-1" /> Bỏ chạy</Button>
        </div>
      )}
      {turn === 'enemy' && !over && <div className="text-center text-[11px] animate-pulse" style={{ color: 'var(--rpg-muted)' }}>Lượt địch hành động...</div>}

      {over && (
        <div className="text-center space-y-3">
          <div className="text-lg font-bold" style={{ color: over === 'win' ? '#39d14a' : over === 'flee' ? '#fbbf24' : '#ff4d4d' }}>
            {over === 'win' && 'Chiến thắng!'}
            {over === 'flee' && 'Đã rút lui an toàn'}
            {over === 'lose' && 'Thất bại...'}
          </div>
          <Button onClick={finish} style={{ background: 'var(--rpg-accent)', color: 'var(--rpg-panel)' }}>Tiếp tục →</Button>
        </div>
      )}
    </div>
  );
}