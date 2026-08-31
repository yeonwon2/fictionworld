// Presentation only: never change stats, archetype, graph, or ending rules.
const theme=(id,name,bg,text,muted,accent,line,pattern,art='')=>({id,name,art,pattern,vars:{
 '--rpg-bg':bg,'--rpg-panel':bg,'--rpg-panel-2':bg,'--rpg-text':text,'--rpg-muted':muted,
 '--rpg-accent':accent,'--rpg-accent2':accent,'--rpg-border':line,'--rpg-font':"Georgia, 'Times New Roman', serif",
 '--rpg-btn-radius':'2px','--rpg-bg-image':pattern,
}});
export const READING_THEMES={
 letters:theme('letters','Thư gửi ngày mai · Hiện đại','#fcf8f0','#313d43','#65615a','#795346','#c7baaa','radial-gradient(#7953461a .8px,transparent .8px)'),
 jade:theme('jade','Ngọc giản · Cổ trang','#edf0e5','#243f38','#56685e','#7d4036','#9aac97','repeating-linear-gradient(45deg,transparent 0 18px,#41655212 18px 19px),repeating-linear-gradient(-45deg,transparent 0 18px,#41655212 18px 19px)'),
 orbit:theme('orbit','Quỹ đạo · Viễn tưởng','#0e1d2b','#e2eff6','#a8c1d0','#8de2e2','#416879','linear-gradient(#41687926 1px,transparent 1px),linear-gradient(90deg,#41687926 1px,transparent 1px)'),
 nocturne:theme('nocturne','Dạ khúc · Đô thị huyền bí','#251d2b','#f2e5d4','#c7b5b3','#e3bf83','#8d7257','repeating-conic-gradient(from 0deg at 0% 50%,transparent 0deg 12deg,#e3bf8310 12deg 12.5deg,transparent 12.5deg 24deg)'),
 cinema:theme('cinema','Điện ảnh · Tình cảm','#111b20','#f4ead8','#c1b9ab','#dfc18d','#7d7057','none','/hero-transmigration.jpg'),
 storybook:theme('storybook','Trang sách · Cổ tích','#eee0c3','#392e24','#78644a','#775a31','#bba37c','none','/hero-transmigration.jpg'),
 system:theme('system','Hệ thống RPG','#091820','#d9f2ef','#acc4c6','#94d9dc','#497e87','none','/hero-adventure.jpg'),
 mystery:theme('mystery','Bí ẩn · Điều tra','#101316','#e7dfdb','#bdaea8','#c7ada3','#80594e','none','/hero-detective.jpg'),
 palace:theme('palace','Cung đấu','#21170f','#f2dfb2','#c9b790','#e1c78e','#b2945c','none','/hero-transmigration.jpg'),
 tycoon:theme('tycoon','Trọng sinh · Làm giàu','#10201f','#c6d9d1','#99b8ab','#9dd9c0','#719984','none','/hero-system.jpg'),
};
export function getReadingTheme(meta){return READING_THEMES[meta?.readingTheme]||null;}
export const READING_THEME_CSS=`
/* Scoped opt-in styles, shared verbatim by live player and standalone export. */
[data-reading-theme]{font-family:var(--rpg-font);background-color:var(--rpg-bg);color:var(--rpg-text);}
.rpg-root[data-reading-theme]{height:min(850px,90dvh);min-height:480px;overflow:auto!important;isolation:isolate;}
[data-reading-theme] .rpg-reading-backdrop{position:absolute;inset:0;min-height:100%;z-index:-1;pointer-events:none;background-size:cover;background-position:center top;opacity:.18;}
[data-reading-theme] .rpg-reading-body{padding:0!important;gap:20px!important;}
[data-reading-theme] .rpg-topbar{position:sticky;top:0;z-index:20;background:var(--rpg-bg);border-radius:0;border-bottom:1px solid var(--rpg-border);padding:18px 24px;backdrop-filter:none;}
[data-reading-theme] .rpg-topbar-title,[data-reading-theme] .rpg-playername{color:var(--rpg-accent);font-family:var(--rpg-font);letter-spacing:1.5px;}
[data-reading-theme] .rpg-topbar-avatar,[data-reading-theme] .rpg-topbar>.rpg-avatar,[data-reading-theme] .rpg-topbar-points,[data-reading-theme] .rpg-stats-compact,[data-reading-theme] .rpg-fullscreen-btn,[data-reading-theme] .rpg-save-state{display:none;}
[data-reading-theme] .rpg-topbar-btn{color:var(--rpg-text);background:var(--rpg-panel);border:1px solid var(--rpg-border);border-radius:6px;min-width:44px;min-height:44px;}
[data-reading-theme] .rpg-vn-skip{display:none;}
[data-reading-theme] .rpg-vn-frame{width:calc(100% - 40px);max-width:760px;margin:15px auto 40px;flex:none;background:var(--rpg-panel);border:1px solid var(--rpg-border);padding:30px 34px;overflow:visible;}
[data-reading-theme] .rpg-vn-frame:before{content:'◇ ───── ◇ ───── ◇';display:block;text-align:center;color:var(--rpg-accent);letter-spacing:3px;font-size:16px;padding:0 0 28px;}
[data-reading-theme] .rpg-vn-text-scroll,[data-reading-theme] .rpg-story-timeline{max-height:none!important;height:auto!important;overflow:visible!important;}
[data-reading-theme] .rpg-vn-narration,[data-reading-theme] .rpg-vn-dialogue{background:var(--rpg-panel)!important;border:0;box-shadow:none;backdrop-filter:none;padding:0;}
[data-reading-theme] .rpg-vn-narration-text,[data-reading-theme] .rpg-vn-dialogue-text{font:18px/2 var(--rpg-font);white-space:pre-wrap;overflow-wrap:anywhere;color:var(--rpg-text);}
[data-reading-theme] .rpg-vn-scene{height:auto;max-height:300px;}
[data-reading-theme] .rpg-vn-scene-img{max-height:300px;object-fit:contain;}
[data-reading-theme] .rpg-vn-choices{position:static;max-height:none;overflow:visible;background:transparent;padding:24px 0 0;display:grid;gap:12px;}
[data-reading-theme] .rpg-vn-choice{color:var(--rpg-text);background:var(--rpg-panel);border:1px solid var(--rpg-border);border-radius:2px;padding:17px;box-shadow:none;font:15px/1.7 var(--rpg-font);height:auto;white-space:normal;overflow-wrap:anywhere;}
[data-reading-theme] .rpg-vn-choice:disabled{opacity:.55;}
[data-reading-theme] .rpg-vn-choice:not(:disabled):hover{border-color:var(--rpg-accent);background:color-mix(in srgb,var(--rpg-accent) 10%,var(--rpg-panel));}
[data-reading-theme] .rpg-ending{width:calc(100% - 40px);max-width:720px;margin:40px auto!important;padding:44px 32px!important;border:1px solid var(--rpg-border);border-radius:0!important;background:var(--rpg-panel)!important;color:var(--rpg-text);}
[data-reading-theme] .rpg-ending:before{content:'◇';display:block;text-align:center;color:var(--rpg-accent);font-size:44px;margin-bottom:20px;}
[data-reading-theme] .rpg-ending-text{font:18px/2 var(--rpg-font);white-space:pre-wrap;overflow-wrap:anywhere;}
[data-reading-theme] .rpg-reading-ending-title{font:30px/1.4 var(--rpg-font);color:var(--rpg-accent);text-align:center;}
[data-reading-theme] .rpg-ending button,[data-reading-theme] .rpg-poster-btn{background:var(--rpg-accent)!important;color:var(--rpg-bg)!important;}
[data-reading-theme] .rpg-poster{background-color:var(--rpg-bg);background-image:var(--rpg-bg-image);}
[data-reading-theme] .rpg-poster-title,[data-reading-theme] .rpg-poster-sub,[data-reading-theme] .rpg-poster-bio,[data-reading-theme] .rpg-poster-badge{color:var(--rpg-text);text-shadow:none;}
[data-reading-theme] .rpg-poster-inner{background:var(--rpg-panel);border:4px double var(--rpg-border);padding:40px;}
[data-reading-theme] .rpg-poster-shade{background:transparent;}
[data-reading-theme] .rpg-menu-sheet,[data-reading-theme] .rpg-sheet{background:var(--rpg-panel);color:var(--rpg-text);}
[data-reading-theme] .rpg-menu-history p{display:block;-webkit-line-clamp:unset;overflow:visible;white-space:pre-wrap;font-size:15px;line-height:1.9;}
[data-reading-theme] .rpg-sheet-section p{white-space:pre-wrap;font-size:15px;line-height:1.9;}
[data-reading-theme] button:focus-visible{outline:2px solid var(--rpg-accent);outline-offset:3px;}
[data-reading-theme=letters]{background-size:12px 12px;}
[data-reading-theme=letters] .rpg-vn-frame{border-style:dashed;}
[data-reading-theme=letters] .rpg-vn-frame:before{content:'✉';font-size:32px;}
[data-reading-theme=letters] .rpg-vn-choice{border:0;border-bottom:1px solid var(--rpg-border);font-family:system-ui,sans-serif;}
[data-reading-theme=letters] .rpg-ending{border:1px dashed var(--rpg-border);box-shadow:8px 8px 0 #c7baaa40;}
[data-reading-theme=jade] .rpg-vn-frame,[data-reading-theme=jade] .rpg-ending{border:5px double var(--rpg-border);}
[data-reading-theme=jade] .rpg-vn-choice{border:3px double var(--rpg-border);}
[data-reading-theme=orbit]{background-size:40px 40px;}
[data-reading-theme=orbit] .rpg-vn-frame{border-left:3px solid var(--rpg-accent);}
[data-reading-theme=orbit] .rpg-vn-frame:before{content:'◎ ─── ◎';font:26px monospace;}
[data-reading-theme=orbit] .rpg-vn-narration-text,[data-reading-theme=orbit] .rpg-vn-dialogue-text{font-family:system-ui,sans-serif;}
[data-reading-theme=orbit] .rpg-ending{border-top:4px solid var(--rpg-accent);}
[data-reading-theme=nocturne] .rpg-vn-frame:before{content:'╱ ◇ ╲';font-size:28px;}
[data-reading-theme=nocturne] .rpg-vn-choice{border:3px double var(--rpg-border);}
[data-reading-theme=nocturne] .rpg-ending{border:4px double var(--rpg-border);border-radius:150px 150px 0 0!important;padding-top:70px!important;}
[data-reading-theme=cinema] .rpg-vn-frame{background:color-mix(in srgb,var(--rpg-panel) 88%,transparent);border:0;}
[data-reading-theme=storybook] .rpg-vn-frame{border-left:4px double var(--rpg-border);border-right:4px double var(--rpg-border);}
[data-reading-theme=storybook] .rpg-vn-choice{border:4px double var(--rpg-border);}
[data-reading-theme=system] .rpg-vn-frame,[data-reading-theme=tycoon] .rpg-vn-frame{border-left:3px solid var(--rpg-accent);}
[data-reading-theme=system] .rpg-vn-frame:before{content:'◈ ── KẾT NỐI ── ◈';}
[data-reading-theme=tycoon] .rpg-vn-frame:before{content:'◇ ── HÀNH TRÌNH ── ◇';}
[data-reading-theme=mystery] .rpg-vn-frame{border-top:3px solid var(--rpg-border);}
[data-reading-theme=mystery] .rpg-ending{text-align:left;}
[data-reading-theme=palace] .rpg-vn-frame,[data-reading-theme=palace] .rpg-ending{border:6px double var(--rpg-border);}
[data-reading-theme=palace] .rpg-vn-frame:before{content:'◇ ── ❖ ── ◇';}
@media(min-width:800px){[data-reading-theme=palace] .rpg-vn-choices,[data-reading-theme=jade] .rpg-vn-choices{grid-template-columns:1fr 1fr;}}
@media(max-width:640px){[data-reading-theme] .rpg-topbar{padding:14px 16px;}[data-reading-theme] .rpg-vn-frame{width:calc(100% - 24px);padding:24px 20px;}[data-reading-theme] .rpg-vn-narration-text,[data-reading-theme] .rpg-vn-dialogue-text{font-size:17px;}[data-reading-theme] .rpg-ending{padding:35px 22px!important;}[data-reading-theme=nocturne] .rpg-ending{border-radius:80px 80px 0 0!important;}}
@container(max-width:640px){[data-reading-theme] .rpg-vn-choices{grid-template-columns:1fr;}[data-reading-theme] .rpg-vn-frame{width:calc(100% - 24px);padding:24px 20px;}}
`;
