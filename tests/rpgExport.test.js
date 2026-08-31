import test from "node:test";
import assert from "node:assert/strict";
import { generateStandaloneHTML } from "../src/lib/gameStudio/rpgExport.js";

test("standalone game menu puts exit directly below restart", () => {
  const html = generateStandaloneHTML({
    meta: { title: "Test", statsConfig: [] },
    nodes: { start_node: { id: "start_node", text: "Mở", choices: [], isEnding: true } },
  });
  const restart = html.indexOf('id="menuReset"');
  const exit = html.indexOf('id="menuExit"');
  assert.ok(restart >= 0);
  assert.ok(exit > restart);
  assert.match(html, /Thoát game/);
  assert.match(html, /function exitGame\(\)/);
});

test("standalone keeps the previous choice only inside history", () => {
  const html = generateStandaloneHTML({
    meta: { title: "Timeline", statsConfig: [], playbackLayout: "timeline" },
    nodes: { start_node: { id: "start_node", text: "Mở", choices: [], isEnding: true } },
  });

  assert.match(html, /recapHtml=""/);
  assert.match(html, /Bạn đã chọn ·/);
});

test("standalone mobile layout does not pin controls over game content", () => {
  const html = generateStandaloneHTML({
    meta: { title: "Mobile", statsConfig: [], playbackLayout: "timeline" },
    nodes: { start_node: { id: "start_node", text: "Mở", choices: [], isEnding: true } },
  });

  assert.match(html, /\.rpg-topbar\{position:relative;top:auto;z-index:2/);
  assert.match(html, /\.rpg-vn-choices\{position:relative;bottom:auto;z-index:2;max-height:none;overflow:visible/);
});

test("standalone skip keeps long scene text inside its scroll area", () => {
  const html = generateStandaloneHTML({
    meta: { title: "Long scene", statsConfig: [], playbackLayout: "timeline" },
    nodes: { start_node: { id: "start_node", text: "Nội dung dài", choices: [] } },
  });

  assert.doesNotMatch(html, /rpg-vn-text-scroll expanded/);
  assert.match(html, /syncTextScrollExpand\(node\)\{[^}]*classList\.toggle\("expanded", hidden\)/);
  assert.match(html, /\.rpg-vn-text-scroll\.expanded\{max-height:calc\(100dvh - 190px/);
});

test("standalone stat chips stay above long scene content", () => {
  const html = generateStandaloneHTML({
    meta: { title: "Stats", statsConfig: [{ key: "trust", label: "Tin tưởng" }] },
    nodes: { start_node: { id: "start_node", text: "Nội dung dài", choices: [] } },
  });

  assert.match(html, /\.rpg-stats-compact\{position:relative;z-index:4;isolation:isolate;display:flex;flex:0 0 38px/);
  assert.match(html, /\.rpg-vn-frame\{position:relative;z-index:1/);
});

import vm from 'node:vm';
function exportRuntime(game){
 const container={innerHTML:'',classList:{add(){},remove(){}}};
 const sandbox={document:{documentElement:{style:{setProperty(){}},setAttribute(){},removeAttribute(){}},body:{},getElementById:id=>id==='game'?container:null,querySelectorAll:()=>[],querySelector:()=>null},localStorage:{setItem(){}},setTimeout(){},clearInterval(){},setInterval(){throw new Error('Hidden router attempted to type text');}};
 const html=generateStandaloneHTML(game),script=html.match(/<script>([\s\S]*)<\/script>/)[1].replace('load(); showPoster(); render();','globalThis.api={state:state,render:render,choose:choose,visibleHistory:visibleHistory};');
 vm.runInNewContext(script,sandbox);return {...sandbox.api,container};
}
function endingGame(score=79){return {meta:{poster:false,initialStats:{favor:score},statsConfig:[{key:'favor',label:'Thiện cảm'}]},nodes:{start_node:{text:'Final decision',choices:[{text:'Go',statModifiers:{favor:1},targetNodeId:'gate'}]},gate:{text:'HIDDEN GATE',automaticEnding:true,randomEvents:[],choices:[{text:'HIDDEN LOW',targetNodeId:'low',statRequirementsMax:{favor:79},statModifiers:{}},{text:'HIDDEN HIGH',targetNodeId:'high',statRequirements:{favor:80},statModifiers:{}}]},low:{isEnding:true,text:'Low ending'},high:{isEnding:true,text:'High ending'}}};}
test('export routes directly to ending using post-choice score without rendering router or extra choices',()=>{
 const g=endingGame(),rt=exportRuntime(g);rt.choose(g.nodes.start_node,0);
 assert.equal(rt.state.nodeId,'high');assert.equal(rt.state.stats.favor,80);assert.match(rt.container.innerHTML,/High ending/);assert.doesNotMatch(rt.container.innerHTML,/HIDDEN/);assert.equal(rt.visibleHistory().length,1);
});
test('export refuses ambiguous, missing and invalid automatic endings instead of showing choices',()=>{
 for(const kind of ['overlap','gap','effect']){const g=endingGame();if(kind==='overlap')g.nodes.gate.choices[0].statRequirementsMax.favor=100;if(kind==='gap')g.nodes.gate.choices[1].statRequirements.favor=100;if(kind==='effect')g.nodes.gate.choices[1].statModifiers.favor=10;const rt=exportRuntime(g);rt.choose(g.nodes.start_node,0);assert.equal(rt.state.nodeId,'gate');assert.match(rt.container.innerHTML,/role="alert"/);assert.doesNotMatch(rt.container.innerHTML,/HIDDEN/);assert.equal(rt.state.stats.favor,80);}
});
test('export resolves a save positioned at the hidden router',()=>{const rt=exportRuntime(endingGame(10));rt.state.nodeId='gate';rt.render();assert.equal(rt.state.nodeId,'low');assert.match(rt.container.innerHTML,/Low ending/);});

import { READING_THEMES, getReadingTheme, getReadingEffect } from '../src/lib/gameStudio/readingThemes.js';
test('all reading themes preserve score routing and stay opt-in',()=>{
 assert.equal(getReadingTheme({}),null);assert.equal(getReadingTheme({readingTheme:'unknown'}),null);
 for(const id of Object.keys(READING_THEMES)){
  const g=endingGame();g.meta.readingTheme=id;g.meta.readingEffect='fireflies';
  const container={innerHTML:'',classList:{add(){},remove(){}}};
  const sandbox={document:{documentElement:{style:{setProperty(){}},setAttribute(){},removeAttribute(){}},body:{style:{},setAttribute(){}},getElementById:id=>id==='game'?container:null,querySelectorAll:()=>[],querySelector:()=>null},localStorage:{setItem(){}},setTimeout(){},clearInterval(){},setInterval(){throw Error('Must not type a hidden ending');}};
  const before=JSON.stringify(g);const html=generateStandaloneHTML(g);
  assert.equal(JSON.stringify(g),before);assert.doesNotMatch(html,/<link[^>]+fonts.googleapis/);
  const script=html.match(/<script>([\s\S]*)<\/script>/)[1].replace('load(); showPoster(); render();','globalThis.api={state:state,choose:choose};');
  vm.runInNewContext(script,sandbox);sandbox.api.choose(g.nodes.start_node,0);
  assert.equal(sandbox.api.state.stats.favor,80,id);assert.equal(sandbox.api.state.nodeId,'high',id);
  assert.match(container.innerHTML,/High ending/);assert.match(container.innerHTML,/rpg-effect-fireflies/);assert.doesNotMatch(container.innerHTML,/HIDDEN/);
 }
});

import { prepareOfflineGame } from '../src/lib/gameStudio/rpgExport.js';
test('offline preparation skips template image downloads for no-image themes', async()=>{
 const old=globalThis.fetch;let requests=0;globalThis.fetch=async()=>{requests++;throw Error('Network unavailable');};
 try{for(const id of ['letters','jade','orbit','nocturne']){const g=endingGame();g.meta.readingTheme=id;const before=JSON.stringify(g);const result=await prepareOfflineGame(g);assert.equal(result.meta.defaultArt,'');assert.deepEqual(result.meta.offlineAssetFailures,[]);assert.equal(JSON.stringify(g),before);}assert.equal(requests,0);}finally{globalThis.fetch=old;}
});
test('offline preparation embeds the selected reading-theme artwork without changing source data',async()=>{
 const oldFetch=globalThis.fetch,oldReader=globalThis.FileReader,oldWindow=globalThis.window;const urls=[];
 globalThis.window={location:{origin:'http://localhost:5173'}};
 globalThis.fetch=async url=>{urls.push(url);return {ok:true,blob:async()=>({type:'image/jpeg'})};};
 globalThis.FileReader=class {readAsDataURL(){this.result='data:image/jpeg;base64,TEST';this.onload();}};
 try{const g=endingGame();g.meta.readingTheme='cinema';const before=JSON.stringify(g);const result=await prepareOfflineGame(g);assert.deepEqual(urls,['http://localhost:5173/hero-transmigration.jpg']);assert.equal(result.meta.offlineAssets['/hero-transmigration.jpg'],'data:image/jpeg;base64,TEST');assert.equal(JSON.stringify(g),before);}finally{globalThis.fetch=oldFetch;globalThis.FileReader=oldReader;globalThis.window=oldWindow;}
});

test('reading effects default off and reject unknown values',()=>{assert.equal(getReadingEffect({}),'none');assert.equal(getReadingEffect({readingEffect:'unknown'}),'none');for(const effect of ['snow','rain','leaves','petals','fireflies','stars','fog'])assert.equal(getReadingEffect({readingEffect:effect}),effect);});
