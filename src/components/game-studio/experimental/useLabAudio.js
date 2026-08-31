import {useEffect,useRef,useState} from 'react';
import {LabAudio} from './labAudio';
export default function useLabAudio(genre){
 const engine=useRef(null),[enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[background,setBackground]=useState(25),[effects,setEffects]=useState(45);
 useEffect(()=>{const instance=new LabAudio();engine.current=instance;const visibility=()=>instance.setHidden(document.hidden);document.addEventListener('visibilitychange',visibility);visibility();return()=>{document.removeEventListener('visibilitychange',visibility);instance.dispose();};},[]);
 useEffect(()=>{engine.current?.setGenre(genre);},[genre]);
 const toggle=async()=>{setError('');if(enabled){engine.current?.disable();setEnabled(false);return;}setBusy(true);try{await engine.current.enable();setEnabled(engine.current.enabled);}catch(e){setError(e.message||'Chưa phát được âm thanh. Hãy thử bật lại.');}finally{setBusy(false);}};
 const volume=(kind,value)=>{if(kind==='background')setBackground(value);else setEffects(value);engine.current?.setVolumes((kind==='background'?value:background)/100,(kind==='effects'?value:effects)/100);};
 return {enabled,busy,error,background,effects,toggle,volume,play:kind=>engine.current?.play(kind)};
}
