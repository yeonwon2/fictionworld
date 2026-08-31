import React,{useState} from 'react';
import {Dialog,DialogContent,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {createCanvasScene} from '@/lib/gameStudio/canvasEditing';
export default function CanvasSceneDialog({game,at,onApply,onClose}){
 const [count,setCount]=useState(4),[role,setRole]=useState('main'),[title,setTitle]=useState(''),[error,setError]=useState('');
 const [snapshot]=useState(()=>JSON.stringify(game.nodes));
 return <Dialog open onOpenChange={v=>!v&&onClose()}><DialogContent><DialogHeader><DialogTitle>Thêm cảnh tại đây</DialogTitle></DialogHeader><label>Loại cảnh<select className="w-full border rounded p-2 bg-background" value={role} onChange={e=>setRole(e.target.value)}><option value="main">Cảnh chính</option><option value="side">Cảnh phụ</option><option value="ending">Kết thúc</option></select></label><label>Tên cảnh<input className="w-full border rounded p-2 bg-background" value={title} onChange={e=>setTitle(e.target.value)}/></label>{role!=='ending'&&<label>Số đáp án<input type="number" min={0} max={12} className="w-full border rounded p-2 bg-background" value={count} onChange={e=>setCount(Number(e.target.value))}/></label>}<p className="text-sm">Chỉ tạo một cảnh và số đáp án đã chọn, ngay tại vị trí chuột.{at.source?' Tự nối đường vừa kéo vào cảnh mới.':' Chưa nối vào cảnh khác.'}</p>{error&&<p role="alert">{error}</p>}<Button onClick={()=>{try{if(snapshot!==JSON.stringify(game.nodes))throw new Error('Sơ đồ đã thay đổi, hãy mở lại cửa sổ.');onApply(createCanvasScene(game,at,{count:role==='ending'?0:count,role,title,source:at.source}));onClose();}catch(e){setError(e.message);}}}>Tạo cảnh tại đây</Button></DialogContent></Dialog>;
}
