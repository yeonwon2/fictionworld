import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2 } from 'lucide-react';
import { ENDING_TYPES, makeId } from '@/lib/gameStudio/rpgThemes';

export default function NodeEditorDrawer({ node, allNodes, statsConfig, archetype, open, onClose, onChange }) {
  if (!node) return null;
  const arch = archetype || 'none';

  const updateChoice = (idx, patch) => {
    const choices = (node.choices || []).map((c, i) => (i === idx ? { ...c, ...patch } : c));
    onChange({ choices });
  };
  const addChoice = () => {
    onChange({ choices: [...(node.choices || []), { text: 'Lựa chọn mới', targetNodeId: 'start_node', statRequirements: {}, statModifiers: {} }] });
  };
  const removeChoice = (idx) => {
    onChange({ choices: (node.choices || []).filter((_, i) => i !== idx) });
  };

  const updateReq = (idx, key, val) => {
    const choices = [...(node.choices || [])];
    const req = { ...(choices[idx].statRequirements || {}) };
    if (val === '' || val == null) delete req[key]; else req[key] = Number(val);
    choices[idx] = { ...choices[idx], statRequirements: req };
    onChange({ choices });
  };
  const updateMod = (idx, key, val) => {
    const choices = [...(node.choices || [])];
    const mod = { ...(choices[idx].statModifiers || {}) };
    if (val === '' || val == null) delete mod[key]; else mod[key] = Number(val);
    choices[idx] = { ...choices[idx], statModifiers: mod };
    onChange({ choices });
  };

  // Node-level archetype helpers
  const setFlagsStr = ((node.setFlags || []).join(', '));
  const onSetFlags = (val) => {
    const arr = val.split(',').map((s) => s.trim()).filter(Boolean);
    onChange({ setFlags: arr });
  };
  const onSystemPopup = (field, val) => {
    const sp = { ...(node.systemPopup || { title: '', text: '' }) };
    sp[field] = val;
    onChange({ systemPopup: sp.title || sp.text ? sp : null });
  };
  const onQuest = (field, val) => {
    const q = { ...(node.quest || { id: '', title: '', desc: '', reward: '' }) };
    q[field] = val;
    if (field === 'title' && !q.id) q.id = 'quest_' + makeId('').replace('node_', '');
    onChange({ quest: q.title ? q : null });
  };

  // Choice-level npc affinity (single entry editor)
  const onChoiceNpc = (idx, name, delta) => {
    const choices = [...(node.choices || [])];
    const na = {};
    if (name && delta !== '') na[name] = Number(delta);
    choices[idx] = { ...choices[idx], npcAffinity: na };
    onChange({ choices });
  };

  // Dice roll on choice
  const toggleDice = (idx) => {
    const choices = [...(node.choices || [])];
    const c = choices[idx];
    if (c.diceRoll) { const { diceRoll, ...rest } = c; choices[idx] = rest; }
    else { choices[idx] = { ...c, diceRoll: { stat: (statsConfig[0] && statsConfig[0].key) || 'hp', difficulty: 10, successTarget: c.targetNodeId || 'start_node', failTarget: c.targetNodeId || 'start_node', successMods: {}, failMods: {} } }; }
    onChange({ choices });
  };
  const onDiceField = (idx, field, val) => {
    const choices = [...(node.choices || [])];
    const dr = { ...(choices[idx].diceRoll || {}) };
    dr[field] = val;
    choices[idx] = { ...choices[idx], diceRoll: dr };
    onChange({ choices });
  };
  const onDiceMod = (idx, which, key, val) => {
    const choices = [...(node.choices || [])];
    const dr = { ...(choices[idx].diceRoll || {}) };
    const m = { ...(dr[which] || {}) };
    if (val === '' || val == null) delete m[key]; else m[key] = Number(val);
    dr[which] = m;
    choices[idx] = { ...choices[idx], diceRoll: dr };
    onChange({ choices });
  };

  // Combat on node
  const toggleCombat = () => {
    if (node.combat) { onChange({ combat: null }); return; }
    onChange({ combat: { enemy: { name: 'Kẻ thù', hp: 50, attack: 10, defense: 3, avatar: '' }, winTarget: 'start_node', loseTarget: '', fleeTarget: '', fleeChance: 0.4, loot: { statModifiers: {}, grantItem: '' } } });
  };
  const onCombatField = (path, val) => {
    const cb = JSON.parse(JSON.stringify(node.combat || { enemy: {}, loot: {} }));
    const parts = path.split('.');
    let obj = cb;
    for (let i = 0; i < parts.length - 1; i++) { obj[parts[i]] = obj[parts[i]] || {}; obj = obj[parts[i]]; }
    if (val === '' && typeof obj[parts[parts.length - 1]] === 'number') val = 0;
    obj[parts[parts.length - 1]] = val;
    onChange({ combat: cb });
  };

  // Random events on node
  const addRandomEvent = () => onChange({ randomEvents: [...(node.randomEvents || []), { chance: 0.3, text: 'Sự kiện bất ngờ!', statModifiers: {}, grantItem: '' }] });
  const updateRandomEvent = (idx, patch) => { const ev = [...(node.randomEvents || [])]; ev[idx] = { ...ev[idx], ...patch }; onChange({ randomEvents: ev }); };
  const removeRandomEvent = (idx) => onChange({ randomEvents: (node.randomEvents || []).filter((_, i) => i !== idx) });
  const onRandEventMod = (idx, key, val) => {
    const ev = [...(node.randomEvents || [])];
    const m = { ...(ev[idx].statModifiers || {}) };
    if (val === '' || val == null) delete m[key]; else m[key] = Number(val);
    ev[idx] = { ...ev[idx], statModifiers: m };
    onChange({ randomEvents: ev });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Chỉnh sửa Node: <code className="text-xs font-mono">{node.id}</code></DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tên người nói (Speaker)</Label>
              <Input value={node.speaker || ''} onChange={(e) => onChange({ speaker: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Ảnh nền (Background URL)</Label>
              <Input value={node.bgImage || ''} onChange={(e) => onChange({ bgImage: e.target.value })} placeholder="https://images.unsplash.com/..." />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Lời dẫn truyện (Scene Text)</Label>
            <Textarea value={node.text || ''} onChange={(e) => onChange({ text: e.target.value })} rows={4} />
          </div>

          {/* Node-level archetype fields */}
          {arch === 'litrpg' && (
            <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-3 space-y-2">
              <Label className="text-xs font-semibold text-violet-600">Hệ Thống (LitRPG) — cấp Node</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px]">System Popup — Tiêu đề</Label>
                  <Input value={node.systemPopup?.title || ''} onChange={(e) => onSystemPopup('title', e.target.value)} className="h-8 text-xs" placeholder="vd: Đột phá!" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px]">System Popup — Nội dung</Label>
                  <Input value={node.systemPopup?.text || ''} onChange={(e) => onSystemPopup('text', e.target.value)} className="h-8 text-xs" placeholder="Nội dung thông báo" />
                </div>
              </div>
              <div className="rounded border border-violet-500/20 p-2 space-y-2">
                <Label className="text-[10px] font-semibold">Nhiệm vụ (Quest) — cấp khi vào node</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input value={node.quest?.title || ''} onChange={(e) => onQuest('title', e.target.value)} className="h-8 text-xs" placeholder="Tên nhiệm vụ" />
                  <Input value={node.quest?.reward || ''} onChange={(e) => onQuest('reward', e.target.value)} className="h-8 text-xs" placeholder="Phần thưởng" />
                </div>
                <Input value={node.quest?.desc || ''} onChange={(e) => onQuest('desc', e.target.value)} className="h-8 text-xs" placeholder="Mô tả nhiệm vụ" />
              </div>
            </div>
          )}

          {arch === 'isekai' && (
            <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-3 space-y-2">
              <Label className="text-xs font-semibold text-sky-600">Xuyên Không / Trọng Sinh — cấp Node</Label>
              <div className="space-y-1">
                <Label className="text-[10px]">Story Flags đặt khi vào node (cách nhau bởi dấu phẩy)</Label>
                <Input value={setFlagsStr} onChange={(e) => onSetFlags(e.target.value)} className="text-xs" placeholder="vd: da_gap_lao_dao_si, chon_cung_tinh" />
              </div>
            </div>
          )}

          {arch === 'mystery' && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 space-y-2">
              <Label className="text-xs font-semibold text-rose-600">Trinh thám / Kinh dị — cấp Node</Label>
              <div className="space-y-1">
                <Label className="text-[10px]">Vật phẩm nhặt được khi vào node (grantItem)</Label>
                <Input value={node.grantItem || ''} onChange={(e) => onChange({ grantItem: e.target.value })} className="text-xs" placeholder="vd: Chìa khóa gỉ" />
              </div>
            </div>
          )}

          <div className="flex items-center gap-6 rounded-lg border border-border p-3">
            <div className="flex items-center gap-2">
              <Switch checked={!!node.isEnding} onCheckedChange={(v) => onChange({ isEnding: v, endingType: v ? (node.endingType || 'NORMAL_END') : null, choices: v ? [] : (node.choices || []) })} />
              <Label className="text-xs">Node kết thúc (Ending)</Label>
            </div>
            {node.isEnding && (
              <div className="space-y-1.5 flex-1">
                <Label className="text-xs">Loại kết thúc</Label>
                <Select value={node.endingType || 'NORMAL_END'} onValueChange={(v) => onChange({ endingType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(ENDING_TYPES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.icon} {v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Combat config */}
          {!node.isEnding && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Switch checked={!!node.combat} onCheckedChange={toggleCombat} />
                <Label className="text-xs font-semibold text-red-600">⚔️ Combat — Trận đánh trùm (turn-based)</Label>
              </div>
              {node.combat && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1"><Label className="text-[10px]">Tên kẻ thù</Label><Input value={node.combat.enemy?.name || ''} onChange={(e) => onCombatField('enemy.name', e.target.value)} className="h-8 text-xs" /></div>
                    <div className="space-y-1"><Label className="text-[10px]">Avatar URL (để trống = tự sinh)</Label><Input value={node.combat.enemy?.avatar || ''} onChange={(e) => onCombatField('enemy.avatar', e.target.value)} className="h-8 text-xs" /></div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="space-y-1"><Label className="text-[10px] text-red-600">HP</Label><Input type="number" value={node.combat.enemy?.hp ?? ''} onChange={(e) => onCombatField('enemy.hp', Number(e.target.value))} className="h-8 text-xs" /></div>
                    <div className="space-y-1"><Label className="text-[10px] text-red-600">Tấn công</Label><Input type="number" value={node.combat.enemy?.attack ?? ''} onChange={(e) => onCombatField('enemy.attack', Number(e.target.value))} className="h-8 text-xs" /></div>
                    <div className="space-y-1"><Label className="text-[10px] text-red-600">Phòng thủ</Label><Input type="number" value={node.combat.enemy?.defense ?? ''} onChange={(e) => onCombatField('enemy.defense', Number(e.target.value))} className="h-8 text-xs" /></div>
                    <div className="space-y-1"><Label className="text-[10px] text-red-600">Giới thiệu</Label><Input value={node.combat.enemy?.intro || ''} onChange={(e) => onCombatField('enemy.intro', e.target.value)} className="h-8 text-xs" /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1"><Label className="text-[10px] text-emerald-600">Node khi thắng</Label>
                      <Select value={node.combat.winTarget || ''} onValueChange={(v) => onCombatField('winTarget', v)}><SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger><SelectContent>{Object.values(allNodes).map((n) => <SelectItem key={n.id} value={n.id}>{n.id}</SelectItem>)}</SelectContent></Select>
                    </div>
                    <div className="space-y-1"><Label className="text-[10px] text-amber-600">Node khi bỏ chạy</Label>
                      <Select value={node.combat.fleeTarget || ''} onValueChange={(v) => onCombatField('fleeTarget', v)}><SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={null}>— (không)</SelectItem>{Object.values(allNodes).map((n) => <SelectItem key={n.id} value={n.id}>{n.id}</SelectItem>)}</SelectContent></Select>
                    </div>
                    <div className="space-y-1"><Label className="text-[10px] text-red-600">Tỷ lệ bỏ chạy</Label><Input type="number" step="0.1" value={node.combat.fleeChance ?? 0.4} onChange={(e) => onCombatField('fleeChance', Number(e.target.value))} className="h-8 text-xs" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1"><Label className="text-[10px] text-emerald-600">Loot — vật phẩm</Label><Input value={node.combat.loot?.grantItem || ''} onChange={(e) => onCombatField('loot.grantItem', e.target.value)} className="h-8 text-xs" placeholder="vd: Nanh Sói" /></div>
                    <div className="space-y-1"><Label className="text-[10px] text-emerald-600">Loot — EXP</Label><Input type="number" value={node.combat.loot?.exp ?? ''} onChange={(e) => onCombatField('loot.exp', e.target.value === '' ? null : Number(e.target.value))} className="h-8 text-xs" /></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Random events config */}
          {!node.isEnding && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-amber-600">🎲 Random Events — Sự kiện ngẫu nhiên khi vào node</Label>
                <Button size="sm" variant="outline" onClick={addRandomEvent} className="h-7 text-xs"><Plus size={14} className="mr-1" /> Thêm</Button>
              </div>
              {(node.randomEvents || []).map((ev, idx) => (
                <div key={idx} className="rounded border border-amber-500/20 p-2 space-y-1.5">
                  <div className="flex gap-2 items-center">
                    <Input type="number" step="0.05" value={ev.chance ?? ''} onChange={(e) => updateRandomEvent(idx, { chance: Number(e.target.value) })} className="h-8 text-xs w-20" placeholder="xác suất" />
                    <Input value={ev.text || ''} onChange={(e) => updateRandomEvent(idx, { text: e.target.value })} className="h-8 text-xs flex-1" placeholder="Mô tả sự kiện" />
                    <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => removeRandomEvent(idx)}><Trash2 size={14} /></Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {statsConfig.map((s) => (
                      <Input key={s.key} type="number" placeholder={`${s.label} ±`} value={(ev.statModifiers || {})[s.key] ?? ''} onChange={(e) => onRandEventMod(idx, s.key, e.target.value)} className="h-7 text-[11px] w-24" />
                    ))}
                  </div>
                  <Input value={ev.grantItem || ''} onChange={(e) => updateRandomEvent(idx, { grantItem: e.target.value })} className="h-8 text-xs" placeholder="Vật phẩm nhặt được (tùy chọn)" />
                </div>
              ))}
              {(node.randomEvents || []).length === 0 && <p className="text-[11px] text-muted-foreground italic">Chưa có sự kiện. Thêm để tạo bất ngờ (vd: 30% nhặt được tiền, 15% trượt chân trừ HP).</p>}
            </div>
          )}

          {!node.isEnding && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Danh sách lựa chọn (Choices)</Label>
                <Button size="sm" variant="outline" onClick={addChoice} className="h-7 text-xs">
                  <Plus size={14} className="mr-1" /> Thêm lựa chọn
                </Button>
              </div>
              <div className="space-y-3">
                {(node.choices || []).map((c, idx) => {
                  const npcName = c.npcAffinity ? Object.keys(c.npcAffinity)[0] || '' : '';
                  const npcDelta = c.npcAffinity ? c.npcAffinity[npcName] : '';
                  return (
                    <div key={idx} className="rounded-lg border border-border p-3 space-y-2 bg-muted/30">
                      <div className="flex gap-2">
                        <Input value={c.text} onChange={(e) => updateChoice(idx, { text: e.target.value })} placeholder="Text hiển thị" className="flex-1 text-sm" />
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeChoice(idx)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>

                      {/* Isekai label */}
                      {arch === 'isekai' && (
                        <div className="flex items-center gap-2">
                          <Label className="text-[10px]">Nhãn độc quyền:</Label>
                          <Select value={c.label || 'none'} onValueChange={(v) => updateChoice(idx, { label: v === 'none' ? null : v })}>
                            <SelectTrigger className="h-7 text-xs w-44"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Không</SelectItem>
                              <SelectItem value="rebirth">[Trọng Sinh]</SelectItem>
                              <SelectItem value="modern">[Tri Thức Hiện Đại]</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-[10px] text-muted-foreground">Node đích</Label>
                          <Select value={c.targetNodeId} onValueChange={(v) => updateChoice(idx, { targetNodeId: v })}>
                            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.values(allNodes).map((n) => (
                                <SelectItem key={n.id} value={n.id}>{n.id}{n.isEnding ? ' (kết thúc)' : ''}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Điều kiện chỉ số (≥)</Label>
                            <div className="space-y-1">
                              {statsConfig.map((s) => (
                                <Input key={s.key} type="number" placeholder={`${s.label} ≥`} value={(c.statRequirements || {})[s.key] ?? ''} onChange={(e) => updateReq(idx, s.key, e.target.value)} className="h-8 text-xs" />
                              ))}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground">Hiệu ứng chỉ số (±)</Label>
                            <div className="space-y-1">
                              {statsConfig.map((s) => (
                                <Input key={s.key} type="number" placeholder={`${s.label} ±`} value={(c.statModifiers || {})[s.key] ?? ''} onChange={(e) => updateMod(idx, s.key, e.target.value)} className="h-8 text-xs" />
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Archetype choice fields */}
                      {arch === 'mystery' && (
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[10px] text-rose-600">Cần vật phẩm</Label>
                            <Input value={c.requiresItem || ''} onChange={(e) => updateChoice(idx, { requiresItem: e.target.value })} className="h-8 text-xs" placeholder="requiresItem" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] text-rose-600">Nhặt vật phẩm</Label>
                            <Input value={c.grantItem || ''} onChange={(e) => updateChoice(idx, { grantItem: e.target.value })} className="h-8 text-xs" placeholder="grantItem" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] text-rose-600">Tiêu hao vật phẩm</Label>
                            <Input value={c.removeItem || ''} onChange={(e) => updateChoice(idx, { removeItem: e.target.value })} className="h-8 text-xs" placeholder="removeItem" />
                          </div>
                        </div>
                      )}

                      {arch === 'isekai' && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[10px] text-sky-600">Cần Story Flag</Label>
                            <Input value={c.requiresFlag || ''} onChange={(e) => updateChoice(idx, { requiresFlag: e.target.value })} className="h-8 text-xs" placeholder="requiresFlag" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] text-sky-600">Đặt Story Flag</Label>
                            <Input value={c.grantFlag || ''} onChange={(e) => updateChoice(idx, { grantFlag: e.target.value })} className="h-8 text-xs" placeholder="grantFlag" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] text-sky-600">NPC thay đổi hảo cảm</Label>
                            <Input value={npcName} onChange={(e) => onChoiceNpc(idx, e.target.value, npcDelta)} className="h-8 text-xs" placeholder="tên NPC" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] text-sky-600">Delta hảo cảm (±)</Label>
                            <Input type="number" value={npcDelta ?? ''} onChange={(e) => onChoiceNpc(idx, npcName, e.target.value)} className="h-8 text-xs" placeholder="vd: +10 / -5" />
                          </div>
                        </div>
                      )}

                      {arch === 'litrpg' && (
                        <div className="grid grid-cols-4 gap-2">
                          <div className="space-y-1">
                            <Label className="text-[10px] text-violet-600">EXP</Label>
                            <Input type="number" value={c.exp ?? ''} onChange={(e) => updateChoice(idx, { exp: e.target.value === '' ? null : Number(e.target.value) })} className="h-8 text-xs" placeholder="±exp" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] text-violet-600">Điểm Hệ Thống</Label>
                            <Input type="number" value={c.systemPoints ?? ''} onChange={(e) => updateChoice(idx, { systemPoints: e.target.value === '' ? null : Number(e.target.value) })} className="h-8 text-xs" placeholder="±sp" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] text-violet-600">Mở khóa kỹ năng</Label>
                            <Input value={c.unlockSkill || ''} onChange={(e) => updateChoice(idx, { unlockSkill: e.target.value })} className="h-8 text-xs" placeholder="tên skill" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] text-violet-600">Hoàn thành nhiệm vụ</Label>
                            <Input value={c.completeQuestId || ''} onChange={(e) => updateChoice(idx, { completeQuestId: e.target.value })} className="h-8 text-xs" placeholder="quest id" />
                          </div>
                        </div>
                      )}

                      {/* Dice roll */}
                      <div className="rounded border border-fuchsia-500/20 bg-fuchsia-500/5 p-2 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Switch checked={!!c.diceRoll} onCheckedChange={() => toggleDice(idx)} />
                          <Label className="text-[10px] font-semibold text-fuchsia-600">🎲 Dice Roll — Lựa chọn may rủi (d20 + chỉ số)</Label>
                        </div>
                        {c.diceRoll && (
                          <div className="space-y-1.5">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[10px] text-fuchsia-600">Chỉ số cộng thưởng</Label>
                                <Select value={c.diceRoll.stat || ''} onValueChange={(v) => onDiceField(idx, 'stat', v)}><SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger><SelectContent>{statsConfig.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent></Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-fuchsia-600">Độ khó (DC)</Label>
                                <Input type="number" value={c.diceRoll.difficulty ?? 10} onChange={(e) => onDiceField(idx, 'difficulty', Number(e.target.value))} className="h-8 text-xs" />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[10px] text-emerald-600">Node khi thành công</Label>
                                <Select value={c.diceRoll.successTarget || ''} onValueChange={(v) => onDiceField(idx, 'successTarget', v)}><SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger><SelectContent>{Object.values(allNodes).map((n) => <SelectItem key={n.id} value={n.id}>{n.id}</SelectItem>)}</SelectContent></Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-red-600">Node khi thất bại</Label>
                                <Select value={c.diceRoll.failTarget || ''} onValueChange={(v) => onDiceField(idx, 'failTarget', v)}><SelectTrigger className="text-xs h-8"><SelectValue /></SelectTrigger><SelectContent>{Object.values(allNodes).map((n) => <SelectItem key={n.id} value={n.id}>{n.id}</SelectItem>)}</SelectContent></Select>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[10px] text-emerald-600">Thưởng khi thành công</Label>
                                <div className="space-y-1">{statsConfig.map((s) => <Input key={s.key} type="number" placeholder={`${s.label} ±`} value={(c.diceRoll.successMods || {})[s.key] ?? ''} onChange={(e) => onDiceMod(idx, 'successMods', s.key, e.target.value)} className="h-7 text-[11px]" />)}</div>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-red-600">Phạt khi thất bại</Label>
                                <div className="space-y-1">{statsConfig.map((s) => <Input key={s.key} type="number" placeholder={`${s.label} ±`} value={(c.diceRoll.failMods || {})[s.key] ?? ''} onChange={(e) => onDiceMod(idx, 'failMods', s.key, e.target.value)} className="h-7 text-[11px]" />)}</div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {(node.choices || []).length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Chưa có lựa chọn. Thêm lựa chọn để người chơi tiếp tục.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}