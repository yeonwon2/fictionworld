import React from 'react';
import {Crown, Feather, Fingerprint, Cpu, BriefcaseBusiness, Heart, CheckCircle2, Mail, Orbit, Gem, Music2} from 'lucide-react';
const icons={letters:Mail,jade:Gem,orbit:Orbit,nocturne:Music2,cinema:Heart,storybook:Feather,system:Cpu,mystery:Fingerprint,palace:Crown,tycoon:BriefcaseBusiness};
export function GenreSceneFrame({genre,step,log,children}) {
  return <div className={`cl-scene-layout cl-layout-${genre.id}`}>
    {genre.id==='palace'&&<div className="cl-court-heading"><Crown size={28}/><span>CHIÊU HOA ĐIỆN</span><i>Nhất ngôn · Nhất mệnh</i></div>}
    {genre.id==='storybook'&&<div className="cl-book-edge" aria-hidden="true">NGƯỜI GIỮ MÙA XUÂN</div>}
    {genre.id==='mystery'&&<div className="cl-case-label"><Fingerprint size={26}/><span>HỒ SƠ 014<br/><small>Ghi chép hiện trường · Phần {step+1}</small></span></div>}
    {genre.pattern&&<div className="cl-pattern-heading"><span>{genre.kicker}</span><PatternMark kind={genre.motif}/><small>0{step+1} / 02</small></div>}
    {children}
    {genre.id==='system'&&<aside className="cl-mission"><div className="cl-rail-title"><Cpu size={20}/><span>NHIỆM VỤ CHÍNH</span></div><h3>Thoát khỏi tháp ký ức</h3><p>Giải mã dữ liệu và rời tháp với sinh lực còn lại.</p><ol><li className={step>0?'cl-done':''}>{step>0?<CheckCircle2 size={15}/>:<span>01</span>} Vượt phòng đầu tiên</li><li><span>02</span> Khôi phục kho ký ức</li></ol><div className="cl-mission-note">Sinh lực về 0 sẽ kết thúc lượt thử. Mở Menu để xem chỉ số.</div></aside>}
    {genre.id==='tycoon'&&<aside className="cl-ledger"><div className="cl-rail-title"><BriefcaseBusiness size={20}/><span>SỔ THƯƠNG VỤ</span></div><h3>1998<span>Năm bắt đầu lại</span></h3><div className="cl-ledger-item"><small>Đang xem</small><strong>Thương vụ {step+1}</strong></div><div className="cl-ledger-item"><small>Quyết định gần nhất</small><p>{log.at(-1)?.chosenText||'Chưa đưa ra quyết định.'}</p></div><p className="cl-ledger-note">Vốn và tài sản được cập nhật sau mỗi lựa chọn. Xem trong Menu.</p></aside>}
  </div>;
}
export function GenreEnding({genre,ending,preview,stats,definitions,onRestart,onExitPreview,onJournal,children}) {
 const Icon=icons[genre.id]||Heart;
 return <div className={`cl-ending cl-ending-${genre.id} ${ending===genre.deathEnding?'cl-ending-failure':''}`}>
  <div className="cl-ending-emblem"><Icon size={38}/></div>
  <p className="cl-ending-eyebrow">{genre.id==='system'?'TỔNG KẾT NHIỆM VỤ':genre.id==='tycoon'?'BÁO CÁO HÀNH TRÌNH':genre.id==='mystery'?'KẾT LUẬN HỒ SƠ':genre.id==='palace'?'CHIẾU THƯ':genre.id==='storybook'?'TRANG CUỐI CỦA CÂU CHUYỆN':'HỒI KẾT'}</p>
  <span className="cl-ending-badge">{ending.label}</span>
  {preview&&<p className="cl-preview-label">Xem trước thiết kế · Không thay đổi lượt chơi</p>}
  {children}
  {!preview&&<div className="cl-ending-totals">{definitions.filter(s=>!s.hidden).slice(0,3).map(s=><div key={s.key}><small>{s.label}</small><strong>{(stats[s.key]??s.initial).toLocaleString('vi-VN')}</strong></div>)}</div>}
  <div className="cl-ending-actions">{preview?<button onClick={onExitPreview}>Về cảnh đang chơi</button>:<><button onClick={onRestart}>Chơi lại</button><button onClick={onJournal}>Đọc lại hành trình</button></>}</div>
 </div>;
}

function PatternMark({kind}) {
 return <svg className="cl-pattern-mark" viewBox="0 0 200 60" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
 {kind==='letter'?<><path d="M0 30h60m80 0h60M75 15h50v32H75zM75 15l25 20 25-20"/><path d="M82 47l12-15m24 15-12-15"/></>:kind==='jade'?<><path d="M0 30h60l15-15 25 15 25-15 15 15h60M60 30l15 15 25-15 25 15 15-15"/><circle cx="100" cy="30" r="8"/></>:kind==='orbit'?<><ellipse cx="100" cy="30" rx="70" ry="16"/><ellipse cx="100" cy="30" rx="35" ry="26"/><path d="M0 30h200M100 0v60"/><circle cx="100" cy="30" r="7"/><circle cx="164" cy="23" r="3" fill="currentColor"/></>:<><path d="M0 45h55l45-40 45 40h55M25 50h40l35-32 35 32h40M80 55l20-23 20 23M100 5v50"/></>}
 </svg>;
}
