'use strict';
const canvas=document.getElementById('race'),ctx=canvas.getContext('2d');
const startBtn=document.getElementById('startBtn'),replayBtn=document.getElementById('replayBtn');
const commentary=document.getElementById('commentary'),remaining=document.getElementById('remaining'),leaderEl=document.getElementById('leader'),velocity=document.getElementById('velocity');
const countdown=document.getElementById('countdown'),photo=document.getElementById('photoFinish'),result=document.getElementById('result'),podium=document.getElementById('podium'),raceInfo=document.getElementById('raceInfo');
let horses=[],running=false,lastSeed=null,lastScenario=null,animId=null;
const colors=['#eee','#111','#df2c2c','#315fd4','#f3d342','#51a449','#e78739','#df79ab','#8d6a49','#6e53b8','#19a6a6','#8c8c8c','#cd9230','#48694a','#ab3654','#27548f','#784630'];
const scenarios={
 fast:{label:'標準・高速馬場',pace:1.02,outer:1.0,wind:0,collapse:0,soft:0},
 outer:{label:'外ラチ高速',pace:1.01,outer:1.55,wind:0,collapse:0,soft:0},
 wind:{label:'向かい風',pace:.98,outer:1.05,wind:1,collapse:.2,soft:0},
 collapse:{label:'前崩れ',pace:1.04,outer:1.1,wind:.15,collapse:1,soft:0},
 soft:{label:'稍重想定',pace:.96,outer:.9,wind:.1,collapse:.35,soft:1}
};
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296}}
function gaussian(rng){let u=0,v=0;while(!u)u=rng();while(!v)v=rng();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}
function chooseScenario(rng){const pick=rng();return pick<.42?'fast':pick<.67?'outer':pick<.81?'wind':pick<.93?'collapse':'soft'}
function resize(){const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);ctx.setTransform(d,0,0,d,0,0);drawIdle()}
window.addEventListener('resize',resize);
fetch('horses.json').then(r=>r.json()).then(data=>{horses=data;renderProb();resize()}).catch(()=>{commentary.textContent='データ読込に失敗しました。公開URLから開いてください。'});
function renderProb(){const body=document.getElementById('probBody');const sorted=[...horses].sort((a,b)=>b.win-a.win);const marks=['◎','○','▲','☆','△'];body.innerHTML=sorted.map((h,i)=>`<tr><td class="mark">${marks[i]||''}</td><td>${h.num} ${h.name}</td><td>${h.jockey}</td><td>${h.win.toFixed(2)}%</td><td>${h.top2.toFixed(2)}%</td><td>${h.top3.toFixed(2)}%</td></tr>`).join('')}
document.getElementById('toggleProb').onclick=()=>{const b=document.getElementById('probBox');b.classList.toggle('collapsed');document.getElementById('toggleProb').textContent=b.classList.contains('collapsed')?'表を開く':'表を閉じる'};
function drawIdle(){if(!horses.length)return;drawScene(horses.map((h,i)=>({...h,x:.03+i*.001,lane:i,phase:i*.4})),0,0,'idle')}
function createRace(seed,scenarioKey){const rng=mulberry32(seed),s=scenarios[scenarioKey];return horses.map((h,i)=>{const styleBoost=h.style==='逃げ'?1:h.style==='先行'?.45:-.18;const gate=(h.num-9)/8;const base=(.27*h.speed+.18*h.sustain+.23*h.straight+.18*h.form+.14*h.jockeyRating);
 const start=Math.max(-.7,Math.min(.85,gaussian(rng)*.23+(h.speed-80)/50));
 const laneTarget=Math.max(0,Math.min(16,i+(16-i)*(.48+.24*rng()) + gate*s.outer*2.2));
 const personal=gaussian(rng)*5.8;
 const finishKick=(h.sustain-78)*.09+(h.straight-80)*.055+gaussian(rng)*1.4;
 const collapsePenalty=(h.style==='逃げ'?2.2:h.style==='先行'?.75:-1.4)*s.collapse;
 const windPenalty=(h.style==='逃げ'?1.4:h.style==='先行'?.4:-.8)*s.wind;
 const softAdj=((h.sustain-h.speed)*.08)*s.soft;
 const rating=base+gate*2*s.outer+personal-collapsePenalty-windPenalty+softAdj;
 return {...h,lane:i,laneStart:i,laneTarget,start,rating,finishKick,phase:rng()*6.28,bob:rng(),distance:0,speedNow:0,blocked:0};})}
function performanceAt(h,p,s,race){let accel=Math.min(1,p/.12);let cruise=1;let kick=0;if(p>.58)kick=(p-.58)/.42*h.finishKick*.012;let fade=0;if(p>.72){const early=h.style==='逃げ'?1.15:h.style==='先行'?.55:0;fade=(p-.72)*early*(.45+s.collapse*.55)}
 let q=(h.rating-70)*.0052 + h.start*.018 + kick - fade;
 // traffic pressure: horses close ahead in same lane
 h.blocked=0;for(const o of race){if(o===h)continue;if(o.distance>h.distance&&o.distance-h.distance<.035&&Math.abs(o.lane-h.lane)<.75){h.blocked=Math.max(h.blocked,.012*(1-p)+.006)}}
 return Math.max(.72,accel*(s.pace+q-h.blocked));}
function startRace(replay=false){if(running||!horses.length)return;running=true;result.classList.add('hidden');photo.classList.add('hidden');startBtn.disabled=true;replayBtn.disabled=true;const seed=replay&&lastSeed!==null?lastSeed:Math.floor(Math.random()*2147483647);let key;if(replay&&lastScenario)key=lastScenario;else{const choice=document.getElementById('scenario').value;const rng=mulberry32(seed);key=choice==='auto'?chooseScenario(rng):choice}lastSeed=seed;lastScenario=key;const race=createRace(seed,key);let count=3;countdown.textContent=count;commentary.textContent='ゲート内、態勢完了';const timer=setInterval(()=>{count--;if(count>0)countdown.textContent=count;else{clearInterval(timer);countdown.textContent='START';setTimeout(()=>{countdown.textContent='';runAnimation(race,key,seed)},500)}},700)}
startBtn.onclick=()=>startRace(false);replayBtn.onclick=()=>startRace(true);
function runAnimation(race,key,seed){const s=scenarios[key],play=+document.getElementById('speed').value,duration=26000/play,start=performance.now();let prev=start;commentary.textContent='スタート！各馬一斉に飛び出した';
 function frame(now){const dt=Math.min(.05,(now-prev)/1000);prev=now;const p=Math.min(1,(now-start)/duration);for(const h of race){h.lane=h.laneStart+(h.laneTarget-h.laneStart)*Math.min(1,p/.42);const perf=performanceAt(h,p,s,race);h.speedNow=perf*72;h.distance=Math.min(1.02,h.distance+dt/duration*1000*perf)}
 const order=[...race].sort((a,b)=>b.distance-a.distance);updateHud(p,order,s);drawScene(race,p,(now-start)/1000,'race');if(p<1){animId=requestAnimationFrame(frame)}else finishRace(order,key,seed)}animId=requestAnimationFrame(frame)}
function updateHud(p,order,s){remaining.textContent=Math.max(0,Math.round((1-p)*1000/10)*10)+'m';leaderEl.textContent=`${order[0].num} ${order[0].name}`;velocity.textContent=Math.round(order[0].speedNow)+' km/h';if(p<.12)commentary.textContent='好発を切った先行勢、外ラチへ進路を取る';else if(p<.38)commentary.textContent=`${order[0].num}番が先頭。外へ馬群が集まっていく`;else if(p<.60)commentary.textContent='中盤、各馬トップスピード。隊列は横に広がった';else if(p<.78)commentary.textContent='残り400m！ここから持続力勝負';else if(p<.92)commentary.textContent=`${order[0].num}番先頭！後続も一気に差を詰める`;else commentary.textContent='ゴール前、大接戦！'}
function drawScene(race,p,t,mode){const w=canvas.clientWidth,h=canvas.clientHeight;ctx.clearRect(0,0,w,h);
 // sky
 const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,'#82c5e6');g.addColorStop(.48,'#d8edf6');g.addColorStop(.49,'#477a3a');g.addColorStop(1,'#20552a');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
 // clouds and stands moving
 const cam=mode==='race'?Math.max(0,p-.10)*w*1.25:0;ctx.save();ctx.translate(-(cam%w),0);for(let k=0;k<3;k++){drawStand(k*w, h*.28,w,h*.23);drawStand(k*w+w,h*.28,w,h*.23)}ctx.restore();
 // turf stripes
 for(let i=0;i<16;i++){ctx.fillStyle=i%2?'#3f8a3e':'#489744';ctx.fillRect(0,h*.50+i*h*.032,w,h*.034)}
 // perspective lane lines
 ctx.strokeStyle='rgba(255,255,255,.22)';ctx.lineWidth=1;for(let i=0;i<18;i++){const y=h*.52+(i/17)*h*.42;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
 // distance posts
 if(mode==='race'){for(let m=200;m<=800;m+=200){const rel=(m/1000-p)*1.15;const x=w*(.82-rel);if(x>-30&&x<w+30){ctx.fillStyle='#fff';ctx.fillRect(x,h*.44,5,h*.12);ctx.fillStyle='#111';ctx.font='bold 12px sans-serif';ctx.fillText(m+'m',x-12,h*.43)}}}
 // sort far to near by lane
 const draw=[...race].sort((a,b)=>a.lane-b.lane);for(const hr of draw){let progress=mode==='idle'?.06:hr.distance;let x=w*(.13+progress*.73);if(mode==='race')x-=p*w*.58;const laneNorm=hr.lane/16;const y=h*(.54+laneNorm*.37);const scale=.48+laneNorm*.48;drawHorse(ctx,x,y,scale,hr, t)}
 // rail
 ctx.strokeStyle='#f5f5f5';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(0,h*.93);ctx.lineTo(w,h*.93);ctx.stroke();ctx.strokeStyle='#9ba3aa';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,h*.97);ctx.lineTo(w,h*.97);ctx.stroke();
 // finish line
 if(mode==='race'&&p>.78){const fx=w*(.13+1*.73)-p*w*.58;ctx.fillStyle='#fff';ctx.fillRect(fx,h*.43,7,h*.50);for(let z=0;z<12;z++){ctx.fillStyle=z%2?'#111':'#fff';ctx.fillRect(fx-12+(z%2)*12,h*.43+Math.floor(z/2)*12,12,12)}}}
function drawStand(x,y,w,h){ctx.fillStyle='#d9e1e6';ctx.fillRect(x,y,w,h);ctx.fillStyle='#8f9ba5';for(let r=0;r<5;r++)ctx.fillRect(x,y+r*h/5,w,2);ctx.fillStyle='#52606e';for(let i=0;i<45;i++){const px=x+(i/45)*w;ctx.fillRect(px,y+h*.2+(i%5)*6,3,6)}}
function drawHorse(c,x,y,s,h,t){c.save();c.translate(x,y);c.scale(s,s);const cyc=t*10+h.phase,b=Math.sin(cyc)*2; // shadow
 c.fillStyle='rgba(0,0,0,.28)';c.beginPath();c.ellipse(0,19,35,6,0,0,Math.PI*2);c.fill();
 c.translate(0,b*.45);const coat=['#5b2b17','#7a3e22','#3f251a','#8a4e2a'][h.num%4];c.strokeStyle=coat;c.fillStyle=coat;c.lineCap='round';
 // legs
 const a=Math.sin(cyc)*13,a2=Math.sin(cyc+Math.PI)*13;c.lineWidth=6;leg(-18,10,a);leg(-6,12,a2);leg(12,10,a2);leg(23,8,a);
 // body
 c.beginPath();c.ellipse(0,0,31,14,-.08,0,Math.PI*2);c.fill();
 // neck head
 c.save();c.translate(22,-6);c.rotate(-.55);c.fillRect(-4,-18,10,27);c.restore();c.beginPath();c.ellipse(32,-24,12,7,-.15,0,Math.PI*2);c.fill();c.beginPath();c.moveTo(35,-30);c.lineTo(39,-39);c.lineTo(31,-31);c.fill();
 // tail
 c.strokeStyle=coat;c.lineWidth=5;c.beginPath();c.moveTo(-29,-2);c.quadraticCurveTo(-43,-10+Math.sin(cyc)*5,-49,3);c.stroke();
 // saddlecloth
 c.fillStyle=colors[h.num-1];c.fillRect(-12,-10,22,17);c.fillStyle=(h.num===2||h.num===5||h.num===8)?'#111':'#fff';c.font='bold 14px sans-serif';c.textAlign='center';c.fillText(h.num,-1,4);
 // jockey
 c.fillStyle=colors[(h.num+5)%colors.length];c.beginPath();c.arc(7,-28,6,0,Math.PI*2);c.fill();c.strokeStyle=colors[(h.num+2)%colors.length];c.lineWidth=7;c.beginPath();c.moveTo(5,-22);c.lineTo(-2,-9);c.stroke();c.strokeStyle='#222';c.lineWidth=3;c.beginPath();c.moveTo(-1,-13);c.lineTo(20,-22);c.stroke();c.restore();
 function leg(px,py,ang){c.beginPath();c.moveTo(px,py);c.lineTo(px+ang*.45,py+17);c.lineTo(px+ang,py+29);c.stroke()}}
function finishRace(order,key,seed){running=false;startBtn.disabled=false;replayBtn.disabled=false;photo.classList.remove('hidden');photo.textContent='GOAL';setTimeout(()=>photo.classList.add('hidden'),900);commentary.textContent=`1着 ${order[0].num}番 ${order[0].name}`;remaining.textContent='0m';leaderEl.textContent=`${order[0].num} ${order[0].name}`;const top=order.slice(0,5);podium.innerHTML=top.map((h,i)=>`<div class="podium-row"><div class="place">${i+1}着</div><div class="horse-num" style="background:${colors[h.num-1]};color:${h.num===2||h.num===5||h.num===8?'#111':'#fff'}">${h.num}</div><div><div class="horse-name">${h.name}</div><small>${h.jockey}・${h.style}</small></div><strong>${i===0?'推定 '+h.win.toFixed(2)+'%':''}</strong></div>`).join('');raceInfo.textContent=`展開：${scenarios[key].label}／シード：${seed}。同じレースを再生すると同一展開を確認できます。`;result.classList.remove('hidden');result.scrollIntoView({behavior:'smooth',block:'nearest'})}
resize();
