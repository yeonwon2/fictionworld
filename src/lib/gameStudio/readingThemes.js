// Presentation only: never change stats, archetype, graph, or ending rules.
const theme=(id,name,bg,text,muted,accent,line,pattern,art='')=>({id,name,art,pattern,vars:{
 '--rpg-bg':bg,'--rpg-panel':bg,'--rpg-panel-2':bg,'--rpg-text':text,'--rpg-muted':muted,
 '--rpg-accent':accent,'--rpg-accent2':accent,'--rpg-border':line,'--rpg-font':"Georgia, 'Times New Roman', serif",
 '--rpg-btn-radius':'2px','--rpg-bg-image':pattern,
}});
// Hand-drawn scene art, inlined as SVG data URIs (no external asset files, still
// self-contained in the offline HTML export). svgArt() percent-encodes once at module load.
// encodeURIComponent leaves "( ) '" untouched, but the SVG here uses translate()/rotate()/
// rgba() and single-quoted attributes — those literal chars would prematurely end the CSS
// url(...) wrapper this art is embedded in (unquoted, both live and in the exported HTML),
// so they must be escaped too.
const svgArt=svg=>'data:image/svg+xml,'+encodeURIComponent(svg).replace(/[()']/g,c=>({'(':'%28',')':'%29',"'":'%27'})[c]);
// Same abstract-wash technique as LilyHub's own novel-reader background art
// (src/pages/Reader.jsx + public/reader-bg-*.svg in the lilyhub repo): a handful of large,
// heavily-blurred colour blooms tucked into the corners, a few thin unblurred gestural line
// strokes, and small shrinking dot clusters standing in for petals/moss — everything under
// ~30% opacity so it reads as an ambient wash behind text, never competing with it. Palettes
// below are the exact colours from those reader themes (Thuỷ Mặc / Mộng Hoa / Tím); the
// compositions here are original, sized for a tall reading panel instead of a wide page.
const INK_WASH_ART=svgArt(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 700 1000'>
<defs>
<filter id='b1'><feGaussianBlur stdDeviation='14'/></filter>
<filter id='b2'><feGaussianBlur stdDeviation='26'/></filter>
<linearGradient id='mist' x1='0' y1='0' x2='0' y2='1'>
<stop offset='0' stop-color='#f4f3ea' stop-opacity='0'/><stop offset='1' stop-color='#777c73' stop-opacity='.16'/>
</linearGradient>
</defs>
<g fill='#777c73' opacity='.12' filter='url(#b1)'>
<path d='M-60 640Q100 460 260 620T560 590T760 560V760H-60Z'/>
<path d='M320 130Q430 -20 520 130T700 90V330H330Z'/>
</g>
<path d='M0 760Q140 660 280 750T540 730T700 690V1000H0Z' fill='url(#mist)'/>
<g fill='none' stroke='#737970' stroke-linecap='round'>
<path d='M-20 830q120-110 260-10t250-14 230 5' stroke-width='5' opacity='.16'/>
<path d='M-15 862q150-70 300 1t290-12' stroke-width='2.5' opacity='.13'/>
<path d='M580-20c-18 120-8 230-42 350' stroke-width='6' opacity='.18'/>
<path d='M545 78q-70 14-105 82m102-24q64 6 106 54' stroke-width='4' opacity='.15'/>
</g>
<g fill='#71766e' opacity='.16'>
<ellipse cx='480' cy='170' rx='38' ry='8' transform='rotate(-24 480 170)'/>
<ellipse cx='610' cy='210' rx='44' ry='9' transform='rotate(30 610 210)'/>
<ellipse cx='500' cy='300' rx='34' ry='7' transform='rotate(-30 500 300)'/>
<circle cx='545' cy='195' r='4'/><circle cx='538' cy='228' r='3'/>
</g>
<g fill='#777b74' opacity='.11' filter='url(#b2)'>
<ellipse cx='120' cy='900' rx='120' ry='24'/><ellipse cx='420' cy='920' rx='160' ry='28'/>
</g>
</svg>`);
const WISTERIA_ART=svgArt(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 700 1000'>
<defs><filter id='wash'><feGaussianBlur stdDeviation='30'/></filter><filter id='soft'><feGaussianBlur stdDeviation='8'/></filter></defs>
<g filter='url(#wash)' opacity='.3'>
<circle cx='60' cy='40' r='150' fill='#79c5b6'/><circle cx='280' cy='0' r='120' fill='#86c8bd'/>
<circle cx='650' cy='60' r='170' fill='#8abdb8'/><circle cx='60' cy='960' r='190' fill='#e5a9bd'/>
<circle cx='400' cy='1010' r='200' fill='#b5a2d7'/><circle cx='680' cy='930' r='160' fill='#8bc8bd'/>
</g>
<g fill='none' stroke='#638e82' stroke-linecap='round' opacity='.19'>
<path d='M-30 60q160 46 300-30t300 20' stroke-width='7'/>
<path d='M600-20q-40 130-10 260m-20-150q-65 12-100 78m124-20q64 18 100 82' stroke-width='4.5'/>
<path d='M-15 940q100-60 220-26' stroke-width='4'/>
</g>
<g opacity='.24' filter='url(#soft)'>
<g fill='#8f72ad'><circle cx='490' cy='210' r='14'/><circle cx='510' cy='232' r='11'/><circle cx='530' cy='254' r='8'/><circle cx='610' cy='270' r='13'/><circle cx='630' cy='292' r='10'/></g>
<g fill='#cf8fab'><circle cx='70' cy='830' r='15'/><circle cx='95' cy='852' r='12'/><circle cx='260' cy='900' r='13'/><circle cx='285' cy='922' r='10'/></g>
</g>
<g fill='#fff' opacity='.17'><circle cx='150' cy='100' r='24'/><circle cx='370' cy='50' r='30'/><circle cx='610' cy='610' r='26'/><circle cx='210' cy='880' r='20'/></g>
</svg>`);
const VIOLET_ART=svgArt(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 700 1000'>
<defs>
<filter id='fiber'><feTurbulence type='fractalNoise' baseFrequency='.014 .24' numOctaves='4' seed='23'/><feColorMatrix values='0 0 0 0 .47 0 0 0 0 .38 0 0 0 0 .53 0 0 0 .13 0'/></filter>
<filter id='soft'><feGaussianBlur stdDeviation='16'/></filter>
<linearGradient id='light' x1='0' y1='0' x2='1' y2='1'>
<stop stop-color='#e9e0f1' stop-opacity='.4'/><stop offset='.5' stop-color='#faf8fc' stop-opacity='0'/><stop offset='1' stop-color='#ded1e8' stop-opacity='.3'/>
</linearGradient>
</defs>
<rect width='700' height='1000' fill='url(#light)'/>
<rect width='700' height='1000' filter='url(#fiber)' opacity='.68'/>
<g fill='#a58aae' opacity='.13' filter='url(#soft)'>
<ellipse cx='40' cy='60' rx='140' ry='105'/><ellipse cx='660' cy='940' rx='160' ry='120'/>
</g>
<g fill='none' stroke='#987ca2' stroke-linecap='round' opacity='.11'>
<path d='M-10 24q110 44 210 4t210 12' stroke-width='5'/>
<path d='M640-15q-38 90-22 200m-8-115q-46 10-68 54' stroke-width='3.5'/>
</g>
<g fill='#9d80a8' opacity='.13'>
<circle cx='585' cy='150' r='8'/><circle cx='598' cy='164' r='6'/><circle cx='611' cy='178' r='5'/>
<circle cx='75' cy='880' r='8'/><circle cx='90' cy='894' r='6'/><circle cx='103' cy='908' r='5'/>
</g>
</svg>`);
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
 inkwash:theme('inkwash','Lily Mặc · Thuỷ mặc','#f4f3eb','#3e4035','#5d5f54','#5c6355','#d1d0c7','none',INK_WASH_ART),
 wisteria:theme('wisteria','Lily Mộng · Mộng hoa','#f6f5ea','#426c62','#63837c','#8f72ad','#c2d0cd','none',WISTERIA_ART),
 violet:theme('violet','Lily Tím · Yên tím','#f7f5fa','#625068','#7b727e','#987ca2','#d7d0dc','none',VIOLET_ART),
 rosepaper:theme('rosepaper','Lily Hồng · Giấy hồng','#f9f0f3','#5f4f53','#74676b','#c9538a','#dbccd0','radial-gradient(ellipse at 86% 106%,hsl(325 82% 72% / .55) 0 12%,transparent 12.3%),radial-gradient(ellipse at 98% 94%,hsl(332 76% 79% / .6) 0 10%,transparent 10.3%),radial-gradient(ellipse at 72% 101%,hsl(341 77% 83% / .62) 0 9%,transparent 9.3%),radial-gradient(ellipse at 10% 105%,hsl(24 82% 83% / .62) 0 13%,transparent 13.3%),radial-gradient(ellipse at -2% 92%,hsl(16 75% 87% / .55) 0 10%,transparent 10.3%),radial-gradient(circle at 91% 79%,hsl(326 82% 72% / .55) 0 2.4%,transparent 2.7%),radial-gradient(circle at 83% 86%,hsl(332 78% 77% / .5) 0 3.2%,transparent 3.5%),linear-gradient(160deg,transparent 0 70%,hsl(18 48% 64% / .4) 70.15% 70.45%,transparent 70.6%),linear-gradient(18deg,transparent 0 81%,hsl(340 42% 62% / .32) 81.15% 81.4%,transparent 81.55%),repeating-linear-gradient(105deg,transparent 0 4px,hsl(342 25% 68% / .05) 4px 5px)'),
 aqua:theme('aqua','Lily Lam · Sương lam','#ccebe9','#054776','#1b5983','#2e9eb8','#a6c9c9','linear-gradient(hsl(191 48% 54% / .07) 1px,transparent 1px),linear-gradient(90deg,hsl(191 48% 54% / .07) 1px,transparent 1px)'),
 dawn:theme('dawn','Lily Mai · Bình minh','#b6dadd','#384e51','#546669','#c9a15a','#a3bbbd','radial-gradient(ellipse at 88% 2%,hsl(188 70% 97% / .9),transparent 18%)'),
 academy:theme('academy','Học đường · Thanh xuân','#fff6f2','#3d2b2b','#8a726c','#e8748a','#f0c6cf','repeating-linear-gradient(180deg,transparent 0 27px,#e8748a14 27px 28px),radial-gradient(circle at 12% 18%,#f7b8c422 0 6px,transparent 8px),radial-gradient(circle at 88% 70%,#f7b8c422 0 5px,transparent 7px),radial-gradient(circle at 60% 92%,#f7b8c418 0 4px,transparent 6px)'),
 horror:theme('horror','Kinh dị · Ám ảnh','#0a0707','#e6d9d6','#8f7a78','#b3262f','#3a1414','radial-gradient(ellipse 900px 700px at 50% 45%,transparent 40%,rgba(0,0,0,.75) 100%),repeating-linear-gradient(115deg,transparent 0 60px,#b3262f0f 60px 62px,transparent 62px 140px),repeating-linear-gradient(65deg,transparent 0 90px,#b3262f0a 90px 92px,transparent 92px 200px)'),
 neon:theme('neon','Cyberpunk · Neon đô thị','#0a0416','#eef1ff','#9c93c9','#00e5ff','#ff2fd0','linear-gradient(rgba(0,229,255,.14) 1px,transparent 1px),linear-gradient(90deg,rgba(255,47,208,.10) 1px,transparent 1px),repeating-linear-gradient(180deg,rgba(255,255,255,.025) 0 1px,transparent 1px 3px),radial-gradient(900px 500px at 85% -5%,rgba(0,229,255,.16),transparent 60%),radial-gradient(700px 420px at 5% 105%,rgba(255,47,208,.14),transparent 55%)'),
 folklore:theme('folklore','U linh · Truyền kỳ','#160b0d','#f3e3c9','#b89a86','#d99a3f','#5c2a2a','radial-gradient(360px 360px at 20% 15%,rgba(217,154,63,.18),transparent 70%),radial-gradient(420px 420px at 85% 80%,rgba(217,154,63,.14),transparent 70%),repeating-linear-gradient(90deg,rgba(243,227,201,.025) 0 1px,transparent 1px 26px)'),
};
export function getReadingTheme(meta){return READING_THEMES[meta?.readingTheme]||null;}
export const READING_EFFECTS={none:'Tắt hiệu ứng',snow:'Tuyết rơi',rain:'Mưa rơi',leaves:'Lá rơi',petals:'Cánh hoa rơi',fireflies:'Đom đóm',stars:'Sao lấp lánh',fog:'Sương mỏng'};
export function getReadingEffect(meta){return ['snow','rain','leaves','petals','fireflies','stars','fog'].includes(meta?.readingEffect)?meta.readingEffect:'none';}
export const READING_THEME_CSS=`
[data-reading-theme] .rpg-system-card,[data-reading-theme] .rpg-sys-box{box-sizing:border-box;width:100%;max-width:384px;max-height:100%;overflow-y:auto;border:1px solid var(--rpg-border);border-radius:10px;background:var(--rpg-panel);color:var(--rpg-text);padding:24px;box-shadow:0 12px 36px #0003;}
[data-reading-theme] .rpg-system-card>div:first-child{padding:8px 20px 0;}
[data-reading-theme] .rpg-system-card p,[data-reading-theme] .rpg-sys-text{font-size:15px;line-height:1.8;overflow-wrap:anywhere;}
[data-reading-theme] .rpg-system-card>button:last-child{min-width:36px;min-height:36px;}
[data-reading-theme] .rpg-system-card>button:not(:last-child),[data-reading-theme] .rpg-sys-btn{background:var(--rpg-accent);color:var(--rpg-bg)!important;min-height:44px;}
[data-reading-theme] .rpg-sys-overlay{box-sizing:border-box;padding:12px;}
[data-reading-theme] .rpg-effect{pointer-events:none;opacity:.55;z-index:25;}
/* The exported game scrolls the document; keep particles in the visible viewport. */
body[data-reading-theme] #game>.rpg-effect{position:fixed;}
[data-reading-theme] .rpg-poster .rpg-effect{z-index:1;}
[data-reading-theme] .rpg-poster-inner{z-index:2;}
[data-reading-theme] .rpg-effect-fireflies::before,[data-reading-theme] .rpg-effect-fireflies::after{background-image:radial-gradient(circle at 15% 24%,#edec97 0 1.5px,#d5e77a33 3px,transparent 7px),radial-gradient(circle at 73% 64%,#e7ec9b 0 2px,#d5e77a22 4px,transparent 9px),radial-gradient(circle at 45% 85%,#ebf7b1 0 1px,transparent 5px);background-size:280px 330px;animation:readingFireflies 9s ease-in-out infinite alternate;}
[data-reading-theme] .rpg-effect-fireflies::after{background-size:390px 420px;animation-delay:-4s;animation-duration:13s;}
@keyframes readingFireflies{from{transform:translate(0,14px);opacity:.3;}to{transform:translate(12px,-22px);opacity:1;}}
@media(prefers-reduced-motion:reduce){[data-reading-theme] .rpg-effect{display:none;}}
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
[data-reading-theme] .rpg-vn-text-scroll,[data-reading-theme] .rpg-story-timeline{max-height:none!important;height:auto!important;overflow:visible!important;}
[data-reading-theme] .rpg-vn-narration,[data-reading-theme] .rpg-vn-dialogue{background:var(--rpg-panel)!important;border:0;box-shadow:none;backdrop-filter:none;padding:0;}
[data-reading-theme] .rpg-vn-narration-text,[data-reading-theme] .rpg-vn-dialogue-text{font:18px/2 var(--rpg-font);white-space:pre-wrap;overflow-wrap:anywhere;color:var(--rpg-text);}
[data-reading-theme] .rpg-vn-scene{height:auto;max-height:300px;}
[data-reading-theme] .rpg-vn-scene-img{max-height:300px;object-fit:contain;}
[data-reading-theme] .rpg-vn-choices{position:static;max-height:none;overflow:visible;background:transparent;padding:24px 0 0;display:grid;gap:12px;}
[data-reading-theme] .rpg-vn-choice{position:relative;color:var(--rpg-text);background:var(--rpg-panel);border:1px solid var(--rpg-border);border-radius:2px;padding:16px 40px 16px 18px;box-shadow:none;font:15px/1.7 var(--rpg-font);height:auto;white-space:normal;overflow-wrap:anywhere;}
[data-reading-theme] .rpg-vn-choice:disabled{opacity:.55;}
[data-reading-theme] .rpg-vn-choice:not(:disabled):hover{border-color:var(--rpg-accent);background:color-mix(in srgb,var(--rpg-accent) 10%,var(--rpg-panel));}
/* Swap the bold numbered badge for a quiet text-first line, closer to a printed novel's
   choice list — a small ◇ marks the row instead of crowding it with a filled number chip. */
[data-reading-theme] .rpg-vn-choice:not(:disabled) .rpg-vn-choice-idx{display:none;}
[data-reading-theme] .rpg-vn-choice:not(:disabled)::after{content:'◇';position:absolute;right:16px;top:50%;transform:translateY(-50%);color:var(--rpg-accent);font-size:13px;opacity:.6;pointer-events:none;}
[data-reading-theme] .rpg-vn-choice:disabled .rpg-vn-choice-idx{width:auto;height:auto;background:transparent;color:var(--rpg-muted);font-size:15px;}
[data-reading-theme] .rpg-ending{width:calc(100% - 40px);max-width:720px;margin:40px auto!important;padding:44px 32px!important;border:1px solid var(--rpg-border);border-radius:0!important;background:var(--rpg-panel)!important;color:var(--rpg-text);}
[data-reading-theme] .rpg-ending-text{font:18px/2 var(--rpg-font);white-space:pre-wrap;overflow-wrap:anywhere;}
[data-reading-theme] .rpg-reading-ending-title{font:30px/1.4 var(--rpg-font);color:var(--rpg-accent);text-align:center;}
[data-reading-theme] .rpg-ending button,[data-reading-theme] .rpg-poster-btn{background:var(--rpg-accent)!important;color:var(--rpg-bg)!important;}
[data-reading-theme] .rpg-poster{background-color:var(--rpg-bg);background-image:var(--rpg-bg-image);}
[data-reading-theme] .rpg-poster-title,[data-reading-theme] .rpg-poster-sub,[data-reading-theme] .rpg-poster-bio,[data-reading-theme] .rpg-poster-badge{color:var(--rpg-text);text-shadow:none;}
[data-reading-theme] .rpg-poster-inner{background:var(--rpg-panel);border:4px double var(--rpg-border);padding:40px;}
[data-reading-theme] .rpg-poster-shade{background:transparent;}
/* An illustrated cover is a poster, not a paper dialog over the character. */
[data-reading-theme] .rpg-poster-with-art{align-items:flex-end;background-position:center top;}
[data-reading-theme] .rpg-poster-with-art .rpg-poster-shade{background:linear-gradient(180deg,transparent 40%,#080c1220 55%,#080c12c7 85%,#080c12eb 100%);pointer-events:none;}
[data-reading-theme] .rpg-poster-with-art .rpg-poster-inner{background:transparent;border:0;box-shadow:none;width:100%;max-width:620px;max-height:48%;overflow-y:auto;padding:18px 22px max(22px,env(safe-area-inset-bottom));}
[data-reading-theme] .rpg-poster-with-art .rpg-poster-title{font:600 clamp(24px,4vw,34px)/1.25 var(--rpg-font);color:#fff8eb;text-shadow:0 2px 12px #0009;margin:8px 0;overflow-wrap:anywhere;}
[data-reading-theme] .rpg-poster-with-art .rpg-poster-sub{font-size:14px;color:#f5ebdb;margin:6px 0 14px;text-shadow:0 1px 5px #000;}
[data-reading-theme] .rpg-poster-with-art .rpg-poster-badge{font:10px/1.5 system-ui,sans-serif;letter-spacing:.12em;color:#fff6e9;background:#11182066;border:1px solid #fff5;padding:4px 10px;margin-bottom:6px;}
[data-reading-theme] .rpg-poster-with-art .rpg-poster-bio{color:#f5ebdb;font-size:12px;max-height:64px;overflow:auto;margin:8px 0 14px;}
[data-reading-theme] .rpg-poster-with-art .rpg-poster-actions{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;}
[data-reading-theme] .rpg-poster-with-art .rpg-poster-btn{font-size:14px;min-height:44px;padding:10px 22px;width:auto;box-shadow:none;}
[data-reading-theme] .rpg-poster-with-art .rpg-poster-secondary{font-size:12px;min-height:44px;padding:8px 14px;background:#10182080;color:#fff4e3;border:1px solid #fff6;box-shadow:none;}

[data-reading-theme] .rpg-menu-sheet,[data-reading-theme] .rpg-sheet{background:var(--rpg-panel);color:var(--rpg-text);}
[data-reading-theme] .rpg-menu-history p{display:block;-webkit-line-clamp:unset;overflow:visible;white-space:pre-wrap;font-size:15px;line-height:1.9;}
[data-reading-theme] .rpg-sheet-section p{white-space:pre-wrap;font-size:15px;line-height:1.9;}
[data-reading-theme] button:focus-visible{outline:2px solid var(--rpg-accent);outline-offset:3px;}
[data-reading-theme=letters]{background-size:12px 12px;}
[data-reading-theme=letters] .rpg-vn-frame{border-style:dashed;}
[data-reading-theme=letters] .rpg-vn-choice{border:0;border-bottom:1px solid var(--rpg-border);font-family:system-ui,sans-serif;}
[data-reading-theme=letters] .rpg-ending{border:1px dashed var(--rpg-border);box-shadow:8px 8px 0 #c7baaa40;}
[data-reading-theme=jade] .rpg-vn-frame,[data-reading-theme=jade] .rpg-ending{border:5px double var(--rpg-border);}
[data-reading-theme=jade] .rpg-vn-choice{border:3px double var(--rpg-border);}
[data-reading-theme=orbit]{background-size:40px 40px;}
[data-reading-theme=orbit] .rpg-vn-frame{border-left:3px solid var(--rpg-accent);}
[data-reading-theme=orbit] .rpg-vn-narration-text,[data-reading-theme=orbit] .rpg-vn-dialogue-text{font-family:system-ui,sans-serif;}
[data-reading-theme=orbit] .rpg-ending{border-top:4px solid var(--rpg-accent);}
[data-reading-theme=nocturne] .rpg-vn-choice{border:3px double var(--rpg-border);}
[data-reading-theme=nocturne] .rpg-ending{border:4px double var(--rpg-border);border-radius:150px 150px 0 0!important;padding-top:70px!important;}
[data-reading-theme=cinema] .rpg-vn-frame{background:color-mix(in srgb,var(--rpg-panel) 88%,transparent);border:0;}
[data-reading-theme=storybook] .rpg-vn-frame{border-left:4px double var(--rpg-border);border-right:4px double var(--rpg-border);}
[data-reading-theme=storybook] .rpg-vn-choice{border:4px double var(--rpg-border);}
[data-reading-theme=system] .rpg-vn-frame,[data-reading-theme=tycoon] .rpg-vn-frame{border-left:3px solid var(--rpg-accent);}
[data-reading-theme=mystery] .rpg-vn-frame{border-top:3px solid var(--rpg-border);}
[data-reading-theme=mystery] .rpg-ending{text-align:left;}
[data-reading-theme=palace] .rpg-vn-frame,[data-reading-theme=palace] .rpg-ending{border:6px double var(--rpg-border);}
/* Illustrated scene fills the whole reading frame (like a lit window at night),
   not a faint 18%-opacity accent — the story panel floats on top, glass-like. */
/* inkwash/wisteria/violet carry LilyHub's own reader wash art — subtle enough (≤30% internal
   opacity, blurred) to stay full-strength as a backdrop without ever fighting the text, so the
   frame only needs a light veil (not the near-opaque panel other art themes use) for a soft
   washi-paper feel consistent with the reader page it's borrowed from. */
[data-reading-theme=inkwash] .rpg-reading-backdrop,[data-reading-theme=wisteria] .rpg-reading-backdrop,[data-reading-theme=violet] .rpg-reading-backdrop{opacity:1;}
[data-reading-theme=inkwash] .rpg-topbar,[data-reading-theme=wisteria] .rpg-topbar,[data-reading-theme=violet] .rpg-topbar{background:color-mix(in srgb,var(--rpg-bg) 55%,transparent);backdrop-filter:blur(6px);}
[data-reading-theme=inkwash] .rpg-vn-frame,[data-reading-theme=wisteria] .rpg-vn-frame,[data-reading-theme=violet] .rpg-vn-frame{background:color-mix(in srgb,var(--rpg-panel) 40%,transparent)!important;backdrop-filter:blur(7px);box-shadow:0 14px 36px -18px #0004;}
[data-reading-theme=inkwash] .rpg-vn-choice,[data-reading-theme=wisteria] .rpg-vn-choice,[data-reading-theme=violet] .rpg-vn-choice{background:color-mix(in srgb,var(--rpg-panel) 34%,transparent);backdrop-filter:blur(5px);}
[data-reading-theme=inkwash] .rpg-ending,[data-reading-theme=wisteria] .rpg-ending,[data-reading-theme=violet] .rpg-ending{background:color-mix(in srgb,var(--rpg-panel) 55%,transparent)!important;backdrop-filter:blur(6px);}
[data-reading-theme=inkwash] .rpg-vn-frame,[data-reading-theme=inkwash] .rpg-ending{border-top:1px solid var(--rpg-border);border-bottom:1px solid var(--rpg-border);border-left:0;border-right:0;}
[data-reading-theme=wisteria] .rpg-vn-frame,[data-reading-theme=wisteria] .rpg-ending,[data-reading-theme=violet] .rpg-vn-frame,[data-reading-theme=violet] .rpg-ending{border-radius:22px;}
[data-reading-theme=wisteria] .rpg-vn-choice,[data-reading-theme=violet] .rpg-vn-choice{border-radius:16px;}
[data-reading-theme=rosepaper] .rpg-vn-frame,[data-reading-theme=rosepaper] .rpg-ending{border-radius:22px;border:1px solid var(--rpg-border);}
[data-reading-theme=rosepaper] .rpg-vn-choice{border-radius:16px;}
[data-reading-theme=aqua] .rpg-vn-frame,[data-reading-theme=aqua] .rpg-ending{border-top:3px solid var(--rpg-accent);}
[data-reading-theme=aqua]{background-size:4px 4px,4px 4px;}
[data-reading-theme=dawn] .rpg-vn-frame,[data-reading-theme=dawn] .rpg-ending{border-radius:16px;border-top:3px solid var(--rpg-accent);}
[data-reading-theme=dawn] .rpg-vn-choice{border-radius:12px;}
[data-reading-theme=academy] .rpg-vn-frame{border-radius:20px;border:2px dashed var(--rpg-border);}
[data-reading-theme=academy] .rpg-vn-choice{border-radius:16px;border:2px solid var(--rpg-border);}
[data-reading-theme=academy] .rpg-ending{border-radius:28px;border:2px dashed var(--rpg-border);}
[data-reading-theme=horror] .rpg-vn-frame{border:1px solid var(--rpg-border);border-radius:3px 16px 4px 13px;box-shadow:inset 0 0 40px -12px var(--rpg-accent);}
[data-reading-theme=horror] .rpg-vn-choice{border-radius:2px;border-left:3px solid var(--rpg-accent);}
[data-reading-theme=horror] .rpg-ending{border:1px solid var(--rpg-accent);border-radius:4px 20px 5px 18px;box-shadow:inset 0 0 60px -14px var(--rpg-accent);}
[data-reading-theme=neon]{background-size:38px 38px,38px 38px,auto,auto,auto;}
[data-reading-theme=neon] .rpg-vn-narration-text,[data-reading-theme=neon] .rpg-vn-dialogue-text{font-family:'Courier New',monospace;}
[data-reading-theme=neon] .rpg-vn-frame{border:1px solid var(--rpg-accent);box-shadow:0 0 24px -8px var(--rpg-accent);}
[data-reading-theme=neon] .rpg-vn-choice{border:1px solid var(--rpg-border);border-radius:2px;}
[data-reading-theme=neon] .rpg-vn-choice:not(:disabled):hover{box-shadow:0 0 16px -4px var(--rpg-accent);}
[data-reading-theme=neon] .rpg-ending{border:1px solid var(--rpg-accent);box-shadow:0 0 36px -10px var(--rpg-accent);}
[data-reading-theme=folklore] .rpg-vn-frame{border:2px solid var(--rpg-accent);border-radius:6px;}
[data-reading-theme=folklore] .rpg-vn-choice{border-radius:10px;border:1px solid var(--rpg-border);}
[data-reading-theme=folklore] .rpg-ending{border:3px double var(--rpg-accent);border-radius:120px 120px 8px 8px!important;padding-top:60px!important;}
@media(min-width:800px){[data-reading-theme=palace] .rpg-vn-choices,[data-reading-theme=jade] .rpg-vn-choices{grid-template-columns:1fr 1fr;}}
@media(max-width:640px){[data-reading-theme] .rpg-topbar{padding:14px 16px;}[data-reading-theme] .rpg-vn-frame{width:calc(100% - 24px);padding:24px 20px;}[data-reading-theme] .rpg-vn-narration-text,[data-reading-theme] .rpg-vn-dialogue-text{font-size:17px;}[data-reading-theme] .rpg-ending{padding:35px 22px!important;}[data-reading-theme=nocturne] .rpg-ending{border-radius:80px 80px 0 0!important;}[data-reading-theme=folklore] .rpg-ending{border-radius:70px 70px 6px 6px!important;padding-top:50px!important;}}
@container(max-width:640px){[data-reading-theme] .rpg-vn-choices{grid-template-columns:1fr;}[data-reading-theme] .rpg-vn-frame{width:calc(100% - 24px);padding:24px 20px;}}
`;
