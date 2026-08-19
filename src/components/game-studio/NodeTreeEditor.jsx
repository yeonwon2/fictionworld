import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Map, Edit3, Flag } from 'lucide-react';
import { ENDING_TYPES, makeId } from '@/lib/gameStudio/rpgThemes';
import NodeEditorDrawer from './NodeEditorDrawer';

export default function NodeTreeEditor({ gameData, setGameData }) {
  const [editingId, setEditingId] = useState(null);
  const { nodes } = gameData;
  const nodeArr = Object.values(nodes);

  const addNode = () => {
    const id = makeId('node');
    const newNode = {
      id, speaker: 'Dẫn Truyện', text: 'Phân cảnh mới...',
      bgImage: '', isEnding: false, endingType: null, choices: [],
    };
    setGameData({ ...gameData, nodes: { ...nodes, [id]: newNode } });
    setEditingId(id);
  };

  const deleteNode = (id) => {
    if (id === 'start_node') return;
    const next = { ...nodes };
    delete next[id];
    // clean dangling references
    for (const n of Object.values(next)) {
      for (const c of n.choices || []) {
        if (c.targetNodeId === id) c.targetNodeId = 'start_node';
      }
    }
    setGameData({ ...gameData, nodes: next });
  };

  const updateNode = (id, patch) => {
    setGameData({ ...gameData, nodes: { ...nodes, [id]: { ...nodes[id], ...patch } } });
  };

  const editingNode = editingId ? nodes[editingId] : null;

  return (
    <section className="glass-card rounded-2xl p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2"><Map size={14} /> Visual Node Tree Editor</h3>
        <Button size="sm" variant="outline" onClick={addNode} className="h-7 text-xs">
          <Plus size={14} className="mr-1" /> Thêm Node
        </Button>
      </div>

      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {nodeArr.map((n) => {
          const isEnding = n.isEnding;
          const endingMeta = ENDING_TYPES[n.endingType];
          return (
            <div
              key={n.id}
              className={`rounded-lg border p-3 cursor-pointer transition hover:border-primary ${editingId === n.id ? 'border-primary bg-accent/40' : 'border-border'}`}
              onClick={() => setEditingId(n.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="text-[11px] px-1.5 py-0.5 rounded bg-muted font-mono">{n.id}</code>
                    {n.id === 'start_node' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600">BẮT ĐẦU</span>}
                    {isEnding && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1" style={{ background: (endingMeta?.color || '#888') + '22', color: endingMeta?.color }}>
                        <Flag size={10} /> {endingMeta?.label || n.endingType}
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-1 line-clamp-2 text-muted-foreground">
                    <b className="text-foreground">{n.speaker}:</b> {n.text}
                  </p>
                  <p className="text-[10px] mt-1 text-muted-foreground">{(n.choices || []).length} lựa chọn</p>
                </div>
                <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(n.id)}>
                    <Edit3 size={14} />
                  </Button>
                  {n.id !== 'start_node' && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteNode(n.id)}>
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <NodeEditorDrawer
        node={editingNode}
        allNodes={nodes}
        statsConfig={gameData.meta.statsConfig || []}
        archetype={gameData.meta.archetype}
        defaultNpcAvatar={gameData.meta.defaultNpcAvatar}
        open={!!editingNode}
        onClose={() => setEditingId(null)}
        onChange={(patch) => updateNode(editingId, patch)}
      />
    </section>
  );
}