import React, { useState, useEffect, useRef } from 'react';
import { Dices } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { statStyle } from '@/lib/gameStudio/rpgThemes';

// Roll d20 + statBonus vs difficulty. Crit success on nat 20 or margin >= critThreshold. Crit fail on nat 1.
export function rollDice(diceRoll, stats) {
  const stat = diceRoll?.stat;
  const bonus = stat ? Math.floor((stats[stat] || 0) / 10) : 0;
  const raw = 1 + Math.floor(Math.random() * 20); // 1..20
  const total = raw + bonus;
  const difficulty = diceRoll?.difficulty || 10;
  const margin = total - difficulty;
  let outcome = total >= difficulty ? 'success' : 'fail';
  let crit = null;
  if (raw === 20 || (outcome === 'success' && margin >= (diceRoll?.critThreshold || 5))) {
    outcome = 'success'; crit = 'crit_success';
  } else if (raw === 1 || (outcome === 'fail' && margin <= -(diceRoll?.critFailThreshold || 5))) {
    outcome = 'fail'; crit = 'crit_fail';
  }
  return { raw, bonus, total, difficulty, margin, outcome, crit };
}

export function applyDiceResult(diceRoll, result, stats) {
  const mods = result.outcome === 'success'
    ? (diceRoll.successMods || diceRoll.statModifiers || {})
    : (diceRoll.failMods || {});
  let finalMods = { ...mods };
  if (result.crit === 'crit_success') {
    for (const k of Object.keys(finalMods)) if (finalMods[k] > 0) finalMods[k] = Math.round(finalMods[k] * 1.8);
  } else if (result.crit === 'crit_fail') {
    for (const k of Object.keys(finalMods)) if (finalMods[k] < 0) finalMods[k] = Math.round(finalMods[k] * 1.6);
  }
  const ns = { ...stats };
  for (const k of Object.keys(finalMods)) ns[k] = (ns[k] || 0) + finalMods[k];
  const target = result.outcome === 'success' ? (diceRoll.successTarget || diceRoll.targetNodeId) : (diceRoll.failTarget || diceRoll.targetNodeId);
  return { stats: ns, mods: finalMods, target };
}

export default function DiceRollOverlay({ diceRoll, stats, statLabel, onDone }) {
  const [phase, setPhase] = useState('rolling'); // rolling | result
  const [display, setDisplay] = useState(20);
  const [result, setResult] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    let ticks = 0;
    timerRef.current = setInterval(() => {
      setDisplay(1 + Math.floor(Math.random() * 20));
      ticks++;
      if (ticks > 14) {
        clearInterval(timerRef.current);
        const r = rollDice(diceRoll, stats);
        setDisplay(r.raw);
        setResult(r);
        setPhase('result');
      }
    }, 70);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const st = statStyle(diceRoll?.stat);
  const isCritS = result?.crit === 'crit_success';
  const isCritF = result?.crit === 'crit_fail';
  const isSuccess = result?.outcome === 'success';

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.78)' }}>
      <div className="max-w-sm w-full rounded-2xl p-6 text-center" style={{ background: 'linear-gradient(135deg, #0a0a1f, #1a0a2e)', border: `2px solid ${phase === 'result' ? (isSuccess ? '#39d14a' : '#ff4d4d') : '#a855f7'}`, boxShadow: `0 0 30px ${phase === 'result' ? (isSuccess ? '#39d14a66' : '#ff4d4d66') : '#a855f766'}` }}>
        <div className="flex items-center justify-center gap-2 mb-3">
          <Dices size={18} className="text-fuchsia-400" />
          <span className="text-fuchsia-300 font-bold tracking-widest text-xs uppercase">Quay Xúc Xắc Định Mệnh</span>
        </div>
        {diceRoll?.stat && (
          <div className="text-[11px] mb-2" style={{ color: st.c }}>
            Dựa trên {statLabel} (thưởng +{Math.floor((stats[diceRoll.stat] || 0) / 10)})
          </div>
        )}
        <div className="flex items-center justify-center gap-3 my-4">
          <div className="rpg-dice" style={{
            width: 72, height: 72, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 38, fontWeight: 900, fontFamily: 'ui-monospace, monospace',
            background: phase === 'result' ? (isSuccess ? '#39d14a22' : '#ff4d4d22') : '#a855f722',
            border: `2px solid ${phase === 'result' ? (isSuccess ? '#39d14a' : '#ff4d4d') : '#a855f7'}`,
            boxShadow: `0 0 20px ${phase === 'result' ? (isSuccess ? '#39d14a66' : '#ff4d4d66') : '#a855f766'}`,
            transform: phase === 'rolling' ? 'rotate(' + (display * 12) + 'deg)' : 'none',
            transition: 'transform 0.06s',
          }}>
            {display}
          </div>
        </div>
        {phase === 'rolling' && <div className="text-xs text-fuchsia-300 animate-pulse">Đang quay...</div>}
        {phase === 'result' && result && (
          <div className="space-y-2">
            <div className="text-sm">
              <span className="font-mono">{result.raw}</span>
              {result.bonus > 0 && <span className="text-emerald-400"> + {result.bonus}</span>}
              <span className="text-muted-foreground"> = </span>
              <span className="font-bold font-mono text-base">{result.total}</span>
              <span className="text-muted-foreground text-xs"> / {result.difficulty}</span>
            </div>
            <div className="text-lg font-bold" style={{ color: isSuccess ? '#39d14a' : '#ff4d4d' }}>
              {isCritS && 'CRITICAL THÀNH CÔNG!'}
              {isCritF && 'CRITICAL THẤT BẠI!'}
              {!isCritS && !isCritF && (isSuccess ? '✅ Thành công!' : '❌ Thất bại!')}
            </div>
            <Button size="sm" className="mt-2" onClick={() => onDone(result)} style={{ background: isSuccess ? '#39d14a' : '#ff4d4d', color: '#fff' }}>
              Tiếp tục →
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}