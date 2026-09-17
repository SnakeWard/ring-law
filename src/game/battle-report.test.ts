import assert from 'node:assert/strict';
import { it } from 'node:test';
import { emptyBattleRecord, recordDamage, recordImpact } from './battle-report.ts';
import { createWorld, selectAiTarget, stepWorld } from './sim.ts';

it('counts overmatches as penetrations and HE chip separately from bounces', () => {
  const r = emptyBattleRecord();
  const hit = {kind:'bounce' as const, facet:'hull_front' as const, nominalMm:10,effectiveMm:10,impactDeg:0,damage:8};
  recordImpact(r,hit,true);
  recordImpact(r,{...hit,damage:0},false);
  recordImpact(r,{...hit,kind:'overmatch'},false);
  assert.deepEqual([r.hits,r.penetrations,r.bounces,r.heHits,r.facets.hull_front],[3,1,1,1,3]);
});
it('counts actual HP loss without overkill or healing, separating friendly damage', () => {
  const records = {player:emptyBattleRecord(),dummy:emptyBattleRecord()};
  recordDamage(records,'player','dummy',12,-50,false);
  recordDamage(records,'player','dummy',0,20,false);
  recordDamage(records,'player','player',30,25,true);
  assert.equal(records.player.damageDealt,12);
  assert.equal(records.dummy.damageTaken,12);
  assert.equal(records.player.friendlyDamage,5);
});
it('selects weakest visible living opponent, excluding hidden and dead opponents', () => {
  const w=createWorld('m2a4',0,'ap','range',{format:'3v3',allyIds:['m2a4','m2a4']});
  w.cover=[]; w.dummyMuzzleAt=-100; w.player.x=0; w.player.y=0;
  w.dummy.x=0; w.dummy.y=5; w.dummy.hp=100;
  w.foes[0].x=5; w.foes[0].y=0; w.foes[0].hp=50;
  w.foes[1].x=100; w.foes[1].y=100; w.foes[1].hp=1;
  assert.equal(selectAiTarget(w,w.player)?.id,w.foes[0].id);
  w.foes[0].hp=0;
  assert.equal(selectAiTarget(w,w.player)?.id,'dummy');
});
it('records a fired main round even when it misses and resets for the next match', () => {
  const w=createWorld('m2a4');
  stepWorld(w,{throttle:0,steer:0,justFire:true,aimX:0,aimY:30,hasAim:true},1/60,{practice:true});
  assert.equal(w.battle.player.shots,1);
  assert.equal(w.battle.player.hits,0);
  assert.deepEqual(createWorld('m2a4').battle,{});
});
it('attributes burn damage to its source without counting another hit', () => {
  const w=createWorld('m2a4'); w.dummy.onFire=true; w.fireSources.dummy='player';
  const before=w.dummy.hp;
  stepWorld(w,{throttle:0,steer:0,justFire:false,aimX:0,aimY:0,hasAim:false},1/60,{practice:true});
  assert.equal(w.battle.player.damageDealt,before-w.dummy.hp);
  assert.ok(w.battle.player.damageDealt>0);
  assert.equal(w.battle.player.hits,0);
});
it('records howitzer splash damage without inventing a facet or penetration', () => {
  const w=createWorld('m7-priest');
  w.cover=[];w.player.x=0;w.player.y=0;w.dummy.x=0;w.dummy.y=20;w.dummy.hp=1;
  w.artyMode='lob';
  stepWorld(w,{throttle:0,steer:0,justFire:true,aimX:0,aimY:20,hasAim:true},1/60,{practice:true});
  assert.equal(w.battle.player.shots,1);
  assert.equal(w.battle.player.damageDealt,1);
  assert.equal(w.battle.player.penetrations,0);
  assert.deepEqual(w.battle.player.facets,{});
});
