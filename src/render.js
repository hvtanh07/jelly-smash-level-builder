/* Draws a running game on a canvas, laid out like the game screen (portrait):
   HUD, the ant view with the red line, the cannon slots, then the board. */
import {colorHex} from './format.js';
import {rowTop,isFront,inView,BOTTLE_BONUS} from './engine.js';

export const LW=360;
const PAD=8,HUD=38,GAP=8,SLOT_H=58;
export function layoutOf(G){
  const wc=(LW-PAD*2)/Math.max(1,G.C),viewH=(+G.lv.LoseDepthCells||8)*wc;
  const bc=Math.min(46,(LW-PAD*2)/Math.max(1,G.BW));
  const viewTop=HUD,slotTop=viewTop+viewH+GAP,boardTop=slotTop+SLOT_H+GAP;
  const bx0=(LW-bc*G.BW)/2;
  const n=Math.max(1,G.slots.length),sg=6,sw=(LW-PAD*2-(n-1)*sg)/n;
  return {wc,viewH,bc,viewTop,slotTop,boardTop,bx0,sw,sg,H:boardTop+bc*G.BH+PAD};
}
const lerp=(a,b,t)=>a+(b-a)*t,ease=t=>1-Math.pow(1-t,3);
function rr(g,x,y,w,h,r){r=Math.min(r,w/2,h/2);g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath();}
function shade(hex,f){const n=parseInt(hex.slice(1),16);let r=n>>16,g=n>>8&255,b=n&255;
  if(f<0){r*=1+f;g*=1+f;b*=1+f;}else{r+=(255-r)*f;g+=(255-g)*f;b+=(255-b)*f;}
  return `rgb(${r|0},${g|0},${b|0})`;}
function cube(g,x,y,s,hex,alpha){
  g.globalAlpha=alpha==null?1:alpha;
  rr(g,x,y+s*0.06,s,s*0.94,s*0.24);g.fillStyle=shade(hex,-0.3);g.fill();
  rr(g,x,y,s,s*0.9,s*0.24);const gr=g.createLinearGradient(0,y,0,y+s);gr.addColorStop(0,shade(hex,0.35));gr.addColorStop(0.5,hex);gr.addColorStop(1,hex);g.fillStyle=gr;g.fill();
  g.fillStyle='rgba(255,255,255,.5)';g.beginPath();g.ellipse(x+s*0.32,y+s*0.24,s*0.18,s*0.08,-0.35,0,Math.PI*2);g.fill();
  g.globalAlpha=1;
}
export const FONT='"Baloo 2","Be Vietnam Pro",system-ui,sans-serif';
function label(g,txt,x,y,size,fill,stroke){g.font=`800 ${size}px ${FONT}`;g.textAlign='center';g.textBaseline='middle';
  if(stroke){g.lineWidth=Math.max(2,size/5);g.strokeStyle=stroke;g.strokeText(txt,x,y);}g.fillStyle=fill;g.fillText(txt,x,y);}

export function slotCenter(G,L,i){return {x:PAD+i*(L.sw+L.sg)+L.sw/2,y:L.slotTop+SLOT_H/2};}
export function antCenter(G,L,a){return {x:PAD+(a.c+a.w/2)*L.wc,y:L.viewTop+(rowTop(G,a.r)+a.h/2)*L.wc};}
export function cellAt(G,L,x,y){const c=Math.floor((x-L.bx0)/L.bc),r=Math.floor((y-L.boardTop)/L.bc);return r>=0&&r<G.BH&&c>=0&&c<G.BW?[r,c]:null;}

export function draw(g,G,L,ui){
  const dark=ui.dark;
  g.fillStyle=dark?'#141a2b':'#2a2350';g.fillRect(0,0,LW,L.H);
  // HUD
  const left=G.ants.filter(a=>a.alive).length;
  rr(g,PAD,8,LW-PAD*2,24,12);g.fillStyle='rgba(0,0,0,.35)';g.fill();
  const pct=1-left/(G.totalAnts||1);if(pct>0){rr(g,PAD+2,10,Math.max(20,(LW-PAD*2-4)*pct),20,10);g.fillStyle='#2FB457';g.fill();}
  g.font=`600 12px ${FONT}`;g.textAlign='center';g.textBaseline='middle';g.fillStyle='#fff';
  g.fillText(`${left}/${G.totalAnts} ants · ${G.t.toFixed(1)} s`,LW/2,20.5);
  // ant view
  g.save();rr(g,PAD-4,L.viewTop,LW-PAD*2+8,L.viewH,10);g.fillStyle='rgba(0,0,0,.28)';g.fill();g.clip();
  const s=L.wc*0.9,o=(L.wc-s)/2;
  for(const a of G.ants){if(!a.alive)continue;
    const y=L.viewTop+rowTop(G,a.r)*L.wc;if(y>L.viewTop+L.viewH+L.wc||y+a.h*L.wc<L.viewTop-L.wc)continue;
    const x=PAD+a.c*L.wc,front=isFront(G,a)&&inView(G,a);
    if(a.queen){
      const w=a.w*L.wc-o*2,h=a.h*L.wc-o*2;rr(g,x+o,y+o,w,h,L.wc*0.4);
      const gr=g.createLinearGradient(x,y,x+w,y+h);['#E5484D','#F27A1A','#F5C21A','#2FB457','#2F6FEB','#8B4DDB'].forEach((c,i)=>gr.addColorStop(i/5,c));
      g.fillStyle=gr;g.fill();g.lineWidth=2;g.strokeStyle='rgba(255,255,255,.8)';g.stroke();
      g.fillStyle='#FFD84D';g.beginPath();const cx=x+a.w*L.wc/2,cy=y+o+h*0.22;g.moveTo(cx-10,cy+5);g.lineTo(cx-10,cy-4);g.lineTo(cx-5,cy+1);g.lineTo(cx,cy-7);g.lineTo(cx+5,cy+1);g.lineTo(cx+10,cy-4);g.lineTo(cx+10,cy+5);g.closePath();g.fill();
      label(g,String(a.hp),cx,y+a.h*L.wc*0.62,Math.min(22,L.wc*0.8),'#fff','rgba(0,0,0,.55)');
    }else{
      cube(g,x+o,y+o,s,colorHex(a.color),front?1:0.78);
      if(a.hp>1){rr(g,x+o+1.5,y+o+1.5,s-3,s*0.9-3,s*0.22);g.lineWidth=Math.max(2,s*0.12);g.strokeStyle='rgba(40,48,70,.85)';g.stroke();
        label(g,String(a.hp-1),x+L.wc/2,y+L.wc*0.5,Math.max(9,L.wc*0.5),'#fff','rgba(0,0,0,.6)');}
    }
    if(a.pend>0){rr(g,x+1,y+1,a.w*L.wc-2,a.h*L.wc-2,L.wc*0.25);g.lineWidth=1.5;g.strokeStyle='rgba(255,255,255,.9)';g.stroke();}
  }
  g.restore();
  // red line
  const low=Math.max(...G.ants.filter(a=>a.alive).map(a=>rowTop(G,a.r+a.h-1)+1),-99),gap=(+G.lv.LoseDepthCells)-low;
  const warn=gap<1.2&&!G.over;
  g.strokeStyle=warn&&Math.floor(G.t*4)%2?'#ff3d5f':'rgba(255,90,120,.85)';g.lineWidth=3;g.setLineDash([8,6]);
  g.beginPath();g.moveTo(PAD-4,L.viewTop+L.viewH);g.lineTo(LW-PAD+4,L.viewTop+L.viewH);g.stroke();g.setLineDash([]);
  if(G.boost>1&&!G.over){g.font=`700 11px ${FONT}`;g.textAlign='right';g.textBaseline='top';g.fillStyle='#FFD84D';g.fillText(`▼ speed-up ×${G.boost}`,LW-PAD-2,L.viewTop+4);}
  // slots
  G.slots.forEach((sl,i)=>{const x=PAD+i*(L.sw+L.sg),y=L.slotTop;
    rr(g,x,y,L.sw,SLOT_H,12);g.fillStyle='rgba(0,0,0,.3)';g.fill();
    if(sl.lock>0){g.fillStyle='rgba(255,255,255,.12)';rr(g,x,y,L.sw,SLOT_H,12);g.fill();
      const cx=x+L.sw/2,cy=y+SLOT_H/2;g.strokeStyle='#C9D2E8';g.lineWidth=3;g.beginPath();g.arc(cx,cy-6,7,Math.PI,0);g.stroke();
      rr(g,cx-11,cy-6,22,18,4);g.fillStyle='#C9D2E8';g.fill();label(g,String(sl.lock),cx,cy+3,12,'#2a2350');return;}
    const k=sl.cannon;
    if(!k){g.setLineDash([4,4]);g.strokeStyle='rgba(255,255,255,.3)';g.lineWidth=1.5;rr(g,x+1,y+1,L.sw-2,SLOT_H-2,11);g.stroke();g.setLineDash([]);return;}
    const hex=colorHex(k.color),cx=x+L.sw/2,cy=y+SLOT_H/2,sc=1+0.2*Math.sin((k.pop||0)*Math.PI);
    g.save();g.translate(cx,cy+4);g.scale(sc,sc);g.globalAlpha=k.waiting?0.7:1;
    rr(g,-7,-27,14,24,6);g.fillStyle=shade(hex,-0.25);g.fill();
    rr(g,-Math.min(24,L.sw/2-3),-6,Math.min(48,L.sw-6),24,10);g.fillStyle=hex;g.fill();
    rr(g,-14,-1,28,15,7);g.fillStyle='rgba(20,12,40,.8)';g.fill();
    g.globalAlpha=1;label(g,String(k.ammo),0,6.5,13,'#fff');g.restore();
  });
  // board
  for(let r=0;r<G.BH;r++)for(let c=0;c<G.BW;c++){const x=G.cells[r][c];if(!x)continue;
    g.fillStyle=(r+c)%2?'rgba(255,255,255,.07)':'rgba(255,255,255,.12)';g.fillRect(L.bx0+c*L.bc,L.boardTop+r*L.bc,L.bc,L.bc);}
  const bs=L.bc*0.9,bo=(L.bc-bs)/2;
  const swapT=G.state==='swap'||G.state==='swapback'?1-Math.max(0,G.timer)/(+G.lv.SwapSeconds||1):1;
  const fallT=G.state==='fall'?ease(1-Math.max(0,G.timer)/(+G.lv.FallSeconds||1)):1;
  g.save();g.beginPath();g.rect(L.bx0,L.boardTop,L.bc*G.BW,L.bc*G.BH);g.clip();
  for(let r=0;r<G.BH;r++)for(let c=0;c<G.BW;c++){const x=G.cells[r][c];if(!x||x.kind==='empty')continue;
    let px=L.bx0+c*L.bc,py=L.boardTop+r*L.bc;
    if(x.kind==='cube'){
      if(x.from!=null&&G.state==='fall')py=L.boardTop+lerp(x.from,r,fallT)*L.bc;
      if(G.swapPair&&swapT<1){const [a,b]=G.swapPair;const me=a[0]===r&&a[1]===c?b:b[0]===r&&b[1]===c?a:null;
        if(me){px=lerp(L.bx0+me[1]*L.bc,px,ease(swapT));py=lerp(L.boardTop+me[0]*L.bc,py,ease(swapT));}}
      let k=1;if(x.dying)k=0.85+0.15*Math.sin(G.t*30);
      if(x.glow){g.globalAlpha=x.glow*0.6;g.fillStyle='#fff';rr(g,px,py,L.bc,L.bc,L.bc*0.25);g.fill();g.globalAlpha=1;}
      const sel=ui.sel&&ui.sel[0]===r&&ui.sel[1]===c,hint=ui.hint&&ui.hint.some(([a,b])=>a===r&&b===c)&&Math.floor(G.t*2.5)%2;
      if(sel||hint){g.fillStyle=sel?'rgba(255,255,255,.28)':'rgba(255,216,77,.3)';rr(g,px+1,py+1,L.bc-2,L.bc-2,L.bc*0.25);g.fill();}
      const ss=bs*k;cube(g,px+(L.bc-ss)/2,py+(L.bc-ss)/2,ss,colorHex(x.color));
    }else if(x.kind==='choco'){
      rr(g,px+bo,py+bo,bs,bs,bs*0.18);g.fillStyle='#6B3E22';g.fill();
      g.strokeStyle='#4A2A16';g.lineWidth=2;g.beginPath();g.moveTo(px+L.bc/2,py+bo+3);g.lineTo(px+L.bc/2,py+L.bc-bo-3);g.moveTo(px+bo+3,py+L.bc/2);g.lineTo(px+L.bc-bo-3,py+L.bc/2);g.stroke();
      label(g,String(x.layers),px+L.bc/2,py+L.bc/2,L.bc*0.45,'#fff','rgba(0,0,0,.5)');
    }
  }
  g.restore();
  G.trays.forEach(t=>{if(t.gone)return;const x=L.bx0+t.c*L.bc,y=L.boardTop+t.r*L.bc,w=L.bc*2;
    rr(g,x+3,y+3,w-6,w-6,10);g.fillStyle='#E8D9B5';g.fill();g.strokeStyle='#B89B5E';g.lineWidth=2;g.stroke();
    t.bottles.forEach((b,i)=>{const bx=x+(i%2+0.5)*L.bc,by=y+(Math.floor(i/2)+0.5)*L.bc,hex=colorHex(b.color);
      g.globalAlpha=b.broken?0.18:1;rr(g,bx-L.bc*0.18,by-L.bc*0.22,L.bc*0.36,L.bc*0.5,6);g.fillStyle=hex;g.fill();
      rr(g,bx-L.bc*0.08,by-L.bc*0.36,L.bc*0.16,L.bc*0.16,3);g.fillStyle=shade(hex,-0.3);g.fill();g.globalAlpha=1;});
  });
  // shots
  for(const s of G.shots){const a=G.ants[s.ant],to=antCenter(G,L,a);
    const from=s.origin.slot!=null?slotCenter(G,L,s.origin.slot):{x:PAD+(s.origin.bomb+0.5)/s.origin.of*(LW-PAD*2),y:L.slotTop+SLOT_H/2};
    const p=s.dur?1-Math.max(0,s.t)/s.dur:1;if(s.t>s.dur)continue;
    const e=ease(p),x=lerp(from.x,to.x,e),y=lerp(from.y,to.y,e)-Math.sin(p*Math.PI)*16;
    g.fillStyle=s.color?colorHex(s.color):'#fff';g.beginPath();g.arc(x,y,5,0,Math.PI*2);g.fill();g.strokeStyle='#fff';g.lineWidth=1.5;g.stroke();}
  // match flights
  for(const f of G.flights){const p=f.dur?1-Math.max(0,f.t)/f.dur:1,e=ease(p);
    const from={x:L.bx0+(f.at.c+0.5)*L.bc,y:L.boardTop+(f.at.r+0.5)*L.bc};
    const free=G.slots.findIndex(s=>s.lock===0&&!s.cannon),to=free>=0?slotCenter(G,L,free):{x:LW/2,y:L.slotTop+SLOT_H/2};
    g.fillStyle=colorHex(f.color);g.beginPath();g.arc(lerp(from.x,to.x,e),lerp(from.y,to.y,e)-Math.sin(p*Math.PI)*30,7,0,Math.PI*2);g.fill();}
  // popups
  for(const p of ui.pops){const a=p.age<0.8?1:Math.max(0,1-(p.age-0.8)/0.4);g.globalAlpha=a;
    const y=p.y-p.age*26;if(p.text)label(g,p.text,p.x,y,p.text.length>9?14:18,p.color||'#fff','rgba(20,12,40,.9)');
    if(p.sub)label(g,p.sub,p.x,y+(p.text?18:0),14,'#fff','rgba(20,12,40,.9)');g.globalAlpha=1;}
  if(!G.started&&!G.over){rr(g,LW/2-120,L.boardTop+L.bc*G.BH/2-18,240,36,18);g.fillStyle='rgba(20,12,40,.8)';g.fill();
    g.font=`600 13px ${FONT}`;g.fillStyle='#fff';g.textAlign='center';g.textBaseline='middle';g.fillText('Swap two cubes to make a line of 3',LW/2,L.boardTop+L.bc*G.BH/2);}
}
/* turn engine events into popups at screen positions */
export function eventPops(G,L,ev){
  const at=p=>({x:L.bx0+(p.c+0.5)*L.bc,y:L.boardTop+(p.r+0.5)*L.bc});
  if(ev.type==='match'){const q=at(ev.at);return {...q,text:ev.praise,sub:'+'+ev.ammo+(ev.bonus?` (+${ev.bonus} bottle)`:''),color:shade(colorHex(ev.color),0.4)};}
  if(ev.type==='notarget'){const q=at(ev.at);return {...q,text:'No target',color:'#C9B8E8'};}
  if(ev.type==='lost')return {x:LW/2,y:L.slotTop+SLOT_H/2,text:'Slots full: cannon lost',color:'#FF8AA0'};
  if(ev.type==='unlock'){const q=slotCenter(G,L,ev.slot);return {...q,text:'Slot open',color:'#9FE8B5'};}
  if(ev.type==='merge'){const q=slotCenter(G,L,ev.slot);return {...q,y:q.y-26,text:'Merge ×3',color:shade(colorHex(ev.color),0.4)};}
  if(ev.type==='reshuffle')return {x:LW/2,y:L.boardTop+L.bc*G.BH/2,text:'No move: reshuffle',color:'#fff'};
  if(ev.type==='shuffle')return {x:LW/2,y:L.boardTop+L.bc*G.BH/2,text:'Shuffle',color:'#fff'};
  if(ev.type==='hand'){const q=slotCenter(G,L,ev.slot);return {...q,y:q.y-26,text:'Hand',color:'#FFD84D'};}
  if(ev.type==='bomb')return {x:LW/2,y:L.slotTop,text:'Bomb!',color:'#FFD84D'};
  if(ev.type==='bottle')return null;
  return null;
}
export {BOTTLE_BONUS};
