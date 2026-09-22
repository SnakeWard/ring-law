import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ARTILLERY_LINES, ARTILLERY_TIERS, NATIONS, artilleryNodesFor, canPlay, emptyGarage,
  parseGarage, specAt, hullTier, hullFitsLobby, hullById, vehicleInfoSheetFor,
  howitzerHullDistance, howitzerBlastDamage, howitzerChipHp, howitzerReloadS } from './index.ts';
import { createWorld, stepWorld } from '../game/sim.ts';

describe('expanded artillery', () => {
  for (const nation of NATIONS) {
    it(`${nation}: free T1 and nation-specific T5/T10 unlocks survive save loading`, () => {
      const ids = ARTILLERY_LINES[nation];
      assert.deepEqual(artilleryNodesFor(nation).map(n => n.tier), [1,5,10]);
      const g = emptyGarage();
      assert.equal(canPlay(g, ids[0]), true);
      assert.equal(canPlay(g, ids[1]), false);
      assert.equal(canPlay(g, ids[2]), false);
      g.researched[specAt(nation, 4).hullId!] = true;
      assert.equal(canPlay(g, ids[1]), false);
      g.researched[specAt(nation, 5).hullId!] = true;
      assert.equal(canPlay(parseGarage(JSON.parse(JSON.stringify(g))), ids[1]), true);
      assert.equal(canPlay(g, ids[2]), false);
      for (const other of NATIONS.filter(n => n !== nation)) assert.equal(canPlay(g, ARTILLERY_LINES[other][1]), false);
      g.researched[specAt(nation, 10).hullId!] = true;
      assert.equal(canPlay(g, ids[2]), true);
      ids.forEach((id,i) => {
        assert.equal(hullTier(id), ARTILLERY_TIERS[i]);
        const sheet = vehicleInfoSheetFor(id)!;
        assert.ok(sheet.brief.script.length > 80);
        assert.ok(sheet.technical.some(row => row.label === 'HE impact / reload'));
      });
      assert.equal(hullFitsLobby(ids[0], ids[2], () => true), false);
      for (const id of ids.slice(1)) {
        assert.equal(hullTier(createWorld(id).dummy.blueprintId), hullTier(id));
      }
    });
  }
  it('measures distance from a rotated footprint, including bow and side hits', () => {
    for (const yawDeg of [0,45,90,135,180,-45]) {
      const angle=yawDeg*Math.PI/180;
      const hull={x: 10,y: 20,yawDeg};
      const point=(f:number,r:number)=>({x:10-Math.sin(angle)*f+Math.cos(angle)*r,y:20+Math.cos(angle)*f+Math.sin(angle)*r});
      const bow=point(3,0), side=point(0,2), miss=point(0,3);
      assert.ok(howitzerHullDistance(bow.x,bow.y,hull,6,4)<1e-9);
      assert.ok(howitzerHullDistance(side.x,side.y,hull,6,4)<1e-9);
      assert.ok(Math.abs(howitzerHullDistance(miss.x,miss.y,hull,6,4)-1)<1e-9);
    }
    assert.equal(howitzerBlastDamage(0,105),150);
    assert.ok(howitzerBlastDamage(1,105)<150);
    assert.equal(howitzerBlastDamage(2,105),0);
  });
  for (const id of Object.values(ARTILLERY_LINES).flat()) {
    it(`${id}: lob bow hit damages a Tiger and applies the caliber reload`, () => {
      const w=createWorld(id,0,'he','range',{enemyIds:['tiger-i']});
      w.cover=[];
      w.artyMode='lob';
      w.player.x=0; w.player.y=-25;
      w.dummy.x=0; w.dummy.y=20; w.dummy.yawDeg=0;
      const tiger=hullById('tiger-i')!;
      const gun=hullById(id)!.weapons[0];
      const before=w.dummy.hp;
      stepWorld(w,{throttle:0,steer:0,justFire:true,aimX:0,aimY:20+tiger.lengthM/2-0.1,hasAim:true},1/60,{practice:true});
      assert.equal(before-w.dummy.hp, howitzerChipHp(gun.caliberMm));
      assert.ok(before-w.dummy.hp>=100,'meaningful starter HE damage');
      assert.ok(w.reload>howitzerReloadS(gun.caliberMm)-0.1);
    });
  }
});
