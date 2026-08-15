import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Code2, FileJson, Upload, Check } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { generateStandaloneHTML, generateIframeCode } from '@/lib/gameStudio/rpgExport';

export default function ExportCenter({ gameData, setGameData }) {
  const { toast } = useToast();
  const fileRef = useRef(null);
  const [copied, setCopied] = useState(false);

  const downloadHTML = () => {
    const html = generateStandaloneHTML(gameData);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (gameData.meta?.title || 'rpg-game').replace(/[^a-z0-9]/gi, '_') + '.html';
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Đã tải file HTML', description: 'Upload lên host (vd: lilyhub.top) là chạy ngay, 100% offline.' });
  };

  const copyIframe = () => {
    const code = generateIframeCode(gameData);
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast({ title: 'Đã sao chép mã iframe' });
    });
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(gameData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (gameData.meta?.title || 'rpg-game').replace(/[^a-z0-9]/gi, '_') + '.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data.meta || !data.nodes) throw new Error('File JSON không hợp lệ');
        setGameData(data);
        toast({ title: 'Đã nhập kịch bản', description: 'Tải lại thành công.' });
      } catch (err) {
        toast({ variant: 'destructive', title: 'Lỗi import', description: err.message });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <section className="glass-card rounded-2xl p-4 sm:p-5 space-y-3">
      <h3 className="font-semibold text-sm flex items-center gap-2">🚀 Export Center</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Button onClick={downloadHTML} className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700">
          <Download size={15} className="mr-1.5" /> Tải HTML độc lập
        </Button>
        <Button onClick={copyIframe} variant="outline">
          {copied ? <Check size={15} className="mr-1.5 text-emerald-600" /> : <Code2 size={15} className="mr-1.5" />}
          {copied ? 'Đã copy!' : 'Mã nhúng Iframe'}
        </Button>
        <div className="flex gap-2">
          <Button onClick={exportJSON} variant="outline" className="flex-1"><FileJson size={15} className="mr-1.5" />Export JSON</Button>
          <Button onClick={() => fileRef.current?.click()} variant="outline"><Upload size={15} /></Button>
          <Input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={importJSON} />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        File HTML đóng gói toàn bộ engine + dữ liệu, chạy độc lập không cần server. Iframe nhúng trực tiếp vào bất kỳ trang web nào.
      </p>
    </section>
  );
}