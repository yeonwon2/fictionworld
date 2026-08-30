import React,{useState} from 'react';
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { pasteMapPattern } from '@/lib/gameStudio/mapPatterns';
import { sceneLabel } from '@/lib/gameStudio/mindMap';

export default function PastePatternDialog({ pattern,gameData,onApply,onClose }) {
  const [count,setCount]=useState(1),[keepContent,setKeepContent]=useState(false),[chain,setChain]=useState(false);
  const [entryId,setEntryId]=useState(pattern.ids[0]),[exits,setExits]=useState(pattern.exits.map(p=>p.token));
  const [target,setTarget]=useState(''),[keepExternal,setKeepExternal]=useState(false),[error,setError]=useState('');
  return <Dialog open onOpenChange={open=>!open&&onClose()}><DialogContent className="max-w-xl max-h-[90vh] overflow-auto"><DialogHeader><DialogTitle>Dán nhóm cảnh đã sao chép</DialogTitle><DialogDescription>{pattern.ids.length} cảnh và các đáp án đi kèm. Đường nối bên trong nhóm được giữ đúng bằng mã cảnh mới.</DialogDescription></DialogHeader>
    <label className="text-sm">Số nhóm cần dán<input className="block rounded border p-2 bg-background w-24" type="number" min={1} max={30} value={count} onChange={e=>setCount(Number(e.target.value))}/></label>
    <label className="flex gap-2 text-sm"><input type="checkbox" checked={keepContent} onChange={e=>setKeepContent(e.target.checked)}/>Giữ cả văn bản cũ (bỏ chọn để AI viết nội dung mới)</label>
    <label className="flex gap-2 text-sm"><input type="checkbox" checked={chain} onChange={e=>setChain(e.target.checked)}/>Nối các nhóm thành một chuỗi liên tiếp</label>
    {chain&&<div className="rounded border p-3 space-y-3"><label className="block text-sm">Cảnh đầu mỗi nhóm<select className="w-full block border rounded p-2 bg-background" value={entryId} onChange={e=>setEntryId(e.target.value)}>{pattern.ids.map(id=><option key={id} value={id}>{sceneLabel(id,pattern.nodes[id])}</option>)}</select></label><p className="text-sm font-semibold">Đáp án cuối nhóm sẽ nối sang nhóm kế</p><div className="max-h-40 overflow-auto space-y-2">{pattern.exits.map(p=><label key={p.token} className="flex gap-2 text-xs"><input type="checkbox" checked={exits.includes(p.token)} onChange={()=>setExits(prev=>prev.includes(p.token)?prev.filter(k=>k!==p.token):[...prev,p.token])}/>{sceneLabel(p.sourceId,pattern.nodes[p.sourceId])} · {p.label}</label>)}{!pattern.exits.length&&<p className="text-xs text-amber-700">Nhóm không có đường ra. Hãy sao chép nhóm có đáp án cuối để trống hoặc dẫn ra ngoài nhóm.</p>}</div><label className="block text-sm">Sau nhóm cuối<select className="w-full block border rounded p-2 bg-background" value={target} onChange={e=>setTarget(e.target.value)}><option value="">Chưa nối — tôi nối kết thúc sau</option>{Object.entries(gameData.nodes).map(([id,n])=><option key={id} value={id}>{sceneLabel(id,n)}</option>)}</select></label></div>}
    <label className="flex gap-2 text-sm"><input type="checkbox" checked={keepExternal} onChange={e=>setKeepExternal(e.target.checked)}/>Giữ các đường khác đang dẫn ra ngoài nhóm</label>
    <p className="text-xs text-muted-foreground">Mặc định ngắt các đường ra ngoài để bản sao không chạy ngược về nhóm gốc. Không tự nối từ truyện gốc vào bản sao; sau khi dán, dùng Thêm → Nối nhiều đáp án vào ô đầu nhóm. Điểm, điều kiện, cờ và vật phẩm vẫn được sao chép: hãy rà soát khi dùng cho đoạn truyện mới.</p>
    {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
    <div className="flex gap-2"><Button onClick={()=>{try{onApply(pasteMapPattern(gameData,pattern,{count,keepContent,chain,entryId,exitTokens:exits,finalTarget:target,keepExternal}));onClose();}catch(e){setError(e.message);}}}>Dán {count*pattern.ids.length} cảnh</Button><Button variant="outline" onClick={onClose}>Hủy</Button></div>
  </DialogContent></Dialog>;
}
