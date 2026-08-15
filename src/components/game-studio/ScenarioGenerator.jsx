import React, { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Loader2 } from 'lucide-react';
import { generateGameScenario } from '@/lib/gameStudio/generator';
import { useToast } from '@/components/ui/use-toast';

export default function ScenarioGenerator({ gameData, setGameData, onGenerated }) {
  const [prompt, setPrompt] = useState('');
  const [length, setLength] = useState('medium');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({ variant: 'destructive', title: 'Thiếu bối cảnh', description: 'Hãy nhập bối cảnh & phân cảnh mở đầu.' });
      return;
    }
    setLoading(true);
    try {
      const data = await generateGameScenario({
        prompt,
        length,
        meta: {
          title: gameData.meta.title,
          author: gameData.meta.author,
          genre: gameData.meta.genre,
          theme: gameData.meta.theme,
          archetype: gameData.meta.archetype,
          player_name: gameData.meta.player_name,
          playerAvatar: gameData.meta.playerAvatar,
          statsConfig: gameData.meta.statsConfig,
          initialStats: gameData.meta.initialStats,
          litrpg: gameData.meta.litrpg,
          mystery: gameData.meta.mystery,
        },
      });
      setGameData(data);
      onGenerated && onGenerated(data);
      toast({ title: 'Khởi tạo thành công!', description: `Đã sinh ${Object.keys(data.nodes || {}).length} phân cảnh theo archetype "${gameData.meta.archetype}".` });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Lỗi tạo kịch bản', description: e.message || 'Vui lòng thử lại.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="glass-card rounded-2xl p-4 sm:p-5 space-y-3">
      <h3 className="font-semibold text-sm flex items-center gap-2"><Sparkles size={15} /> AI Tạo Nhanh Kịch Bản</h3>
      <div className="space-y-1.5">
        <Label className="text-xs">Bối cảnh & phân cảnh mở đầu</Label>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder="Ví dụ: Bạn là một kiếm khách trẻ tuổi lạc bước vào Vụ Sơn phái, đêm trăng máu cánh cổng sắt kêu kẽo kẹt..."
        />
      </div>
      <div className="flex items-end gap-3">
        <div className="space-y-1.5 w-44">
          <Label className="text-xs">Độ dài kịch bản</Label>
          <Select value={length} onValueChange={setLength}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="short">Ngắn (~12 phân cảnh, ≥4 bước)</SelectItem>
              <SelectItem value="medium">Trung bình (~20 phân cảnh, ≥5 bước)</SelectItem>
              <SelectItem value="long">Dài (~28 phân cảnh, ≥7 bước)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleGenerate} disabled={loading} className="flex-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700">
          {loading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Sparkles size={16} className="mr-2" />}
          {loading ? 'Đang khởi tạo...' : 'Khởi tạo Toàn bộ Game'}
        </Button>
      </div>
      {gameData.meta.archetype && gameData.meta.archetype !== 'none' && (
        <p className="text-[11px] text-violet-600 bg-violet-500/10 rounded p-2">
          AI sẽ lồng ghép cơ chế của archetype <b>{gameData.meta.archetype}</b> (nhiệm vụ/cảnh giới, hoặc story flags/tri thức, hoặc SAN/túi đồ).
        </p>
      )}
    </section>
  );
}
