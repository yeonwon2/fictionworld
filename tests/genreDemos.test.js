import test from 'node:test';
import assert from 'node:assert/strict';
import {genreDemos,pickDemoEnding} from '../src/components/game-studio/experimental/genreDemos.js';
import {demoTransition} from '../src/components/game-studio/experimental/cinematicDemo.js';
test('every demo ending is reachable through choices, with a distinct early system death',()=>{
 for(const genre of Object.values(genreDemos)){
  const reached=new Set();
  function walk(index,stats){
   if(index===genre.scenes.length || (genre.death&&stats[genre.death]<=0)){reached.add(pickDemoEnding(genre,stats).title);return;}
   for(const c of genre.scenes[index].choices) walk(index+1,demoTransition(stats,c,genre.stats).stats);
  }
  walk(0,Object.fromEntries(genre.stats.map(s=>[s.key,s.initial])));
  const endings=[...genre.endings,...(genre.deathEnding?[genre.deathEnding]:[])];
  for(const e of endings)assert.ok(reached.has(e.title),`${genre.id}: unreachable ${e.title}`);
 }
});
test('system survival overrides accumulated mission progress without mutating stats',()=>{
 const genre=genreDemos.system,stats={hp:0,insight:8,energy:6},before=structuredClone(stats);
 assert.equal(pickDemoEnding(genre,stats),genre.deathEnding);
 assert.deepEqual(stats,before);
 assert.equal(pickDemoEnding(genre,{...stats,hp:1}),genre.endings[0]);
});
