import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import LEVELS from '../src/data/levels.json';
import {KEYS,serialize,parseLevels,check,normalize,tally,findQueens,findTrays,blankLevel} from '../src/format.js';

const demo=fs.readFileSync(new URL('./fixtures/level_demo.json',import.meta.url),'utf8').replace(/\r\n/g,'\n');

describe('level format',()=>{
  it('writes the game file back byte for byte',()=>{
    expect(serialize(JSON.parse(demo))).toBe(demo.trim());
    expect(serialize(LEVELS[0])).toBe(demo.trim());
  });
  it('keeps the key order of the game file',()=>{
    expect(Object.keys(JSON.parse(demo))).toEqual(KEYS);
    expect(Object.keys(normalize({Name:'x',WallRows:[]}))).toEqual(KEYS);
  });
  it('reads one level, a list, or objects pasted one after another',()=>{
    expect(parseLevels(demo)).toHaveLength(1);
    expect(parseLevels(JSON.stringify([JSON.parse(demo),JSON.parse(demo)]))).toHaveLength(2);
    expect(parseLevels(demo+'\n'+demo)).toHaveLength(2);
    expect(parseLevels('{"foo":1}')).toHaveLength(0);
  });
  it('finds no problems in the built-in levels and a new level',()=>{
    for(const lv of LEVELS)expect(check(lv)).toEqual([]);
    expect(check(blankLevel('L1')).filter(i=>i.lvl==='bad')).toEqual([]);
  });
  it('reads the L10 elements',()=>{
    const lv=JSON.parse(demo),t=tally(lv);
    expect(findQueens(lv.WallRows).queens).toEqual([{r:23,c:5},{r:26,c:1},{r:26,c:9}]);
    expect(findTrays(lv.BoardElements).trays).toEqual([{r:3,c:2}]);
    expect(t.choco).toBe(6);expect(lv.BoardElements[3][5]).toBe('6');expect(t.locks).toBe(2);expect(t.queens).toBe(3);
    expect(t.ants+t.queens*4).toBe(12*28);
  });
  it('flags rows that do not line up',()=>{
    const lv=JSON.parse(demo);lv.WallHp[0]='12';lv.SlotLocks='000';lv.TrayBottles=[];
    const bad=check(lv).filter(i=>i.lvl==='bad').map(i=>i.t).join('\n');
    expect(bad).toMatch(/WallHp row 1/);expect(bad).toMatch(/SlotLocks has 3/);expect(bad).toMatch(/TrayBottles lists 0/);
  });
});
