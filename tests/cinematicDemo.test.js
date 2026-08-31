import test from 'node:test';
import assert from 'node:assert/strict';
import {demoTransition,demoStats,extraChoices} from '../src/components/game-studio/experimental/cinematicDemo.js';
test('experimental stat feedback never exposes hidden modifiers',()=>{
 const state={favor:30,attention:0,secret_intent:5};const before=structuredClone(state);
 const result=demoTransition(state,extraChoices[0],demoStats);
 assert.equal(result.stats.favor,34);assert.equal(result.stats.secret_intent,7);
 assert.ok(result.notice.includes('Thiện cảm +4'));assert.ok(result.notice.includes('Tin tưởng +4'));
 assert.ok(!result.notice.includes('bí mật'));assert.ok(!result.notice.includes('secret_intent'));
 assert.deepEqual(state,before);
});
test('short demo does not invent stats from inactive definitions',()=>{
 const short=demoTransition({favor:30,attention:0},extraChoices[0],demoStats.slice(0,2));
 assert.equal(short.stats.trust,undefined);assert.ok(!short.notice.includes('Tin tưởng'));
});
