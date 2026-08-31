import {useState,useRef} from 'react';
import {setCardPosition} from '@/lib/gameStudio/canvasEditing';
import {connectFromCard} from '@/lib/gameStudio/mapConnections';
export default function useMapCanvas(game,onChange,zoom,enabled,onError) {
 const canvas=useRef(null),drag=useRef(null),latest=useRef(game);latest.current=game;
 const [preview,setPreview]=useState(null),[creation,setCreation]=useState(null);
 const point=e=>{const rect=canvas.current.getBoundingClientRect();return {x:Math.max(0,(e.clientX-rect.left)/zoom),y:Math.max(0,(e.clientY-rect.top)/zoom)};};
 function begin(e,card,source=null){
  if(!enabled||e.button!==0||e.currentTarget.closest('fieldset:disabled')||!['scene','intro','ending','choice'].includes(card.kind))return;
  e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);
  drag.current={card,source,start:point(e),snapshot:JSON.stringify(latest.current.nodes),capture:e.currentTarget};
 }
 function move(e){if(!drag.current)return;const d=drag.current,p=point(e);setPreview(d.source?{kind:'link',from:{x:d.card.x+310,y:d.card.y+108},to:p}:{kind:'move',key:d.card.key,x:Math.max(0,d.card.x+p.x-d.start.x),y:Math.max(0,d.card.y+p.y-d.start.y)});}
 function finish(e){
  const d=drag.current;if(!d)return;drag.current=null;setPreview(null);
  try{if(d.snapshot!==JSON.stringify(latest.current.nodes))throw new Error('Sơ đồ vừa thay đổi, hãy kéo lại để tránh sửa nhầm.');
   if(d.source){
    const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-canvas-scene]');
    if(target){onChange(connectFromCard(latest.current,{...d.source,targetId:target.getAttribute('data-canvas-scene')}).game);}
    else if(document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-map-surface]')&&!document.elementFromPoint(e.clientX,e.clientY)?.closest('article'))setCreation({...point(e),source:d.source});
   }else{const p=point(e);if(Math.hypot(p.x-d.start.x,p.y-d.start.y)>3)onChange(setCardPosition(latest.current,d.card,{x:d.card.x+p.x-d.start.x,y:d.card.y+p.y-d.start.y}));}
  }catch(error){onError(error.message);}
 }
 function cancel(){drag.current=null;setPreview(null);}
 function addHere(e){if(!enabled||e.target.closest('article,button,input,select,textarea'))return;e.preventDefault();setCreation(point(e));}
 return {canvas,preview,creation,setCreation,begin,move,finish,cancel,addHere};
}
