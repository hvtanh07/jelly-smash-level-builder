import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import {newGame,step,ammoFor,pickTarget,useBooster,simulate,findGroups,available,trySwap,spawnWeights} from '../src/engine.js';
import {normalize,check,tally} from '../src/format.js';

const demo=JSON.parse(fs.readFileSync(new URL('./fixtures/level_demo.json',import.meta.url),'utf8'));
/* a small level: 4 columns, 3 rows, plain 6×6 board */
function mini(o={}){return normalize({...demo,Colors:'RBGY',WallRows:['RRBB','GGYY','RBGY'],WallHp:['1111','1111','1111'],
  BoardWidth:6,BoardHeight:6,BoardRows:Array(6).fill('......'),BoardElements:Array(6).fill('......'),TrayBottles:[],SlotLocks:'00000',...o});}
const run=(G,t)=>{for(let i=0;i<t*60;i++)step(G,1/60);};
const settle=G=>{run(G,1);G.events.length=0;};
const land=(G,color,ammo)=>G.flights.push({color,ammo,n:3,t:0,dur:0,at:{r:0,c:0}});

describe('rules',()=>{
  it('ammo = 2n - 3',()=>{expect([3,4,5,10].map(ammoFor)).toEqual([3,5,7,17]);});
  it('starts with no match on the board',()=>{
    for(let s=1;s<20;s++){const G=newGame(demo,{seed:s});settle(G);expect(findGroups(G)).toEqual([]);expect(G.state).toBe('idle');}
  });
  it('aims at the lowest front ant of its color, left to right',()=>{
    const G=newGame(mini(),{seed:1});
    expect(pickTarget(G,'R')).toMatchObject({r:2,c:0});
    expect(pickTarget(G,'G')).toMatchObject({r:2,c:2});
    expect(pickTarget(G,'Y')).toMatchObject({r:2,c:3});
  });
  it('queens take any color',()=>{
    const lv=mini({WallRows:['RRBB','QQYY','QQGY'],WallHp:['1111','1111','1131']});
    const G=newGame(lv,{seed:1});
    expect(G.ants.find(a=>a.queen).hp).toBe(demo.QueenHp);
    expect(pickTarget(G,'B').queen).toBe(true);
    expect(available(G,'G')).toBe(3+demo.QueenHp);
  });
  it('locked slots count down for each cannon that enters a slot',()=>{
    const G=newGame(mini({SlotLocks:'00012'}),{seed:1});settle(G);G.wy=-5;
    land(G,'R',3);step(G,1/60);
    expect(G.slots.map(s=>s.lock)).toEqual([0,0,0,0,1]);
    land(G,'B',3);step(G,1/60);
    expect(G.slots.map(s=>s.lock)).toEqual([0,0,0,0,0]);
  });
  it('a cannon of a color already in the slots merges into it at once',()=>{
    const G=newGame(mini({WallRows:['RRRR','RRRR','RRRR']}),{seed:1});settle(G);G.wy=-5;   // wall out of view: cannons wait
    land(G,'R',3);step(G,1/60);land(G,'R',4);step(G,1/60);
    expect(G.slots.filter(s=>s.cannon).length).toBe(1);
    expect(G.slots[0].cannon.ammo).toBe(7);
  });
  it('full slots lose the new cannon',()=>{
    const G=newGame(mini({SlotCount:2,SlotLocks:'00'}),{seed:1});settle(G);G.wy=-5;
    land(G,'R',3);land(G,'B',3);land(G,'G',3);step(G,1/60);
    expect(G.stats.lost).toBe(1);
  });
  it('full slots still merge a cannon of a color already in the slots',()=>{
    const G=newGame(mini({SlotCount:2,SlotLocks:'00'}),{seed:1});settle(G);G.wy=-5;
    land(G,'R',3);step(G,1/60);land(G,'B',3);step(G,1/60);land(G,'R',5);step(G,1/60);
    expect(G.stats.lost).toBe(0);
    expect(G.slots.map(s=>s.cannon&&s.cannon.ammo)).toEqual([8,3]);
  });
  it('chocoStarves: cells below a chocolate get no new cubes',()=>{
    for(const starve of [true,false]){
      const G=newGame(mini({BoardElements:['......','......','999999','......','......','......']}),{seed:3,chocoStarves:starve});settle(G);G.wy=-5;
      const cols='BGYBGY';for(let r=3;r<6;r++)for(let c=0;c<6;c++)G.cells[r][c].color=cols[(c+r)%6];
      ['R','R','G','R'].forEach((k,c)=>{G.cells[5][c].color=k;});
      expect(trySwap(G,[5,2],[5,3])).toBeTruthy();run(G,3);
      const empty=[3,4,5].flatMap(r=>G.cells[r]).filter(x=>x.kind==='empty').length;
      if(starve)expect(empty).toBeGreaterThanOrEqual(3);else expect(empty).toBe(0);
    }
  });
  it('chocoStarves: cells below a hole get cubes that slide in diagonally from the next column',()=>{
    const G=newGame(mini({BoardRows:['#.....','......','#.####','......','......','......']}),{seed:3,chocoStarves:true});settle(G);G.wy=-5;
    const cols='BGYBGY';for(let r=0;r<6;r++)for(let c=0;c<6;c++){const x=G.cells[r][c];if(x)x.color=cols[(c+r)%6];}
    ['R','R','G','R'].forEach((k,c)=>{G.cells[5][c].color=k;});
    expect(trySwap(G,[5,2],[5,3])).toBeTruthy();run(G,3);
    // cols 0-2 cleared: col 0 (top hole only) and col 1 refill from the top, col 2 (hole at row 2) is fed from col 1 diagonally
    expect([3,4,5].flatMap(r=>[0,1,2].map(c=>G.cells[r][c].kind))).not.toContain('empty');
  });
  it('RefillColors: new cubes only get the listed colors',()=>{
    const G=newGame(mini({RefillColors:'BY'}),{seed:5});settle(G);
    const w=spawnWeights(G);expect([...w.keys()].sort()).toEqual(['B','Y']);
    const G2=newGame(mini({}),{seed:5});settle(G2);expect(spawnWeights(G2).size).toBeGreaterThanOrEqual(4);
  });
  it('an Armored Ant takes HP shots',()=>{
    const G=newGame(mini({WallHp:['1111','1111','3111']}),{seed:1});settle(G);
    land(G,'R',3);run(G,2);
    const a=G.ants.find(a=>a.r===2&&a.c===0);
    expect(a.alive).toBe(false);
    expect(G.ants.find(a=>a.r===0&&a.c===0).alive).toBe(true);
  });
  it('Hand fires the fullest cannon at any ant of its color',()=>{
    const G=newGame(mini(),{seed:1});settle(G);G.wy=-5;
    land(G,'R',5);step(G,1/60);
    expect(useBooster(G,'hand')).toBe(true);
    G.wy=-5;run(G,1);
    expect(G.ants.filter(a=>a.color==='R'&&a.alive).length).toBe(0);
    expect(G.slots.every(s=>!s.cannon)).toBe(true);
  });
  it('the same seed plays the same game',()=>{
    expect(simulate(demo,{seed:7,maxTime:60})).toEqual(simulate(demo,{seed:7,maxTime:60}));
  });
  it('a slow small level can be won',()=>{
    expect(simulate(mini({WallDescentPerSecond:0.02}),{seed:3,maxTime:300}).result).toBe('win');
  });
});

describe('chocolate HP and start colors',()=>{
  it('reads the chocolate HP digit and the start color under it',()=>{
    const G=newGame(demo,{seed:1});
    expect(G.cells[3][5]).toMatchObject({kind:'choco',layers:6,color:'B'});
    expect(G.cells[3][6]).toMatchObject({kind:'choco',layers:3});
  });
  it('a color letter in BoardRows fixes the start color of that cube',()=>{
    const rows=Array(6).fill('......');rows[0]='RR.B..';
    for(let s=1;s<10;s++){const G=newGame(mini({BoardRows:rows}),{seed:s});
      expect(G.cells[0][0].color).toBe('R');expect(G.cells[0][1].color).toBe('R');expect(G.cells[0][3].color).toBe('B');}
  });
});

describe('fixed start cubes',()=>{
  it('random cubes never complete a line with fixed cubes at the start',()=>{
    const rows=Array(6).fill('......');rows[2]='.RR.RR';rows[3]='B.B.B.';
    for(let s=1;s<40;s++){const G=newGame(mini({BoardRows:rows}),{seed:s});
      expect(findGroups(G)).toEqual([]);
      expect([G.cells[2][1].color,G.cells[2][2].color,G.cells[3][0].color]).toEqual(['R','R','B']);}
  });
});

describe('SlotLocks with commas',()=>{
  it('reads locks of 10 or more',()=>{const G=newGame(mini({SlotLocks:'0,0,0,2,10'}),{seed:1});expect(G.slots.map(s=>s.lock)).toEqual([0,0,0,2,10]);});
  it('passes the check and counts both locks',()=>{const lv=normalize(mini({SlotLocks:'0,0,0,2,10'}));expect(check(lv).filter(i=>i.lvl==='bad').map(i=>i.t).filter(t=>/Slot/.test(t))).toEqual([]);expect(tally(lv).locks).toBe(2);});
  it('flags a wrong count',()=>{const lv=normalize(mini({SlotLocks:'0,2,10'}));expect(check(lv).some(i=>i.lvl==='bad'&&/SlotLocks has 3 values/.test(i.t))).toBe(true);});
});
describe('empty SlotLocks',()=>{
  it('opens every slot',()=>{const G=newGame(mini({SlotLocks:''}),{seed:1});expect(G.slots.map(s=>s.lock)).toEqual([0,0,0,0,0]);});
});
