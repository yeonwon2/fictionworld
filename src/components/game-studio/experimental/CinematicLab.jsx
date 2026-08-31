import useLabAudio from './useLabAudio';
import LabAudioPanel from './LabAudioPanel';
import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, RotateCcw, X, Smartphone, Monitor, Settings2, Menu, LogOut } from 'lucide-react';
import { createPortal } from 'react-dom';
import { longPassage, extraChoices, demoStats, demoTransition } from './cinematicDemo';
import {genreDemos,pickDemoEnding} from './genreDemos';
import {GenreSceneFrame,GenreEnding} from './GenrePresentation';
import './cinematic-lab.css';
import './genre-layouts.css';
import './pattern-themes.css';

// Deliberately isolated demo: no game props, persistence, AI, or production player imports.
export default function CinematicLab({onBack}) {
 const [genreId,setGenreId]=useState('cinema');
 const audio=useLabAudio(genreDemos[genreId].audio||genreId);
 return <GenreLab audio={audio} key={genreId} genre={genreDemos[genreId]} onGenre={setGenreId} onBack={onBack}/>;
}
function GenreLab({ onBack,genre,onGenre,audio }) {
  const scenes=genre.scenes;
  const [endingPreview,setEndingPreview]=useState(null),[systemText,setSystemText]=useState(genre.system||'');
  const [device,setDevice]=useState('desktop'),[step,setStep]=useState(0);
  const [mode,setMode]=useState('short'),[stats,setStats]=useState(()=>Object.fromEntries(genre.stats.map(s=>[s.key,s.initial])));
  const [draft,setDraft]=useState(''),[customText,setCustomText]=useState('');
  const many = mode==='many' || mode==='full', long = mode==='long' || mode==='full';
  const definitions = genre.id==='cinema' && many ? demoStats : genre.stats;
  const publicStats = definitions.filter(s=>!s.hidden);
  const [log,setLog]=useState([]),[notice,setNotice]=useState(''),[panel,setPanel]=useState(genre.system?'system':null),[large,setLarge]=useState(false);
  const content = useRef(null), previousStep = useRef(0);
  const gameFrame=useRef(null), headerFrame=useRef(null);
  const [fixedHeader,setFixedHeader]=useState(null);
  useEffect(()=>{
    const measure=()=>{
      if(!gameFrame.current||!headerFrame.current)return;
      const gameRect=gameFrame.current.getBoundingClientRect(), headerRect=headerFrame.current.getBoundingClientRect();
      const toolbar=gameFrame.current.closest('main')?.firstElementChild?.getBoundingClientRect();
      const top=Math.max(0,Math.min(80,toolbar?.bottom||0));
      const next=headerRect.top<top && gameRect.bottom>top+headerRect.height ? {left:gameRect.left,width:gameRect.width,top} : null;
      setFixedHeader(old=>JSON.stringify(old)===JSON.stringify(next)?old:next);
    };
    window.addEventListener('scroll',measure,true);window.addEventListener('resize',measure);
    const observer=new ResizeObserver(measure);observer.observe(gameFrame.current);measure();
    return ()=>{window.removeEventListener('scroll',measure,true);window.removeEventListener('resize',measure);observer.disconnect();};
  },[]);
  useEffect(() => { if(previousStep.current !== step) content.current?.scrollIntoView({block:'start',behavior:'instant'}); previousStep.current=step; },[step]);
  const scene=scenes[Math.min(step,scenes.length-1)],ended=step>=scenes.length || endingPreview!==null;
  const reset=()=>{setStep(0);setStats(Object.fromEntries(definitions.map(s=>[s.key,s.initial])));setLog([]);setNotice('');setPanel(genre.system?'system':null);setSystemText(genre.system||'');setEndingPreview(null);};
  const paragraphs = step===0 && customText.trim() ? customText.split(/\n+/).filter(p=>p.trim()) : long && step===0 ? [...scene.paragraphs,...longPassage] : scene.paragraphs;
  const choices = long ? [...scene.choices,...extraChoices] : scene.choices;
  const endingOptions=[...genre.endings,...(genre.deathEnding?[genre.deathEnding]:[])];
  const ending=endingPreview!==null?endingOptions[endingPreview]:pickDemoEnding(genre,stats);
  const currentEntry = ended ? {...ending, place:'Hồi kết', time:'Kết thúc bản trải nghiệm mẫu'} : {title:scene.title,place:scene.place,time:scene.time,paragraphs:[...paragraphs],quote:scene.quote};
  const journal = [...log, ...(endingPreview!==null?[]:[{...currentEntry, current:true}])];
  const panelTitle = {audio:'Âm thanh',system:'Thông báo hệ thống',menu:'Menu game',journal:'Nhật ký hành trình',settings:'Cài đặt đọc',restart:'Chơi lại từ đầu?',exit:'Thoát game?'}[panel];
  const choose=choice=>{
    if(ended)return;
    const result=demoTransition(stats,choice,definitions);
    if(genre.death)result.stats[genre.death]=Math.max(0,result.stats[genre.death]);
    const reachedEnding=step+1>=scenes.length||(genre.death&&result.stats[genre.death]<=0);
    if(reachedEnding){const e=pickDemoEnding(genre,result.stats);audio.play(e===genre.deathEnding||e===genre.endings.at(-1)?'bad':'good');}
    else audio.play(choice.systemText?'system':'choice');
    setStats(result.stats);
    setLog(items=>[...items,{...currentEntry,chosenText:choice.text,feedback:result.notice,systemMessage:choice.systemText||''}]);
    setNotice(result.notice);setStep(n=>genre.death&&result.stats[genre.death]<=0?scenes.length:n+1);
    if(choice.systemText){setSystemText(choice.systemText+(result.notice?' '+result.notice:''));setPanel('system');}
  };
  const headerContents=<><div className="cl-wordmark">FICTION WORLD<span>{genre.title.toUpperCase()}</span></div><button className="cl-menu-trigger" aria-label="Menu game" aria-haspopup="dialog" onClick={()=>setPanel('menu')}><Menu size={19}/><span>Menu</span></button></>;
  return <div className={`cinema-lab cl-genre-${genre.id} ${genre.pattern?'cl-pattern':''}`}>
    <header className="cl-tools"><button onClick={onBack}><ArrowLeft size={16}/> Về xưởng</button><div><strong>Giao diện thử nghiệm</strong><p>Mới · 4 theme hoạ tiết không dùng ảnh trong Bộ giao diện</p></div><div className="cl-device" aria-label="Kích thước xem thử"><button aria-label="Xem điện thoại" aria-pressed={device==='mobile'} onClick={()=>setDevice('mobile')}><Smartphone size={17}/></button><button aria-label="Xem máy tính" aria-pressed={device==='desktop'} onClick={()=>setDevice('desktop')}><Monitor size={17}/></button></div></header>
    <div className="cl-genre-picker"><label>Bộ giao diện<select value={genre.id} onChange={e=>onGenre(e.target.value)}>{Object.values(genreDemos).map(g=><option value={g.id} key={g.id}>{g.label}</option>)}</select></label><p>{genre.description}</p><small>Đổi bộ giao diện sẽ bắt đầu lại bản mẫu, không ảnh hưởng game đã lưu.</small></div>
    <div className="cl-samples"><label>Xem trước kết thúc<select value={endingPreview??''} onChange={e=>{setEndingPreview(e.target.value===''?null:Number(e.target.value));setNotice('');if(e.target.value!==''){const ending=endingOptions[Number(e.target.value)];audio.play(ending===genre.deathEnding||ending===genre.endings.at(-1)?'bad':'good');}}}><option value="">Theo lượt đang chơi</option>{endingOptions.map((e,i)=><option key={i} value={i}>{e.label} · {e.title}</option>)}</select></label></div>
    {genre.id==='cinema'&&<div className="cl-samples"><label>Tình huống thử<select value={mode} onChange={e=>{reset();setMode(e.target.value);setCustomText('');}}><option value="short">Truyện ngắn · 2 chỉ số</option><option value="long">Truyện dài · 8 đáp án dài</option><option value="many">12 chỉ số · Trong menu</option><option value="full">Truyện dài + 12 chỉ số</option></select></label><span>Đổi tình huống sẽ bắt đầu lại bản mẫu.</span></div>}
    <details className="cl-custom"><summary>Thử bằng đoạn truyện của bạn (chỉ trong bản mẫu)</summary><label>Dán nội dung cảnh đầu<textarea rows={5} value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Mỗi lần xuống dòng là một đoạn. Không cắt hoặc rút gọn nội dung."/></label><button onClick={()=>{setCustomText(draft);reset();}}>Xem đoạn này</button><p>Chỉ thay văn bản cảnh đầu; đáp án và luật vẫn là dữ liệu mẫu. Không gửi nội dung tới AI.</p></details>
    <div className={`cl-stage ${device==='mobile'?'cl-mobile':''}`}>
      <section ref={gameFrame} className={`cl-game ${large?'cl-large':''}`} aria-label={`Bản chơi mẫu ${genre.label}`}>
        {genre.art&&<><div className="cl-art" style={{backgroundImage:`url(${genre.art})`}} aria-hidden="true"/><div className="cl-shade" aria-hidden="true"/></>}
        <header ref={headerFrame} className="cl-top" style={{visibility:fixedHeader?'hidden':undefined}}>{headerContents}</header>
        {fixedHeader&&createPortal(<div className={`cinema-lab cl-fixed-chrome cl-genre-${genre.id} ${genre.pattern?'cl-pattern':''}`} style={{...fixedHeader,position:'fixed',padding:0,zIndex:35}}><header className="cl-top">{headerContents}</header></div>,document.body)}
        <div ref={content} className="cl-reading-anchor" key={`${step}:${endingPreview}`}>
        {ended?<GenreEnding genre={genre} ending={ending} preview={endingPreview!==null} stats={stats} definitions={definitions} onRestart={reset} onExitPreview={()=>setEndingPreview(null)} onJournal={()=>setPanel('journal')}><h1>{ending.title}</h1><div className="cl-prose">{ending.paragraphs.map((p,i)=><p key={i}>{p}</p>)}<blockquote>“{ending.quote}”</blockquote></div></GenreEnding>:<GenreSceneFrame genre={genre} step={step} log={log}><div className="cl-content">
          <div className="cl-chapter"><span>{`CHƯƠNG 01 / ${String(step+1).padStart(2,'0')}`}</span><i/><span>{scene.place}</span></div>
          <h1>{currentEntry.title}</h1><p className="cl-time">{scene.time}</p>
          <div className="cl-prose">{currentEntry.paragraphs.map((p,i)=><p key={i}>{p}</p>)}<blockquote>“{currentEntry.quote}”</blockquote></div>
          <div className="cl-choices"><p className="cl-prompt">BẠN SẼ LÀM GÌ TIẾP THEO?</p>{choices.map((choice,i)=><button key={choice.text} onClick={()=>choose(choice)}><span className="cl-letter">{String.fromCharCode(65+i)}</span><span>{choice.text}</span><ArrowRight size={16}/></button>)}</div>
        </div></GenreSceneFrame>}
        </div>
        {notice&&<div className="cl-notice" role="status"><span>{notice}</span><button aria-label="Ẩn thông báo điểm" onClick={()=>setNotice('')}><X size={14}/></button></div>}
        {panel&&createPortal(<div className={`cinema-lab cl-genre-${genre.id} ${genre.pattern?'cl-pattern':''}`} style={{padding:0}}><div className="cl-modal" role="dialog" aria-modal="true" aria-label={panelTitle} onKeyDown={e=>{if(e.key==='Escape')setPanel(null); if(e.key==='Tab'){const items=e.currentTarget.querySelectorAll('button:not(:disabled),input:not(:disabled),summary'); const first=items[0],last=items[items.length-1]; if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}}><div className={`cl-modal-card ${panel==='journal'?'cl-journal':''} ${large?'cl-large':''}`}><button autoFocus className="cl-close" aria-label="Đóng bảng" onClick={()=>setPanel(null)}><X size={20}/></button><>{panel!=='menu'&&panel!=='system'&&<button className="cl-menu-back" onClick={()=>setPanel('menu')}><ArrowLeft size={15}/> Menu game</button>}</><h2>{panelTitle}</h2>{panel==='audio'?<LabAudioPanel audio={audio} genre={genre.audio||genre.id}/>:panel==='system'?<><div className="cl-system-message"><strong>HỆ THỐNG · CẬP NHẬT</strong><p>{systemText}</p></div><div className="cl-menu-links"><button onClick={()=>setPanel(null)}>Đã hiểu · Tiếp tục</button></div></>:panel==='menu'?<><div className="cl-menu-links"><button onClick={()=>setPanel('journal')}><BookOpen size={17}/> Nhật ký hành trình</button><button onClick={()=>setPanel('audio')}>♫ Âm thanh {audio.enabled?'· Đang bật':'· Đang tắt'}</button><button onClick={()=>setPanel('settings')}><Settings2 size={17}/> Cài đặt đọc</button><button onClick={()=>setPanel('restart')}><RotateCcw size={17}/> Chơi lại</button><button onClick={()=>setPanel('exit')}><LogOut size={17}/> Thoát game</button></div><h3 className="cl-menu-label">Chỉ số nhân vật</h3><div className="cl-stat-list">{publicStats.map(s=><div className="cl-stat-row" key={s.key}><span>{s.label}</span><b>{(stats[s.key] ?? s.initial).toLocaleString('vi-VN')}</b></div>)}</div></>:panel==='journal'?<><p>Toàn bộ nội dung đã đi qua, theo thứ tự. Bấm tên cảnh để thu gọn hoặc mở lại; đọc nhật ký không thay đổi lượt chơi.</p>{journal.map((item,i)=><details open className="cl-journal-entry" key={i}><summary>{i+1}. {item.title}{item.current?' · Đang xem':''}</summary><small>{item.place} · {item.time}</small><div className="cl-prose">{item.paragraphs.map((p,j)=><p key={j}>{p}</p>)}{item.quote&&<blockquote>“{item.quote}”</blockquote>}</div>{item.systemMessage&&<p className="cl-system-journal">Hệ thống: {item.systemMessage}</p>}{item.chosenText&&<div className="cl-journal-choice"><strong>Bạn đã chọn</strong><p>{item.chosenText}</p>{item.feedback&&<small>{item.feedback}</small>}</div>}</details>)}</>:panel==='restart'||panel==='exit'?<><p>{panel==='restart'?'Bắt đầu lại từ cảnh đầu? Điểm và nhật ký của lượt thử này sẽ được xóa.':'Trở về xưởng và kết thúc lượt thử này? Tiến trình bản mẫu không được lưu; game và theme đang có không bị thay đổi.'}</p><div className="cl-menu-links"><button onClick={panel==='restart'?reset:onBack}>{panel==='restart'?'Chơi lại từ đầu':'Thoát về xưởng'}</button><button onClick={()=>setPanel('menu')}>Tiếp tục chơi</button></div></>:<><label><input type="checkbox" checked={large} onChange={e=>setLarge(e.target.checked)}/> Chữ lớn, dễ đọc</label><p>Âm thanh được điều chỉnh riêng trong Menu game → Âm thanh. Bản mẫu không tự động chạy chữ.</p></>}</div></div></div>,document.body)}
      </section>
    </div>
    <p className="cl-footnote">Bản thử bố cục độc lập · Cuộn đọc toàn bộ, không cắt chữ · Chọn tình huống phía trên để thử · Chưa áp dụng vào theme, game đã lưu hoặc bản xuất. {genre.pattern?'Mẫu này không dùng ảnh, font tải ngoài hoặc tài nguyên mạng.':'Hình minh họa tạm dùng tài nguyên sẵn có.'}</p>
  </div>;
}
