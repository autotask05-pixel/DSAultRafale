const $ = s => document.querySelector(s);
let model = null;

function parseFlights() {
  const edges = $('#flights').value.trim().split(/\r?\n/).filter(Boolean).map((line, i) => {
    const p = line.trim().split(/\s*,\s*|\s+/).map(Number);
    if (p.length !== 3 || p.some(x => !Number.isFinite(x)) || p[2] < 0) throw Error(`Invalid flight on line ${i + 1}`);
    return {from:p[0], to:p[1], price:Math.floor(p[2]), id:i};
  });
  if (!edges.length) throw Error('Add at least one flight.');
  return edges;
}

// Same state-space DP as FlightCouponSolver.java: city, flights used, coupons used.
function solve(edges, K, C) {
  const n = Math.max(...edges.flatMap(e => [e.from,e.to])), maxFlights=K+1;
  const dp = Array.from({length:maxFlights+1},()=>Array.from({length:n+1},()=>Array(C+1).fill(Infinity)));
  const parent = Array.from({length:maxFlights+1},()=>Array.from({length:n+1},()=>Array(C+1)));
  dp[0][1][0]=0;
  for(let f=0;f<maxFlights;f++) for(let u=1;u<=n;u++) for(let c=0;c<=C;c++) if(Number.isFinite(dp[f][u][c])) {
    for(const e of edges) if(e.from===u) {
      [[c,e.price,false], ...(c<C?[[c+1,Math.floor(e.price/2),true]]:[])].forEach(([nc,cost,coupon])=>{
        if(dp[f][u][c]+cost < dp[f+1][e.to][nc]) { dp[f+1][e.to][nc]=dp[f][u][c]+cost; parent[f+1][e.to][nc]={u,c,edge:e.id,coupon}; }
      });
    }
  }
  let best=Infinity,end=null;
  for(let f=1;f<=maxFlights;f++) for(let c=0;c<=C;c++) if(dp[f][n][c]<best){best=dp[f][n][c];end={f,city:n,c};}
  if(!end) return {n,cost:-1,path:[],couponEdges:new Set()};
  const path=[], couponEdges=new Set(); let cur=end;
  while(cur.f){const p=parent[cur.f][cur.city][cur.c];path.push(p.edge);if(p.coupon)couponEdges.add(p.edge);cur={f:cur.f-1,city:p.u,c:p.c};}
  return {n,cost:best,path:path.reverse(),couponEdges};
}

function draw(edges, result) {
  const n=result.n, W=860,H=470, positions={};
  for(let i=1;i<=n;i++){const a=-Math.PI/2+(i-1)*2*Math.PI/n;positions[i]={x:W/2+Math.cos(a)*Math.min(300,60+n*20),y:H/2+Math.sin(a)*Math.min(160,45+n*13)}}
  const pathSet=new Set(result.path), marker=`<defs><marker id="arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9z" fill="#aebbd0"/></marker></defs>`;
  let svg=`<svg viewBox="0 0 ${W} ${H}" aria-label="Flight network">${marker}<g>`;
  edges.forEach(e=>{const a=positions[e.from],b=positions[e.to],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),ox=dx/d*25,oy=dy/d*25, mx=(a.x+b.x)/2-dy/d*12,my=(a.y+b.y)/2+dx/d*12;const cls=result.couponEdges.has(e.id)?'edge path coupon':pathSet.has(e.id)?'edge path':'edge';svg+=`<line data-edge="${e.id}" class="${cls}" x1="${a.x+ox}" y1="${a.y+oy}" x2="${b.x-ox}" y2="${b.y-oy}" marker-end="url(#arrow)"/><text class="edge-label" x="${mx}" y="${my}">₹${e.price}${result.couponEdges.has(e.id)?' → ₹'+Math.floor(e.price/2):''}</text>`});
  for(let i=1;i<=n;i++){let cls=i===1?'start':i===n?'end':''; if(!cls && result.path.some(id=>edges[id].to===i))cls='stop';const p=positions[i];svg+=`<g class="node ${cls}"><circle cx="${p.x}" cy="${p.y}" r="23"/><text x="${p.x}" y="${p.y}">${i}</text></g>`} $('#graph').innerHTML=svg+'</g></svg>';
}

function updateJourney(edges,result,visible=result.path.length){let cost=0, stops=0;const items=result.path.slice(0,visible).map((id,i)=>{const e=edges[id],coupon=result.couponEdges.has(id);cost+=coupon?Math.floor(e.price/2):e.price;if(i>0)stops++;return `<span class="chip ${coupon?'gold':''}">${e.from} → ${e.to}${coupon?' · coupon':''}</span>`});$('#journey').innerHTML=items.join('')+(visible?`<span class="chip">Running total: ₹${cost} · Stops: ${stops}</span>`:'');}

function run(){try{const edges=parseFlights(),K=+$('#stops').value,C=+$('#coupons').value;if(K<0||C<0)throw Error('Stops and coupons cannot be negative.');const result=solve(edges,K,C);model={edges,result,K,C};$('#download').disabled=$('#animate').disabled=result.cost<0;if(result.cost<0){$('#cost').textContent='-1';$('#summary').textContent='No route reaches the destination within the stop limit.';$('#graph').innerHTML='<p class="empty">No valid route found.</p>';$('#journey').innerHTML='';return;}$('#cost').textContent='₹'+result.cost;$('#summary').textContent=`City 1 → City ${result.n} · ${result.path.length-1} stop${result.path.length-1===1?'':'s'} · ${result.couponEdges.size} coupon${result.couponEdges.size===1?'':'s'} used`;draw(edges,result);updateJourney(edges,result)}catch(e){alert(e.message)}}
$('#solve').onclick=run;
$('#animate').onclick=async()=>{if(!model)return;draw(model.edges,model.result);for(let i=0;i<=model.result.path.length;i++){updateJourney(model.edges,model.result,i);if(i){const id=model.result.path[i-1];document.querySelector(`[data-edge="${id}"]`)?.classList.add('active')}await new Promise(r=>setTimeout(r,750));}};
$('#generate').onclick=()=>{const K=+$('#stops').value||2,C=+$('#coupons').value||1,n=6, lines=[];for(let i=1;i<n;i++)lines.push(`${i},${i+1},${50+Math.floor(Math.random()*251)}`);for(let i=0;i<5;i++){let a=1+Math.floor(Math.random()*(n-1)),b=a+1+Math.floor(Math.random()*(n-a));lines.push(`${a},${b},${50+Math.floor(Math.random()*351)}`)}$('#flights').value=lines.join('\n');$('#coupons').value=C;run();};
$('#csv').onchange=e=>{const f=e.target.files[0];if(!f)return;const reader=new FileReader();reader.onload=()=>{$('#flights').value=reader.result.split(/\r?\n/).filter((x,i)=>i||!/[a-z]/i.test(x)).map(x=>x.split(',').slice(0,3).join(',')).filter(Boolean).join('\n');run()};reader.readAsText(f)};
$('#download').onclick=()=>{if(!model)return;const {edges,result}=model;const rows=['from,to,price,on_path,coupon_used',...edges.map(e=>`${e.from},${e.to},${e.price},${result.path.includes(e.id)?'x':''},${result.couponEdges.has(e.id)?'x':''}`)];const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([rows.join('\n')],{type:'text/csv'}));a.download='marked_path.csv';a.click();URL.revokeObjectURL(a.href)};
run();
