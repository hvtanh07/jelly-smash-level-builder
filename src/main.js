import './style.css';
import ORIGINAL from './data/levels.json';
import {KEYS,PALETTE,COLOR_KEYS,colorHex,colorName,QUEEN,EMPTY,HOLE,CHOCO,TRAY,isChoco,chocoHp,DIFFICULTY,TUNING,DEFAULTS,
  normalize,serialize,serializeAll,parseLevels,blankLevel,findQueens,findTrays,hpAt,tally,check,statusOf,wallSize} from './format.js';
import {newGame,step,trySwap,canSwap,useBooster,canBooster,botMove,findMove,simulate} from './engine.js';
import {LW,layoutOf,draw,cellAt,eventPops} from './render.js';

const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
const NS='http://www.w3.org/2000/svg';
const STORE='jellySmashLevelBuilder.v1';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=o=>JSON.parse(JSON.stringify(o));
const inFrame=(()=>{try{return window.self!==window.top;}catch(e){return true;}})();

/* ---------- state ---------- */
let levels=[],cur=0,tab='level',mode='edit';
let undo=[],redo=[],lastSnap='';
let tool='color',brushColor='R',brushHp=1;
let prefs={chocoLayers:3,botRuns:20,botThink:0.5,zoom:'width'};
let chocoBrush='3';
const L=()=>levels[cur];

const BASE=(()=>{const t=JSON.stringify(ORIGINAL);let h=0;for(let i=0;i<t.length;i++)h=(h*31+t.charCodeAt(i))|0;return String(h>>>0);})();
let savedBase=BASE;
function load(){
  let saved=null;
  try{saved=JSON.parse(localStorage.getItem(STORE)||'null');}catch(e){}
  if(saved&&Array.isArray(saved.levels)&&saved.levels.length){levels=saved.levels.map(normalize);cur=Math.min(saved.cur|0,levels.length-1);savedBase=saved.base||'';}
  else{levels=ORIGINAL.map(normalize);cur=0;}
  try{const p=JSON.parse(localStorage.getItem(STORE+'.prefs')||'{}');Object.assign(prefs,p.prefs||{});if(p.tool)tool=p.tool;if(p.brushColor)brushColor=p.brushColor;if(p.brushHp)brushHp=p.brushHp;if(p.chocoBrush)chocoBrush=p.chocoBrush;}catch(e){}
}
const STALE='The built-in levels changed since you last saved here. Press Reset to sheet to load them (export first to keep your edits).';
function persist(){
  try{localStorage.setItem(STORE,JSON.stringify({levels,cur,base:savedBase}));$('#saveNote').textContent=savedBase===BASE?'Changes are saved in this browser.':STALE;}
  catch(e){$('#saveNote').textContent='This browser is not saving changes. Export before you close the page.';}
}
function savePrefs(){try{localStorage.setItem(STORE+'.prefs',JSON.stringify({prefs,tool,brushColor,brushHp,chocoBrush}));}catch(e){}}
const origByName=n=>ORIGINAL.find(o=>o.Name===n);
const isChanged=lv=>{const o=origByName(lv.Name);return !o||serialize(o)!==serialize(lv);};

/* ---------- history ---------- */
function resetHistory(){undo=[];redo=[];lastSnap=JSON.stringify(L());syncUndo();}
function commit(){
  const s=JSON.stringify(L());if(s===lastSnap)return;
  undo.push(lastSnap);if(undo.length>200)undo.shift();redo=[];lastSnap=s;persist();syncUndo();refreshList();refreshChecks();
}
function doUndo(){if(!undo.length)return;redo.push(lastSnap);lastSnap=undo.pop();levels[cur]=JSON.parse(lastSnap);persist();syncUndo();renderAll();}
function doRedo(){if(!redo.length)return;undo.push(lastSnap);lastSnap=redo.pop();levels[cur]=JSON.parse(lastSnap);persist();syncUndo();renderAll();}
function syncUndo(){$('#tUndo').disabled=!undo.length;$('#tRedo').disabled=!redo.length;}

/* ---------- level list ---------- */
let listStatus=[];
function refreshAllStatus(){listStatus=levels.map(lv=>statusOf(check(lv)));}
const diffName=d=>(DIFFICULTY.find(x=>x.v===d)||{name:'Difficulty '+d}).name;
function refreshList(){
  listStatus[cur]=statusOf(check(L()));
  const q=$('#lvSearch').value.trim().toLowerCase();
  $('#lvList').innerHTML=levels.map((lv,i)=>{
    if(q&&!(String(lv.Name).toLowerCase().includes(q)||String(i+1)===q))return '';
    const st=listStatus[i]||'ok',ch=isChanged(lv),t=tally(lv),w=wallSize(lv);
    const el=[];if(t.choco)el.push('choco');if(t.locks)el.push('locks');if(t.armored)el.push('armor');if(t.trays)el.push('bottle');if(t.queens)el.push('queen');
    return `<li><button type="button" class="lv" data-i="${i}" aria-current="${i===cur}"><span class="n">${i+1}</span><span><span class="t">${esc(lv.Name)}${ch?' <i class="sr">changed</i>':''}</span><span class="m">${ch?'<i>● </i>':''}${lv.Difficulty>0?`<b class="hard">${esc(diffName(lv.Difficulty).toUpperCase())}</b> · `:''}${w.cols}×${w.rows} wall · ${lv.BoardWidth}×${lv.BoardHeight}${el.length?' · '+el.join(', '):''}</span></span><span class="dot ${st}" title="${st==='ok'?'No problems':st==='warn'?'Has warnings':'Has errors'}"></span></button></li>`;
  }).join('');
  const a=$('#lvList [aria-current="true"]');if(a)a.scrollIntoView({block:'nearest'});
}
function selectLevel(i){
  if(i<0||i>=levels.length)return;
  if(mode==='play')setMode('edit');
  cur=i;resetHistory();persist();renderAll();
}
$('#lvList').addEventListener('click',e=>{const b=e.target.closest('.lv');if(b)selectLevel(+b.dataset.i);});
$('#lvSearch').addEventListener('input',refreshList);
function uniqueName(base){let n=base,k=2;while(levels.some(l=>l.Name===n))n=`${base} ${k++}`;return n;}
$('#lvNew').addEventListener('click',()=>{
  const m=/(\d+)$/.exec(L().Name||'');const lv=blankLevel(uniqueName(m?'L'+(Math.max(...levels.map(l=>+((/(\d+)$/.exec(l.Name)||[0,0])[1])))+1):'New level'));
  levels.splice(cur+1,0,lv);refreshAllStatus();selectLevel(cur+1);toast(`Made ${lv.Name}.`);
});
$('#lvDup').addEventListener('click',()=>{
  const c=clone(L());c.Name=uniqueName(L().Name+' copy');levels.splice(cur+1,0,c);refreshAllStatus();selectLevel(cur+1);toast(`Made ${c.Name}.`);
});
$('#lvUp').addEventListener('click',()=>{if(cur<1)return;[levels[cur-1],levels[cur]]=[levels[cur],levels[cur-1]];cur--;refreshAllStatus();persist();refreshList();});
$('#lvDown').addEventListener('click',()=>{if(cur>=levels.length-1)return;[levels[cur+1],levels[cur]]=[levels[cur],levels[cur+1]];cur++;refreshAllStatus();persist();refreshList();});
function arm(btn,label,fn){
  if(btn.classList.contains('armed')){btn.classList.remove('armed');btn.textContent=btn.dataset.label;fn();return;}
  btn.dataset.label=btn.textContent;btn.classList.add('armed');btn.textContent=label;
  setTimeout(()=>{if(btn.classList.contains('armed')){btn.classList.remove('armed');btn.textContent=btn.dataset.label;}},3500);
}
$('#lvDel').addEventListener('click',e=>arm(e.currentTarget,'Confirm delete',()=>{
  if(levels.length<=1){toast('Keep at least one level.');return;}
  const n=L().Name;levels.splice(cur,1);cur=Math.min(cur,levels.length-1);refreshAllStatus();persist();selectLevel(cur);toast(`Deleted ${n}.`);
}));
$('#btnReset').addEventListener('click',e=>arm(e.currentTarget,'Confirm reset',()=>{
  levels=ORIGINAL.map(normalize);cur=0;savedBase=BASE;refreshAllStatus();persist();selectLevel(0);
  toast(`Back to the sheet: ${levels.length} level${levels.length>1?'s':''}.`);
}));

/* ---------- editing helpers ---------- */
const setCh=(s,i,ch)=>s.slice(0,i)+ch+s.slice(i+1);
function wallSet(lv,r,c,ch,hp){lv.WallRows[r]=setCh(lv.WallRows[r],c,ch);if(hp!=null){while(lv.WallHp.length<=r)lv.WallHp.push('1'.repeat(lv.WallRows[r].length));lv.WallHp[r]=setCh(lv.WallHp[r].padEnd(lv.WallRows[r].length,'1'),c,String(hp));}}
function removeQueenAt(lv,r,c){
  const {queens}=findQueens(lv.WallRows);
  const q=queens.find(q=>r>=q.r&&r<q.r+2&&c>=q.c&&c<q.c+2);
  if(q){for(let y=0;y<2;y++)for(let x=0;x<2;x++)wallSet(lv,q.r+y,q.c+x,EMPTY,0);return true;}
  if(lv.WallRows[r][c]===QUEEN){wallSet(lv,r,c,EMPTY,0);return true;}
  return false;
}
function trayMap(lv){const m=new Map();findTrays(lv.BoardElements).trays.forEach((t,i)=>m.set(t.r+','+t.c,(lv.TrayBottles||[])[i]));return m;}
function syncTrays(lv,before){
  const t=findTrays(lv.BoardElements).trays,def=(lv.Colors||'RBGY').padEnd(4,'RBGY').slice(0,4);
  lv.TrayBottles=t.map(x=>before.get(x.r+','+x.c)||def);
}
function removeTrayAt(lv,r,c){
  const {trays}=findTrays(lv.BoardElements);const t=trays.find(t=>r>=t.r&&r<t.r+2&&c>=t.c&&c<t.c+2);
  if(t){for(let y=0;y<2;y++)for(let x=0;x<2;x++)lv.BoardElements[t.r+y]=setCh(lv.BoardElements[t.r+y],t.c+x,'.');return true;}
  if(lv.BoardElements[r][c]===TRAY){lv.BoardElements[r]=setCh(lv.BoardElements[r],c,'.');return true;}
  return false;
}
let strokeState=null;
function applyTool(hit,first){
  const lv=L();
  if(hit.area==='wall'){
    const {r,c}=hit,ch=lv.WallRows[r][c];
    if(tool==='color'){if(ch===QUEEN)removeQueenAt(lv,r,c);const was=lv.WallRows[r][c];wallSet(lv,r,c,brushColor,was===EMPTY?1:hpAt(lv,r,c));}
    else if(tool==='hp'){if(ch!==EMPTY&&ch!==QUEEN)wallSet(lv,r,c,ch,brushHp);}
    else if(tool==='erase'){if(ch===QUEEN)removeQueenAt(lv,r,c);else wallSet(lv,r,c,EMPTY,0);}
    else if(tool==='queen'&&first){
      const R=lv.WallRows.length,C=lv.WallRows[0].length,r0=Math.min(r,R-2),c0=Math.min(c,C-2);
      if(R<2||C<2)return;
      if(ch===QUEEN&&first){removeQueenAt(lv,r,c);return;}
      for(let y=0;y<2;y++)for(let x=0;x<2;x++)if(lv.WallRows[r0+y][c0+x]===QUEEN)removeQueenAt(lv,r0+y,c0+x);
      for(let y=0;y<2;y++)for(let x=0;x<2;x++)wallSet(lv,r0+y,c0+x,QUEEN,1);
    }
  }else if(hit.area==='board'){
    const {r,c}=hit,before=trayMap(lv);
    const cellOn=lv.BoardRows[r][c]!==HOLE,el=lv.BoardElements[r][c];
    if(tool==='cell'){
      if(first)strokeState=!cellOn;
      if(strokeState){if(!cellOn)lv.BoardRows[r]=setCh(lv.BoardRows[r],c,'.');}
      else{if(el===TRAY)removeTrayAt(lv,r,c);lv.BoardElements[r]=setCh(lv.BoardElements[r],c,'.');lv.BoardRows[r]=setCh(lv.BoardRows[r],c,HOLE);}
    }else if(tool==='choco'){
      if(el===TRAY)removeTrayAt(lv,r,c);
      if(lv.BoardRows[r][c]===HOLE)lv.BoardRows[r]=setCh(lv.BoardRows[r],c,'.');lv.BoardElements[r]=setCh(lv.BoardElements[r],c,chocoBrush);
    }else if(tool==='bcolor'){
      if(first)strokeState=lv.BoardRows[r][c]===brushColor?'.':brushColor;
      if(el!==TRAY)lv.BoardRows[r]=setCh(lv.BoardRows[r],c,strokeState);
    }else if(tool==='clear'){
      if(el===TRAY)removeTrayAt(lv,r,c);else lv.BoardElements[r]=setCh(lv.BoardElements[r],c,'.');
    }else if(tool==='tray'&&first){
      if(el===TRAY){removeTrayAt(lv,r,c);syncTrays(lv,before);return;}
      const r0=Math.min(r,lv.BoardHeight-2),c0=Math.min(c,lv.BoardWidth-2);if(r0<0||c0<0)return;
      for(let y=0;y<2;y++)for(let x=0;x<2;x++){if(lv.BoardElements[r0+y][c0+x]===TRAY)removeTrayAt(lv,r0+y,c0+x);}
      for(let y=0;y<2;y++)for(let x=0;x<2;x++){lv.BoardRows[r0+y]=setCh(lv.BoardRows[r0+y],c0+x,'.');lv.BoardElements[r0+y]=setCh(lv.BoardElements[r0+y],c0+x,TRAY);}
    }
    syncTrays(lv,before);
  }else if(hit.area==='slot'&&first){
    const s=String(lv.SlotLocks).padEnd(lv.SlotCount,'0').split('');s[hit.i]=String(((+s[hit.i]||0)+(hit.shift?9:1))%10);lv.SlotLocks=s.join('');
  }
}

/* ---------- design view (SVG) ---------- */
const svg=$('#edit');
function el(tag,attrs,parent){const n=document.createElementNS(NS,tag);for(const k in attrs)n.setAttribute(k,attrs[k]);if(parent)parent.appendChild(n);return n;}
function editLayout(lv){
  const R=lv.WallRows.length,C=Math.max(1,...lv.WallRows.map(r=>r.length));
  const wc=LW/C,bc=Math.min(46,LW/Math.max(1,lv.BoardWidth));
  const wallH=R*wc,viewTop=wallH-(+lv.WallStartVisibleRows||0)*wc,red=viewTop+(+lv.LoseDepthCells||0)*wc;
  const slotTop=Math.max(red,wallH)+14,slotH=46,boardTop=slotTop+slotH+14,bx0=(LW-bc*lv.BoardWidth)/2;
  const n=Math.max(1,+lv.SlotCount||1),sg=6,sw=(LW-(n-1)*sg)/n;
  return {R,C,wc,bc,wallH,viewTop,red,slotTop,slotH,boardTop,bx0,sw,sg,n,H:boardTop+bc*lv.BoardHeight};
}
function renderEdit(){
  const lv=L(),E=editLayout(lv);
  svg.innerHTML='';
  svg.setAttribute('viewBox',`-34 -8 ${LW+44} ${E.H+16}`);
  const wrap=$('#editWrap'),kw=(wrap.clientWidth-24)/(LW+44),kh=(wrap.clientHeight-24)/(E.H+16);
  const k=Math.max(0.3,Math.min(1.6,prefs.zoom==='height'?Math.min(kw,kh):kw));
  svg.style.width=(LW+44)*k+'px';svg.style.height=(E.H+16)*k+'px';
  // start view band and red line
  el('rect',{class:'viewband',x:-4,y:E.viewTop,width:LW+8,height:E.red-E.viewTop,rx:8},svg);
  const vt=el('text',{class:'lbl-s',x:LW+6,y:E.viewTop+12,'text-anchor':'start'},svg);vt.textContent='view';
  // wall
  const {queens}=findQueens(lv.WallRows);
  const qcell=new Set();queens.forEach(q=>{for(let y=0;y<2;y++)for(let x=0;x<2;x++)qcell.add((q.r+y)+','+(q.c+x));});
  const g=el('g',{},svg),s=E.wc*0.88,o=(E.wc-s)/2;
  lv.WallRows.forEach((row,r)=>{
    if(r%2===0||r===E.R-1){const t=el('text',{class:'rown',x:-6,y:r*E.wc+E.wc/2},svg);t.textContent=String(r+1);}
    for(let c=0;c<row.length;c++){const k=row[c],x=c*E.wc,y=r*E.wc;
      if(k===EMPTY){el('rect',{class:'empty',x:x+o,y:y+o,width:s,height:s,rx:s*0.22},g);continue;}
      if(k===QUEEN){if(!qcell.has(r+','+c))el('rect',{class:'stray',x:x+o,y:y+o,width:s,height:s,rx:s*0.22},g);continue;}
      const hp=hpAt(lv,r,c),known=String(lv.Colors||'').includes(k);
      const rc=el('rect',{class:'ant'+(hp>1?' armored':'')+(known?'':' unknown'),x:x+o,y:y+o,width:s,height:s,rx:s*0.22,fill:colorHex(k)},g);
      el('title',{},rc).textContent=`Row ${r+1}, cell ${c+1}: ${colorName(k)}, HP ${hp}${hp>1?` (Armored Ant, armor ${hp-1})`:''}`;
      if(hp>1){const t=el('text',{class:'armor',x:x+E.wc/2,y:y+E.wc/2,'font-size':Math.max(9,E.wc*0.48)},g);t.textContent=String(hp-1);}
    }
  });
  queens.forEach(q=>{const x=q.c*E.wc,y=q.r*E.wc,w=E.wc*2;
    el('rect',{class:'queen',x:x+o,y:y+o,width:w-o*2,height:w-o*2,rx:E.wc*0.4},g);
    const t=el('text',{class:'qhp',x:x+w/2,y:y+w*0.58,'font-size':Math.min(20,E.wc*0.75)},g);t.textContent='♛ '+(+lv.QueenHp||0);
  });
  el('line',{class:'redline',x1:-4,x2:LW+4,y1:E.red,y2:E.red},svg);
  const rl=el('text',{class:'lbl-s red',x:LW+6,y:E.red+4,'text-anchor':'start'},svg);rl.textContent='lose';
  // slots
  const locks=String(lv.SlotLocks||'');
  for(let i=0;i<E.n;i++){const x=i*(E.sw+E.sg),lk=+locks[i]||0;
    el('rect',{class:'slot'+(lk?' locked':''),x,y:E.slotTop,width:E.sw,height:E.slotH,rx:10},svg);
    const t=el('text',{class:'slotn',x:x+E.sw/2,y:E.slotTop+E.slotH/2},svg);t.textContent=lk?'🔒 '+lk:'open';
  }
  // board
  const bs=E.bc*0.9,bo=(E.bc-bs)/2;
  for(let r=0;r<lv.BoardHeight;r++)for(let c=0;c<lv.BoardWidth;c++){
    const x=E.bx0+c*E.bc,y=E.boardTop+r*E.bc,on=(lv.BoardRows[r]||'')[c]!==HOLE,e=(lv.BoardElements[r]||'')[c];
    if(!on){el('rect',{class:'hole',x:x+1,y:y+1,width:E.bc-2,height:E.bc-2,rx:6},svg);continue;}
    el('rect',{class:'bcell'+((r+c)%2?' alt':''),x,y,width:E.bc,height:E.bc},svg);
    const pc=(lv.BoardRows[r]||'')[c],preset=/^[A-Z]$/.test(pc)?pc:null;
    if(preset&&!isChoco(e)&&e!==TRAY){const q=el('rect',{class:'preset',x:x+bo+2,y:y+bo+2,width:bs-4,height:bs-4,rx:bs*0.22,fill:colorHex(preset)},svg);
      el('title',{},q).textContent=`Starts as ${colorName(preset)}`;}
    if(isChoco(e)){el('rect',{class:'choco',x:x+bo,y:y+bo,width:bs,height:bs,rx:bs*0.18},svg);
      const t=el('text',{class:'chocon'+(e===CHOCO?' def':''),x:x+E.bc/2,y:y+E.bc/2,'font-size':E.bc*0.42},svg);t.textContent=String(chocoHp(e,prefs.chocoLayers));
      if(preset)el('circle',{class:'presetdot',cx:x+E.bc-bo-7,cy:y+bo+7,r:5,fill:colorHex(preset)},svg);}
  }
  findTrays(lv.BoardElements).trays.forEach((t,i)=>{const x=E.bx0+t.c*E.bc,y=E.boardTop+t.r*E.bc;
    el('rect',{class:'tray',x:x+3,y:y+3,width:E.bc*2-6,height:E.bc*2-6,rx:10},svg);
    [...String((lv.TrayBottles||[])[i]||'')].forEach((k,j)=>{const bx=x+(j%2+0.5)*E.bc,by=y+(Math.floor(j/2)+0.5)*E.bc;
      el('rect',{class:'bottle',x:bx-E.bc*0.17,y:by-E.bc*0.2,width:E.bc*0.34,height:E.bc*0.48,rx:5,fill:colorHex(k)},svg);
      el('rect',{class:'bottle',x:bx-E.bc*0.08,y:by-E.bc*0.33,width:E.bc*0.16,height:E.bc*0.15,rx:3,fill:colorHex(k)},svg);});
    const n=el('text',{class:'trayn',x:x+8,y:y+12},svg);n.textContent='T'+(i+1);
  });
  findTrays(lv.BoardElements).stray.forEach(s=>el('rect',{class:'stray',x:E.bx0+s.c*E.bc+2,y:E.boardTop+s.r*E.bc+2,width:E.bc-4,height:E.bc-4,rx:6},svg));
  if(hover){const h=hover;
    if(h.area==='wall'){const w=tool==='queen'?2:1;el('rect',{class:'hov',x:Math.min(h.c,E.C-w)*E.wc,y:Math.min(h.r,E.R-w)*E.wc,width:E.wc*w,height:E.wc*w,rx:5},svg);}
    if(h.area==='board'){const w=tool==='tray'?2:1;el('rect',{class:'hov',x:E.bx0+Math.min(h.c,lv.BoardWidth-w)*E.bc,y:E.boardTop+Math.min(h.r,lv.BoardHeight-w)*E.bc,width:E.bc*w,height:E.bc*w,rx:6},svg);}
  }
}
let hover=null,painting=false;
function hitAt(e){
  const lv=L(),E=editLayout(lv),pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;
  const p=pt.matrixTransform(svg.getScreenCTM().inverse());
  if(p.y>=0&&p.y<E.wallH&&p.x>=0&&p.x<LW){const r=Math.floor(p.y/E.wc),c=Math.floor(p.x/E.wc);if(r<E.R&&c<(lv.WallRows[r]||'').length)return {area:'wall',r,c};}
  if(p.y>=E.slotTop&&p.y<E.slotTop+E.slotH){const i=Math.floor(p.x/(E.sw+E.sg));if(i>=0&&i<E.n)return {area:'slot',i,shift:e.shiftKey};}
  const c=Math.floor((p.x-E.bx0)/E.bc),r=Math.floor((p.y-E.boardTop)/E.bc);
  if(r>=0&&r<lv.BoardHeight&&c>=0&&c<lv.BoardWidth)return {area:'board',r,c};
  return null;
}
const sameHit=(a,b)=>a&&b&&a.area===b.area&&a.r===b.r&&a.c===b.c&&a.i===b.i;
svg.addEventListener('pointerdown',e=>{
  const h=hitAt(e);if(!h)return;
  if(h.area==='wall'&&!['color','hp','queen','erase'].includes(tool)){setTool(tool==='clear'?'erase':'color');}
  if(h.area==='board'&&!['cell','choco','tray','clear','bcolor'].includes(tool)){setTool('choco');toast('Board tool: Chocolate. Pick Cell, Tray or Clear in the toolbar.');}
  painting=true;svg.setPointerCapture(e.pointerId);hover=h;applyTool(h,true);renderEdit();
});
svg.addEventListener('pointermove',e=>{
  const h=hitAt(e);if(sameHit(h,hover))return;hover=h;
  if(painting&&h&&h.area!=='slot')applyTool(h,false);
  renderEdit();
});
function endPaint(){if(!painting)return;painting=false;strokeState=null;commit();renderPane();}
svg.addEventListener('pointerup',endPaint);svg.addEventListener('pointercancel',endPaint);
svg.addEventListener('pointerleave',()=>{if(!painting){hover=null;renderEdit();}});

/* ---------- tools ---------- */
function setTool(t){tool=t;savePrefs();syncTools();}
function syncTools(){
  $$('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===tool)));
  const cols=[...String(L().Colors||'')];
  if(!cols.includes(brushColor)&&cols.length)brushColor=cols[0];
  let h='';
  if(tool==='color')h=`<span class="hint gl">Color</span>`+cols.map((k,i)=>`<button type="button" class="sw" data-brush="${k}" style="background:${colorHex(k)}" aria-pressed="${k===brushColor}" title="${colorName(k)} (${i+1})">${k}</button>`).join('');
  else if(tool==='hp')h=`<span class="hint gl">HP</span>`+[1,2,3,4,5,6,7,8,9].map(n=>`<button type="button" class="tb hpb" data-hp="${n}" aria-pressed="${n===brushHp}" title="${n===1?'Normal ant (1 shot)':`Armored Ant: armor ${n-1}, ${n} shots`}">${n}</button>`).join('');
  else if(tool==='queen')h=`<span class="hint">Click to place a 2×2 queen, click a queen to remove it.</span>`;
  else if(tool==='tray')h=`<span class="hint">Click to place a 2×2 tray, click a tray to remove it. Bottle colors: Board tab.</span>`;
  else if(tool==='cell')h=`<span class="hint">Click or drag to add or remove board cells.</span>`;
  else if(tool==='choco')h=`<span class="hint gl">HP</span>`+['X','1','2','3','4','5','6','7','8','9'].map(n=>`<button type="button" class="tb hpb" data-choco="${n}" aria-pressed="${n===chocoBrush}" title="${n==='X'?`X: default HP (${prefs.chocoLayers}, set in the Board tab)`:`Chocolate with ${n} HP`}">${n}</button>`).join('');
  else if(tool==='bcolor')h=`<span class="hint gl">Fixed jelly</span>`+cols.map((k,i)=>`<button type="button" class="sw" data-brush="${k}" style="background:${colorHex(k)}" aria-pressed="${k===brushColor}" title="${colorName(k)}">${k}</button>`).join('')+`<span class="hint">Click a fixed jelly again to make it random.</span>`;
  $('#brush').innerHTML=h;
}
$$('[data-tool]').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.tool)));
$('#zoom').addEventListener('change',e=>{prefs.zoom=e.target.value;savePrefs();renderEdit();});
$('#brush').addEventListener('click',e=>{const b=e.target.closest('[data-brush]');if(b){brushColor=b.dataset.brush;savePrefs();syncTools();}
  const h=e.target.closest('[data-hp]');if(h){brushHp=+h.dataset.hp;savePrefs();syncTools();}
  const ch=e.target.closest('[data-choco]');if(ch){chocoBrush=ch.dataset.choco;savePrefs();syncTools();}});

/* ---------- inspector ---------- */
function fld(label,key,inner,cls){return `<label class="fld${cls?' '+cls:''}"><span>${label}${key?` <code>${key}</code>`:''}</span>${inner}</label>`;}
function num(id,v,extra){return `<input type="number" id="${id}" value="${v==null?'':esc(v)}" ${extra||''}>`;}
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(!b)return;tab=b.dataset.tab;renderPane();});
function renderPane(){
  $$('#tabs [data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===tab)));
  const lv=L(),p=$('#pane');
  if(tab==='level'){
    const locks=String(lv.SlotLocks||'');
    p.innerHTML=`<h2>Level</h2><div class="fields">
      ${fld('Name','Name',`<input type="text" id="fName" value="${esc(lv.Name)}">`,'full')}
      ${fld('Difficulty','Difficulty',`<select id="fDiff">${DIFFICULTY.map(d=>`<option value="${d.v}" ${d.v===lv.Difficulty?'selected':''}>${d.v} · ${d.name}</option>`).join('')}${DIFFICULTY.some(d=>d.v===lv.Difficulty)?'':`<option selected value="${esc(lv.Difficulty)}">${esc(lv.Difficulty)}</option>`}</select>`)}
      ${fld('Queen HP','QueenHp',num('fQueen',lv.QueenHp,'min="1"'))}
      </div>
      <h3>Colors <code>Colors</code></h3>
      <div class="swatches" id="fColors">${PALETTE.map(c=>`<button type="button" class="sw big" data-col="${c.k}" style="background:${c.hex}" aria-pressed="${String(lv.Colors).includes(c.k)}" title="${c.name}${c.unconfirmed?' (letter not confirmed in the game yet)':''}">${c.k}</button>`).join('')}</div>
      <p class="hint">Order: <code>${esc(lv.Colors)}</code>. R B G O Y come from the game file; P, K, C are guesses until the game confirms them.</p>
      <h3>Cannon slots</h3>
      <div class="fields">${fld('Slots','SlotCount',num('fSlots',lv.SlotCount,'min="1" max="9"'))}</div>
      <p class="hint">Locked Slot <code>SlotLocks</code>: cannons that must enter slots before it opens. 0 = open. You can also click a slot in the design view (Shift-click counts down).</p>
      <div class="locks">${Array.from({length:+lv.SlotCount||0},(_,i)=>`<label class="fld"><span>Slot ${i+1}</span><input type="number" min="0" max="9" data-lock="${i}" value="${+locks[i]||0}"></label>`).join('')}</div>
      <h3>Elements in this level</h3>${elementSummary(lv)}
      <h3>Keys</h3><div class="keys"><kbd>P</kbd><span>Design / Play test</span><kbd>Ctrl Z</kbd><span>Undo</span><kbd>C H Q E</kbd><span>Wall tools: Color, HP, Queen, Erase</span><kbd>B X T K</kbd><span>Board tools: Cell, Chocolate, Tray, Fixed jelly</span><kbd>1–8</kbd><span>Pick color or HP</span></div>`;
    $('#fName').addEventListener('change',e=>{const v=e.target.value.trim()||lv.Name;lv.Name=v;commit();$('#lvTitle').textContent=v;});
    $('#fDiff').addEventListener('change',e=>{lv.Difficulty=+e.target.value;commit();});
    $('#fQueen').addEventListener('change',e=>{lv.QueenHp=Math.max(1,+e.target.value||1);commit();renderEdit();});
    $('#fColors').addEventListener('click',e=>{const b=e.target.closest('[data-col]');if(!b)return;const k=b.dataset.col;
      lv.Colors=lv.Colors.includes(k)?lv.Colors.replace(k,''):lv.Colors+k;commit();syncTools();renderAll();});
    $('#fSlots').addEventListener('change',e=>{const n=Math.max(1,Math.min(9,+e.target.value||1));lv.SlotCount=n;lv.SlotLocks=String(lv.SlotLocks||'').padEnd(n,'0').slice(0,n);commit();renderAll();});
    $$('[data-lock]').forEach(i=>i.addEventListener('change',e=>{const s=String(lv.SlotLocks).padEnd(lv.SlotCount,'0').split('');s[+e.target.dataset.lock]=String(Math.max(0,Math.min(9,+e.target.value||0)));lv.SlotLocks=s.join('');commit();renderEdit();}));
  }
  else if(tab==='wall'){
    const t=tally(lv),w=wallSize(lv);
    p.innerHTML=`<h2>Ant wall</h2>
      <p class="hint">Row 1 is the back (top) of the wall, the last row is the front that starts in view. HP = shots to defeat: 1 is a normal ant, 2 or more is an Armored Ant with armor HP − 1 (GDD: armor 3 = 4 shots). Queen cells (Q) use Queen HP.</p>
      <div class="fields">${fld('Rows','WallRows',num('wRows',w.rows,'min="1" max="99"'))}${fld('Columns','',num('wCols',w.cols,'min="2" max="20"'))}</div>
      <p class="hint">Rows are added or removed at the back (top). Columns at the right.</p>
      <div class="btns"><button class="btn" id="wMirror" type="button">Mirror left → right</button><button class="btn" id="wFlip" type="button">Flip front ↔ back</button><button class="btn" id="wHp1" type="button">All HP to 1</button></div>
      <h3>Generate</h3>
      <div class="fields">${fld('Armored share %','',num('gArmor',20,'min="0" max="100"'))}${fld('Max HP','',num('gMaxHp',3,'min="2" max="9"'))}</div>
      <label class="chk"><input type="checkbox" id="gMirror" checked> Mirror (symmetric)</label>
      <div class="btns"><button class="btn primary" id="gGo" type="button">Fill with color blocks</button><button class="btn" id="gArm" type="button">Re-roll armor only</button></div>
      <p class="hint">Uses the level's Colors and keeps the queens. Undo brings the old wall back.</p>
      <h3>Count</h3>
      <table class="tally"><thead><tr><th>Color</th><th>Ants</th><th>Armored</th><th>Shots</th></tr></thead><tbody>
      ${Object.keys(t.by).sort().map(k=>`<tr><td><span class="pc" style="background:${colorHex(k)}"></span> ${esc(colorName(k))}</td><td>${t.by[k].ants}</td><td>${countArmored(lv,k)}</td><td>${t.by[k].hp}</td></tr>`).join('')}
      ${t.queens?`<tr><td>♛ Queen</td><td>${t.queens}</td><td>–</td><td>${t.queenHp}</td></tr>`:''}
      <tr><th>Total</th><th>${t.ants+t.queens}</th><th>${t.armored}</th><th>${t.shots}</th></tr></tbody></table>`;
    $('#wRows').addEventListener('change',e=>{resizeWall(lv,Math.max(1,Math.min(99,+e.target.value||1)),w.cols);commit();renderAll();});
    $('#wCols').addEventListener('change',e=>{resizeWall(lv,w.rows,Math.max(2,Math.min(20,+e.target.value||2)));commit();renderAll();});
    $('#wMirror').addEventListener('click',()=>{mirrorWall(lv);commit();renderAll();});
    $('#wFlip').addEventListener('click',()=>{lv.WallRows.reverse();lv.WallHp.reverse();commit();renderAll();});
    $('#wHp1').addEventListener('click',()=>{lv.WallHp=lv.WallRows.map(r=>[...r].map(k=>k===EMPTY?'0':'1').join(''));commit();renderAll();});
    $('#gGo').addEventListener('click',()=>{genWall(lv,{armor:+$('#gArmor').value||0,maxHp:+$('#gMaxHp').value||3,mirror:$('#gMirror').checked,blocks:true});commit();renderAll();});
    $('#gArm').addEventListener('click',()=>{genWall(lv,{armor:+$('#gArmor').value||0,maxHp:+$('#gMaxHp').value||3,mirror:$('#gMirror').checked,blocks:false});commit();renderAll();});
  }
  else if(tab==='board'){
    const tr=findTrays(lv.BoardElements).trays;
    p.innerHTML=`<h2>Board</h2>
      <div class="fields">${fld('Width','BoardWidth',num('bW',lv.BoardWidth,'min="3" max="12"'))}${fld('Height','BoardHeight',num('bH',lv.BoardHeight,'min="3" max="12"'))}</div>
      <p class="hint"><code>BoardRows</code>: "." cell, "#" no cell, a color letter = the cube starts with that color (under a chocolate: the cube it shows when it breaks). <code>BoardElements</code>: a digit 1–9 = Chocolate Layer with that HP, "X" = chocolate with the default HP, "T" Jelly Bottle tray (2×2).</p>
      <div class="btns"><button class="btn" id="bMirror" type="button">Mirror shape left → right</button><button class="btn" id="bFull" type="button">All cells on</button><button class="btn" id="bClear" type="button">Remove all elements</button><button class="btn" id="bRandom" type="button">Make all jellies random</button></div>
      <h3>Jelly Bottle trays <code>TrayBottles</code></h3>
      ${tr.length?tr.map((t,i)=>`<div class="elem"><b>Tray ${i+1} · row ${t.r+1}, cell ${t.c+1}</b>
        <div class="bottles">${[0,1,2,3].map(j=>`<select data-tray="${i}" data-b="${j}" aria-label="Tray ${i+1} bottle ${j+1}">${[...String(lv.Colors)].map(k=>`<option value="${k}" ${((lv.TrayBottles[i]||'')[j])===k?'selected':''}>${k} · ${colorName(k)}</option>`).join('')}</select>`).join('')}</div>
        <p class="hint">Order: top left, top right, bottom left, bottom right.</p></div>`).join(''):'<p class="hint">No trays. Pick the Tray tool and click the board.</p>'}
      <h3>Chocolate Layer</h3>
      <p class="hint">HP per chocolate is the digit in <code>BoardElements</code>; pick it with the Chocolate tool. Each match next to it takes 1 HP.</p>
      <div class="fields">${fld('Default HP for "X"','',num('bLayers',prefs.chocoLayers,'min="1" max="9"'))}</div>
      <p class="hint">Only used for cells still written as "X". Not exported.</p>`;
    $('#bW').addEventListener('change',e=>{resizeBoard(lv,Math.max(3,Math.min(12,+e.target.value||3)),lv.BoardHeight);commit();renderAll();});
    $('#bH').addEventListener('change',e=>{resizeBoard(lv,lv.BoardWidth,Math.max(3,Math.min(12,+e.target.value||3)));commit();renderAll();});
    $('#bMirror').addEventListener('click',()=>{const before=trayMap(lv);lv.BoardRows=lv.BoardRows.map(r=>{const h=Math.floor(r.length/2);return r.slice(0,r.length-h)+[...r.slice(0,h)].reverse().join('');});
      lv.BoardElements=lv.BoardElements.map((e,i)=>[...e].map((ch,c)=>lv.BoardRows[i][c]===HOLE?'.':ch).join(''));fixStrayTrays(lv);syncTrays(lv,before);commit();renderAll();});
    $('#bFull').addEventListener('click',()=>{lv.BoardRows=lv.BoardRows.map(r=>'.'.repeat(r.length));commit();renderAll();});
    $('#bRandom').addEventListener('click',()=>{lv.BoardRows=lv.BoardRows.map(r=>r.replace(/[A-Z]/g,'.'));commit();renderAll();});
    $('#bClear').addEventListener('click',()=>{lv.BoardElements=lv.BoardElements.map(r=>'.'.repeat(r.length));lv.TrayBottles=[];commit();renderAll();});
    $$('[data-tray]').forEach(s=>s.addEventListener('change',e=>{const i=+e.target.dataset.tray,j=+e.target.dataset.b;lv.TrayBottles[i]=setCh(String(lv.TrayBottles[i]||'').padEnd(4,lv.Colors[0]||'R'),j,e.target.value);commit();renderEdit();refreshChecks();}));
    $('#bLayers').addEventListener('change',e=>{prefs.chocoLayers=Math.max(1,Math.min(9,+e.target.value||3));savePrefs();renderEdit();syncTools();});
  }
  else if(tab==='tuning'){
    p.innerHTML=`<h2>Tuning</h2><p class="hint">Wall speed, speed-up, lose line and timings. Distances are in wall cells.</p>
      <div class="fields">${TUNING.map(t=>fld(t.label,t.k,num('t_'+t.k,lv[t.k],`step="${t.step}" min="${t.min}"${t.max!=null?` max="${t.max}"`:''}`))).join('')}</div>
      <div class="btns"><button class="btn" id="tDefaults" type="button">Use the L10 values</button></div>
      <p class="hint">Start: the front row is ${lv.WallStartVisibleRows} rows into the view, ${(+lv.LoseDepthCells-+lv.WallStartVisibleRows).toFixed(2)} rows above the red line. Without speed-up that gap closes in ${(((+lv.LoseDepthCells-+lv.WallStartVisibleRows))/(+lv.WallDescentPerSecond||1)).toFixed(0)} s, the whole wall (${lv.WallRows.length} rows) passes in ${((lv.WallRows.length+(+lv.LoseDepthCells-+lv.WallStartVisibleRows))/(+lv.WallDescentPerSecond||1)).toFixed(0)} s.</p>`;
    TUNING.forEach(t=>$('#t_'+t.k).addEventListener('change',e=>{const v=+e.target.value;if(isFinite(v)){lv[t.k]=v;commit();renderEdit();renderPane();}}));
    $('#tDefaults').addEventListener('click',()=>{TUNING.forEach(t=>{lv[t.k]=DEFAULTS[t.k];});commit();renderAll();});
  }
  else if(tab==='check'){
    const iss=check(lv),t=tally(lv);
    p.innerHTML=`<h2>Check</h2><ul class="issues">${iss.length?iss.map(i=>`<li class="${i.lvl}">${esc(i.t)}</li>`).join(''):'<li class="ok">No problems found. The level matches the game format.</li>'}</ul>
      <h3>Summary</h3><table class="tally"><tbody>
      <tr><td>Ants</td><td>${t.ants} (${t.armored} armored)</td></tr><tr><td>Queens</td><td>${t.queens}${t.queens?` × ${lv.QueenHp} HP`:''}</td></tr>
      <tr><td>Shots needed</td><td>${t.shots}</td></tr><tr><td>Matches of 3 needed (3 ammo each)</td><td>≈ ${Math.ceil(t.shots/3)}</td></tr>
      <tr><td>Chocolate / trays</td><td>${t.choco} / ${t.trays}</td></tr><tr><td>Locked slots</td><td>${t.locks} of ${lv.SlotCount}</td></tr></tbody></table>
      <h3>Bot estimate</h3>
      <p class="hint">A greedy bot plays the level many times with the play-test rules. It thinks ${prefs.botThink} s between moves and never uses boosters, so it is a rough floor, not a real player.</p>
      <div class="fields">${fld('Runs','',num('botN',prefs.botRuns,'min="1" max="500"'))}${fld('Think time (s)','',num('botT',prefs.botThink,'min="0" step="0.1"'))}</div>
      <div class="btns"><button class="btn primary" id="botGo" type="button">Run the bot</button></div>
      <div id="botOut"></div>`;
    $('#botN').addEventListener('change',e=>{prefs.botRuns=Math.max(1,Math.min(500,+e.target.value||20));savePrefs();});
    $('#botT').addEventListener('change',e=>{prefs.botThink=Math.max(0,+e.target.value||0);savePrefs();});
    $('#botGo').addEventListener('click',runBot);
  }
  else if(tab==='json'){
    p.innerHTML=`<h2>JSON</h2><p class="hint">Same keys and layout as the game's level file. Edit and press Apply, or paste a level anywhere on the page.</p>
      <textarea class="code" id="jText" spellcheck="false" aria-label="Level JSON"></textarea>
      <div class="btns"><button class="btn primary" id="jApply" type="button">Apply</button><button class="btn" id="jCopy" type="button">Copy</button>${inFrame?'':'<button class="btn" id="jDl" type="button">Download .json</button>'}</div><div class="msg" id="jMsg"></div>`;
    $('#jText').value=serialize(lv);
    $('#jApply').addEventListener('click',()=>{const got=parseLevels($('#jText').value),m=$('#jMsg');
      if(got.length!==1){m.className='msg bad';m.textContent='Paste exactly one level (an object with WallRows and BoardRows).';return;}
      levels[cur]=got[0];commit();renderAll();m.className='msg ok';m.textContent='Applied.';});
    $('#jCopy').addEventListener('click',()=>copyText(serialize(lv),'Level JSON copied.',$('#jText')));
    if($('#jDl'))$('#jDl').addEventListener('click',()=>download(fileName(lv),serialize(lv)));
  }
}
function elementSummary(lv){
  const t=tally(lv),rows=[
    ['Chocolate Layer',t.choco?`${t.choco} cells`:'–'],['Locked Slot',t.locks?`${t.locks} slot${t.locks>1?'s':''} (${lv.SlotLocks})`:'–'],
    ['Armored Ant',t.armored?`${t.armored} ants`:'–'],['Jelly Bottle',t.trays?`${t.trays} tray${t.trays>1?'s':''}`:'–'],['Queen Ant',t.queens?`${t.queens} × ${lv.QueenHp} HP`:'–']];
  return `<table class="tally"><tbody>${rows.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</tbody></table>`;
}
function countArmored(lv,k){let n=0;lv.WallRows.forEach((row,r)=>{for(let c=0;c<row.length;c++)if(row[c]===k&&hpAt(lv,r,c)>1)n++;});return n;}
function refreshChecks(){
  const iss=check(L()),b=$('#chkBadge'),bad=iss.filter(i=>i.lvl==='bad').length;
  b.textContent=String(iss.length);b.className='badge'+(bad?' bad':iss.length?' warn':'');
}

/* ---------- wall and board operations ---------- */
function resizeWall(lv,R,C){
  const fill=brushColor||String(lv.Colors)[0]||'R';
  let rows=lv.WallRows.map(r=>r.slice(0,C).padEnd(C,fill)),hp=lv.WallRows.map((r,i)=>(lv.WallHp[i]||'').slice(0,C).padEnd(C,'1'));
  while(rows.length<R){rows.unshift(fill.repeat(C));hp.unshift('1'.repeat(C));}
  while(rows.length>R){rows.shift();hp.shift();}
  lv.WallRows=rows;lv.WallHp=hp;fixStrayQueens(lv);
}
function fixStrayQueens(lv){const {stray}=findQueens(lv.WallRows);stray.forEach(s=>wallSet(lv,s.r,s.c,EMPTY,0));}
function fixStrayTrays(lv){const {stray}=findTrays(lv.BoardElements);stray.forEach(s=>{lv.BoardElements[s.r]=setCh(lv.BoardElements[s.r],s.c,'.');});}
function mirrorWall(lv){
  const C=lv.WallRows[0].length,h=Math.floor(C/2);
  lv.WallRows=lv.WallRows.map(r=>r.slice(0,C-h)+[...r.slice(0,h)].reverse().join(''));
  lv.WallHp=lv.WallHp.map(r=>r.slice(0,C-h)+[...r.slice(0,h)].reverse().join(''));
  fixStrayQueens(lv);
}
function genWall(lv,o){
  const cols=[...String(lv.Colors||'RBGY')],R=lv.WallRows.length,C=lv.WallRows[0].length,half=o.mirror?Math.ceil(C/2):C;
  const isQ=(r,c)=>lv.WallRows[r][c]===QUEEN;
  const rnd=Math.random;
  if(o.blocks){
    const g=[...Array(R)].map(()=>new Array(C).fill(null));
    let r=0;
    while(r<R){let h=2+Math.floor(rnd()*2);h=Math.min(h,R-r);let c=0,prev=null;
      while(c<half){let w=1+Math.floor(rnd()*3);if(c+w>half)w=half-c;
        let k,guard=0;do{k=cols[Math.floor(rnd()*cols.length)];}while((k===prev||(r>0&&g[r-1][c]===k))&&guard++<12);
        for(let y=r;y<r+h;y++)for(let x=c;x<c+w;x++)g[y][x]=k;prev=k;c+=w;}
      r+=h;}
    for(let y=0;y<R;y++)for(let x=half;x<C;x++)g[y][x]=g[y][C-1-x];
    lv.WallRows=g.map((row,y)=>row.map((k,x)=>isQ(y,x)?QUEEN:k).join(''));
  }
  lv.WallHp=lv.WallRows.map((row,y)=>{const out=[];for(let x=0;x<C;x++){
    if(o.mirror&&x>=half){out.push(out[C-1-x]);continue;}
    const k=row[x];out.push(k===EMPTY?'0':k===QUEEN?'1':rnd()*100<o.armor?String(2+Math.floor(rnd()*(Math.max(2,o.maxHp)-1))):'1');}
    return out.join('');});
}
function resizeBoard(lv,W,H){
  const before=trayMap(lv);
  lv.BoardRows=lv.BoardRows.map(r=>r.slice(0,W).padEnd(W,'.'));lv.BoardElements=lv.BoardElements.map(r=>r.slice(0,W).padEnd(W,'.'));
  while(lv.BoardRows.length<H){lv.BoardRows.push('.'.repeat(W));lv.BoardElements.push('.'.repeat(W));}
  lv.BoardRows.length=H;lv.BoardElements.length=H;lv.BoardWidth=W;lv.BoardHeight=H;
  fixStrayTrays(lv);syncTrays(lv,before);
}

/* ---------- bot runs ---------- */
let botJob=0;
function runBot(){
  const lv=clone(L()),n=prefs.botRuns,out=$('#botOut'),job=++botJob,res=[];
  if(check(lv).some(i=>i.lvl==='bad')){out.innerHTML='<p class="msg bad">Fix the errors above first.</p>';return;}
  const tick=()=>{
    if(job!==botJob||!$('#botOut'))return;
    const t0=performance.now();
    while(res.length<n&&performance.now()-t0<40)res.push(simulate(lv,{seed:1000+res.length,think:prefs.botThink,chocoLayers:prefs.chocoLayers}));
    const w=res.filter(r=>r.result==='win'),avg=(a,f)=>a.length?a.reduce((s,r)=>s+f(r),0)/a.length:0;
    $('#botOut').innerHTML=`<table class="tally"><tbody>
      <tr><td>Runs</td><td>${res.length}/${n}</td></tr>
      <tr><td>Bot wins</td><td><b>${Math.round(w.length/res.length*100)}%</b> (${w.length})</td></tr>
      <tr><td>Average time</td><td>${avg(res,r=>r.time).toFixed(0)} s</td></tr>
      <tr><td>Wall cleared (average)</td><td>${Math.round(avg(res,r=>r.cleared)*100)}%</td></tr>
      <tr><td>Matches per run</td><td>${avg(res,r=>r.stats.matches).toFixed(0)}</td></tr>
      <tr><td>Cannons lost to full slots</td><td>${avg(res,r=>r.stats.lost).toFixed(1)}</td></tr>
      <tr><td>Merges</td><td>${avg(res,r=>r.stats.merges).toFixed(1)}</td></tr></tbody></table>`;
    if(res.length<n)setTimeout(tick,0);
  };
  tick();
}

/* ---------- play test ---------- */
const cv=$('#cv'),ctx=cv.getContext('2d');
let G=null,GL=null,paused=false,speed=1,auto=false,botWait=0,ui={sel:null,hint:null,pops:[],dark:false},drag=null,idle=0;
function setMode(m){
  mode=m;$('#modeEdit').setAttribute('aria-pressed',String(m==='edit'));$('#modePlay').setAttribute('aria-pressed',String(m==='play'));
  $$('[data-edit]').forEach(n=>n.hidden=m!=='edit');$$('[data-play]').forEach(n=>n.hidden=m!=='play');
  if(m==='play')startGame();else{G=null;banner();renderEdit();}
}
$('#modeEdit').addEventListener('click',()=>setMode('edit'));
$('#modePlay').addEventListener('click',()=>{if(check(L()).some(i=>i.lvl==='bad')){toast('This level has errors. Open the Check tab.');tab='check';renderPane();return;}setMode('play');});
function startGame(){
  const seed=+$('#pSeed').value;G=newGame(clone(L()),{seed:isFinite(seed)?seed:1,chocoLayers:prefs.chocoLayers});GL=layoutOf(G);
  ui={sel:null,hint:null,pops:[],dark:false};idle=0;botWait=prefs.botThink;banner();sizeCanvas();syncBoost();
}
function sizeCanvas(){
  if(!G)return;const wrap=$('#playWrap'),r=wrap.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,3);
  const scale=Math.max(0.5,Math.min((r.width-16)/LW,(r.height-44)/GL.H));
  cv.style.width=LW*scale+'px';cv.style.height=GL.H*scale+'px';cv.width=Math.round(LW*scale*dpr);cv.height=Math.round(GL.H*scale*dpr);cv._k=scale*dpr;
}
window.addEventListener('resize',()=>{if(mode==='play')sizeCanvas();else renderEdit();});
$('#pRestart').addEventListener('click',startGame);
$('#pSeed').addEventListener('change',startGame);
$('#pPause').addEventListener('click',()=>{paused=!paused;$('#pPause').setAttribute('aria-pressed',String(paused));});
$('#pSpeed').addEventListener('change',e=>{speed=+e.target.value||1;});
$('#pAuto').addEventListener('click',()=>{auto=!auto;$('#pAuto').setAttribute('aria-pressed',String(auto));});
const BST={hand:'#bHand',shuffle:'#bShuffle',bomb:'#bBomb'};
Object.entries(BST).forEach(([k,id])=>$(id).addEventListener('click',()=>{if(G&&useBooster(G,k)){syncBoost();}else toast(k==='hand'?'Hand needs a cannon in the slots.':k==='shuffle'?'Wait until the board settles.':'Nothing to bomb.');}));
function syncBoost(){if(!G)return;$('#nHand').textContent=G.stats.boosters.hand;$('#nShuffle').textContent=G.stats.boosters.shuffle;$('#nBomb').textContent=G.stats.boosters.bomb;
  Object.entries(BST).forEach(([k,id])=>{$(id).disabled=!canBooster(G,k);});}
function toLogical(e){const r=cv.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*LW,y:(e.clientY-r.top)/r.height*GL.H};}
cv.addEventListener('pointerdown',e=>{
  if(!G||G.over)return;const p=toLogical(e),cell=cellAt(G,GL,p.x,p.y);if(!cell)return;
  cv.setPointerCapture(e.pointerId);
  if(ui.sel&&Math.abs(ui.sel[0]-cell[0])+Math.abs(ui.sel[1]-cell[1])===1){const a=ui.sel;ui.sel=null;doSwap(a,cell);drag=null;return;}
  drag={cell,x:p.x,y:p.y,done:false};ui.sel=cell;
});
cv.addEventListener('pointermove',e=>{
  if(!drag||drag.done||!G)return;const p=toLogical(e),dx=p.x-drag.x,dy=p.y-drag.y;
  if(Math.max(Math.abs(dx),Math.abs(dy))>GL.bc*0.38){const [r,c]=drag.cell,b=Math.abs(dx)>Math.abs(dy)?[r,c+Math.sign(dx)]:[r+Math.sign(dy),c];
    drag.done=true;ui.sel=null;doSwap([r,c],b);}
});
cv.addEventListener('pointerup',()=>{drag=null;});cv.addEventListener('pointercancel',()=>{drag=null;});
function doSwap(a,b){if(G&&canSwap(G,a,b)){trySwap(G,a,b);ui.hint=null;idle=0;}}
function banner(text,kind){const b=$('#banner');if(!text){b.hidden=true;return;}b.hidden=false;b.className='banner '+(kind||'info');b.innerHTML=text;}
function statsLine(){
  if(!G)return '';const s=G.stats;
  return `<span>${G.t.toFixed(1)} s</span><span>Swaps ${s.swaps}</span><span>Matches ${s.matches}</span><span>Cannons ${s.cannons}</span><span>Lost ${s.lost}</span><span>Merges ${s.merges}</span><span>Shots ${s.shots}</span>${G.boost>1?'<span class="hot">speed-up</span>':''}`;
}
let last=performance.now(),statT=0;
function frame(now){
  const dt=Math.min(0.05,(now-last)/1000);last=now;
  if(mode==='play'&&G){
    if(!paused&&!G.over){
      let left=dt*speed;
      while(left>1e-6){const h=Math.min(1/60,left);left-=h;
        if(auto&&G.state==='idle'){botWait-=h;if(botWait<=0){const m=botMove(G);if(m)trySwap(G,m[0],m[1]);botWait=prefs.botThink;}}
        step(G,h);
        for(const ev of G.events){const p=eventPops(G,GL,ev);if(p)ui.pops.push({...p,age:0});}
        G.events.length=0;
        if(G.over)break;
      }
      for(const p of ui.pops)p.age+=dt;ui.pops=ui.pops.filter(p=>p.age<1.2);
      if(G.state==='idle'){idle+=dt;if(idle>5&&!ui.hint)ui.hint=findMove(G);}
      if(G.over){const s=G.stats,left=G.ants.filter(a=>a.alive).length;
        banner(G.over==='win'?`Win in ${G.t.toFixed(0)} s · ${s.matches} matches · ${s.cannons} cannons · ${s.lost} lost`:`Lose at ${G.t.toFixed(0)} s: an ant reached the red line · ${left}/${G.totalAnts} ants left`,G.over==='win'?'won':'lost');}
    }
    ctx.setTransform(cv._k||1,0,0,cv._k||1,0,0);draw(ctx,G,GL,ui);
    statT-=dt;if(statT<=0){statT=0.2;$('#pStats').innerHTML=statsLine();syncBoost();}
  }
  requestAnimationFrame(frame);
}

/* ---------- import / export ---------- */
function openModal(title,body,foot){$('#dlgTitle').textContent=title;$('#dlgBody').innerHTML=body;$('#dlgFoot').innerHTML=foot;$('#modal').hidden=false;}
function closeModal(){$('#modal').hidden=true;}
$('#dlgX').addEventListener('click',closeModal);
$('#modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal();});
function addLevels(got,replace){
  let a=0,r=0,first=-1;
  got.forEach(lv=>{const i=replace?levels.findIndex(o=>o.Name===lv.Name):-1;
    if(i>=0){levels[i]=lv;r++;if(first<0)first=i;}else{if(levels.some(o=>o.Name===lv.Name))lv.Name=uniqueName(lv.Name);levels.push(lv);a++;if(first<0)first=levels.length-1;}});
  refreshAllStatus();persist();selectLevel(first);
  return {a,r};
}
$('#btnImport').addEventListener('click',()=>{
  openModal('Import levels',`<p class="hint">Paste one level, a list of levels, or several level objects one after another. You can also pick .json files.</p>
    <textarea class="code" id="impText" spellcheck="false" aria-label="Level JSON to import" placeholder='{ "Name": "L11", "Difficulty": 0, ... }'></textarea>
    <div class="btns"><input type="file" id="impFile" accept=".json,.txt,application/json" multiple></div>
    <label class="chk" style="margin-top:8px"><input type="checkbox" id="impReplace" checked> Replace levels that have the same Name</label>
    <div class="msg" id="impMsg"></div>`,
    `<button class="btn" type="button" id="impCancel">Cancel</button><button class="btn primary" type="button" id="impGo">Import</button>`);
  $('#impCancel').addEventListener('click',closeModal);
  $('#impFile').addEventListener('change',e=>{const fs=[...e.target.files];if(!fs.length)return;
    Promise.all(fs.map(f=>f.text())).then(t=>{$('#impText').value=t.join('\n');});});
  $('#impGo').addEventListener('click',()=>{
    const got=parseLevels($('#impText').value),m=$('#impMsg');
    if(!got.length){m.className='msg bad';m.textContent='No level found. A level needs WallRows and BoardRows.';return;}
    const {a,r}=addLevels(got,$('#impReplace').checked);closeModal();
    toast(`Imported ${got.length} level${got.length>1?'s':''}: ${r} replaced, ${a} added.`);
  });
  setTimeout(()=>$('#impText').focus(),30);
});
const fileName=lv=>String(lv.Name||'level').replace(/[^\w.-]+/g,'_')+'.json';
$('#btnExport').addEventListener('click',()=>{
  openModal('Export levels',`<p class="hint">Each level uses the game's keys and layout. "This level" is one object like level_demo.json; "All levels" is a JSON list; sheet rows paste into the Id and Level columns of the Level Config sheet.</p>
    <div class="btns"><button class="btn primary" type="button" data-exp="one">Copy this level</button><button class="btn" type="button" data-exp="all">Copy all (${levels.length})</button><button class="btn" type="button" data-exp="sheet">Copy as sheet rows</button>
    ${inFrame?'':'<button class="btn" type="button" data-exp="dlone">Download this level</button><button class="btn" type="button" data-exp="dlall">Download all</button><button class="btn" type="button" data-exp="dleach">Download each as its own file</button>'}</div>
    <div class="msg" id="expMsg"></div>
    <textarea class="code" id="expText" spellcheck="false" aria-label="Exported text" readonly></textarea>`,
    `<button class="btn" type="button" id="expClose">Done</button>`);
  $('#expClose').addEventListener('click',closeModal);
  $('#expText').value=serialize(L());
  $('#dlgBody').addEventListener('click',e=>{const b=e.target.closest('[data-exp]');if(!b)return;const k=b.dataset.exp;
    if(k==='dlone'){download(fileName(L()),serialize(L()));return;}
    if(k==='dlall'){download('jelly_smash_levels.json',serializeAll(levels));return;}
    if(k==='dleach'){levels.forEach((lv,i)=>setTimeout(()=>download(fileName(lv),serialize(lv)),i*250));return;}
    const txt=k==='sheet'?'Id\tLevel\n'+levels.map((lv,i)=>{const m=/(\d+)$/.exec(lv.Name||'');return `${m?+m[1]:i+1}\t"${serialize(lv).replace(/"/g,'""')}"`;}).join('\n'):k==='all'?serializeAll(levels):serialize(L());$('#expText').value=txt;
    copyText(txt,k==='sheet'?`Copied ${levels.length} sheet rows (Id, Level).`:k==='all'?`Copied ${levels.length} levels.`:'Level JSON copied.',$('#expText'));});
});
$('#tCopy').addEventListener('click',()=>copyText(serialize(L()),'Level JSON copied.'));
function copyText(txt,ok,fallbackEl){
  const fail=()=>{if(fallbackEl){fallbackEl.value=txt;fallbackEl.focus();fallbackEl.select();toast('Copy is blocked here. The text is selected, press Ctrl+C.');}
    else{openModal('Copy JSON','<textarea class="code" id="cpText" readonly></textarea>','<button class="btn" type="button" id="cpClose">Done</button>');$('#cpText').value=txt;$('#cpText').select();$('#cpClose').addEventListener('click',closeModal);toast('Copy is blocked here. The text is selected, press Ctrl+C.');}};
  try{navigator.clipboard.writeText(txt).then(()=>toast(ok),fail);}catch(e){fail();}
}
function download(name,txt){
  try{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([txt+'\n'],{type:'application/json'}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);}catch(e){toast('Download is blocked here. Use Copy instead.');}
}
let toastT=0;
function toast(t){const n=$('#toast');n.textContent=t;n.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>{n.hidden=true;},2800);}

/* ---------- keyboard and paste ---------- */
document.addEventListener('keydown',e=>{
  if(!$('#modal').hidden){if(e.key==='Escape')closeModal();return;}
  const a=document.activeElement,typing=a&&(a.tagName==='INPUT'||a.tagName==='TEXTAREA'||a.tagName==='SELECT'||a.isContentEditable);
  if(typing)return;
  const k=e.key.toLowerCase(),mod=e.ctrlKey||e.metaKey;
  if(k==='p'&&!mod){mode==='edit'?$('#modePlay').click():setMode('edit');e.preventDefault();return;}
  if(mode==='play'){if(k===' '){$('#pPause').click();e.preventDefault();}if(k==='r'&&!mod)startGame();return;}
  if(mod&&k==='z'&&!e.shiftKey){doUndo();e.preventDefault();return;}
  if(mod&&(k==='y'||(k==='z'&&e.shiftKey))){doRedo();e.preventDefault();return;}
  if(mod)return;
  const map={c:'color',h:'hp',q:'queen',e:'erase',b:'cell',x:'choco',t:'tray',k:'bcolor'};
  if(map[k]){setTool(map[k]);return;}
  if(/^[1-9]$/.test(k)){if(tool==='hp'){brushHp=+k;}else if(tool==='choco'){chocoBrush=k;}else{const c=String(L().Colors)[+k-1];if(c){brushColor=c;if(tool!=='color'&&tool!=='bcolor')setTool('color');}}savePrefs();syncTools();}
});
document.addEventListener('paste',e=>{
  const a=document.activeElement;if(a&&(a.tagName==='INPUT'||a.tagName==='TEXTAREA'))return;
  const txt=(e.clipboardData||window.clipboardData).getData('text');const got=parseLevels(txt||'');
  if(!got.length)return;e.preventDefault();
  const {a:ad,r}=addLevels(got,true);toast(`Pasted ${got.length} level${got.length>1?'s':''}: ${r} replaced, ${ad} added.`);
});

/* ---------- render ---------- */
function renderAll(){
  $('#lvTitle').textContent=L().Name;
  syncTools();refreshChecks();renderEdit();renderPane();refreshList();syncUndo();
}

load();
if(savedBase!==BASE){$('#saveNote').textContent=STALE;setTimeout(()=>toast('New built-in levels: press Reset to sheet to load them.'),400);}
$('#zoom').value=prefs.zoom;refreshAllStatus();resetHistory();renderAll();
requestAnimationFrame(()=>renderEdit());
requestAnimationFrame(frame);
window.__js={levels:()=>levels,simulate,newGame,check,serialize,game:()=>G};
