/* Chart reader, classic image processing only (no ML, no network).
   Pipeline: gray -> quality metrics -> adaptive binarize -> grid-line scores -> lattice fit
   -> cell existence -> cell fingerprints -> clusters -> dictionary suggestions. */
(function(){
'use strict';
var N=14; // fingerprint size

function grayFromCanvas(cv){
  var d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data, n=cv.width*cv.height, g=new Uint8ClampedArray(n);
  for(var i=0;i<n;i++) g[i]=0.299*d[4*i]+0.587*d[4*i+1]+0.114*d[4*i+2];
  return g;
}
function sharpness(g,w,h){
  var s=0,s2=0,n=0,i,l;
  for(var y=1;y<h-1;y++) for(var x=1;x<w-1;x++){ i=y*w+x; l=4*g[i]-g[i-1]-g[i+1]-g[i-w]-g[i+w]; s+=l; s2+=l*l; n++; }
  var m=s/n; return s2/n-m*m;
}
function contrast(g){
  var hist=new Uint32Array(256),i; for(i=0;i<g.length;i++) hist[g[i]]++;
  var lo=0,hi=255,c=0,a=g.length*0.02,b=g.length*0.98;
  for(i=0;i<256;i++){ c+=hist[i]; if(c>=a){lo=i;break;} }
  c=0; for(i=0;i<256;i++){ c+=hist[i]; if(c>=b){hi=i;break;} }
  return hi-lo;
}
function binarize(g,w,h,kf){ kf=kf||0.86;
  var r=Math.max(10,Math.round(Math.min(w,h)/30)), W=w+1, I=new Float64Array(W*(h+1)), x,y;
  for(y=0;y<h;y++){ var row=0; for(x=0;x<w;x++){ row+=g[y*w+x]; I[(y+1)*W+x+1]=I[y*W+x+1]+row; } }
  var ink=new Uint8Array(w*h);
  for(y=0;y<h;y++){ var y0=Math.max(0,y-r),y1=Math.min(h,y+r+1);
    for(x=0;x<w;x++){ var x0=Math.max(0,x-r),x1=Math.min(w,x+r+1);
      var sum=I[y1*W+x1]-I[y0*W+x1]-I[y1*W+x0]+I[y0*W+x0], mean=sum/((x1-x0)*(y1-y0));
      var v=g[y*w+x]; ink[y*w+x]=(v<mean*kf-3||v<70)?1:0; } }
  return ink;
}
function lineScores(ink,w,h,L){
  var hs=new Float32Array(h), vs=new Float32Array(w), x,y,run;
  for(y=0;y<h;y++){ run=0; for(x=0;x<=w;x++){ if(x<w&&ink[y*w+x]) run++; else { if(run>=L) hs[y]+=run; run=0; } } }
  for(x=0;x<w;x++){ run=0; for(y=0;y<=h;y++){ if(y<h&&ink[y*w+x]) run++; else { if(run>=L) vs[x]+=run; run=0; } } }
  return {hs:hs,vs:vs};
}
function peaks(s,frac,minAbs){
  var mx=0,i; for(i=0;i<s.length;i++) if(s[i]>mx) mx=s[i];
  if(mx<minAbs) return [];
  var thr=frac*mx, out=[], start=-1, last=-9, sw=0, sx=0;
  function flush(){ if(sw>0) out.push({p:sx/sw,w:sw}); sw=0; sx=0; }
  for(i=0;i<s.length;i++){ if(s[i]>=thr){ if(i-last>2) flush(); sw+=s[i]; sx+=s[i]*i; last=i; } }
  flush(); return out;
}
function ls(pts){ // pts [k,p] -> {a,m}
  var n=pts.length,sk=0,sp=0,skk=0,skp=0,i;
  for(i=0;i<n;i++){ sk+=pts[i][0]; sp+=pts[i][1]; skk+=pts[i][0]*pts[i][0]; skp+=pts[i][0]*pts[i][1]; }
  var den=n*skk-sk*sk; if(Math.abs(den)<1e-9) return null;
  var m=(n*skp-sk*sp)/den; return {a:(sp-m*sk)/n,m:m};
}
function fitLattice(objs,lenient){
  if(objs.length<(lenient?4:5)) return [];
  var pos=objs.map(function(o){return o.p;}), wt=objs.map(function(o){return o.w;}), i;
  var gaps=[]; for(i=0;i<pos.length-1;i++) gaps.push(pos[i+1]-pos[i]);
  var cands=gaps.filter(function(g){return g>=8;}), found=[];
  cands.forEach(function(m0){ pos.forEach(function(anchor){
    var a=anchor,m=m0,pts=[],it,k,p,wsum=0;
    for(it=0;it<4;it++){ pts=[]; wsum=0;
      for(i=0;i<pos.length;i++){ p=pos[i]; k=Math.round((p-a)/m); if(Math.abs(p-(a+k*m))<0.16*m){ pts.push([k,p]); wsum+=wt[i]; } }
      if(pts.length<(lenient?3:4)) return; var f=ls(pts); if(!f||f.m<8) return; a=f.a; m=f.m; }
    var ks=pts.map(function(q){return q[0];}), span=Math.max.apply(null,ks)-Math.min.apply(null,ks);
    if(pts.length>=(lenient?4:5)&&span>=(lenient?3:4)) found.push({a:a,m:m,n:pts.length,sc:wsum}); }); });
  found.sort(function(x,y){return y.sc-x.sc;});
  var out=[]; found.forEach(function(f){ if(!out.some(function(o){return Math.abs(o.m-f.m)<0.06*f.m&&Math.abs(((o.a-f.a)/f.m)%1)<0.1||Math.abs(((o.a-f.a)/f.m)%1)>0.9&&Math.abs(o.m-f.m)<0.06*f.m;})) out.push(f); });
  return out.slice(0,8);
}
function pickPair(cx,cy){
  var best=null; if(!cx.length||!cy.length) return null;
  var mx=Math.max.apply(null,cx.map(function(f){return f.sc;})), my=Math.max.apply(null,cy.map(function(f){return f.sc;}));
  cx.forEach(function(x){ cy.forEach(function(y){
    var asp=Math.abs(Math.log(x.m/y.m)), sc=x.sc/mx+y.sc/my-4*Math.max(0,asp-0.12);
    if(!best||sc>best.sc) best={fx:x,fy:y,sc:sc,asp:asp}; }); });
  return best;
}
function latticePositions(f,size){
  var out=[],k0=Math.ceil((0-f.a)/f.m),k1=Math.floor((size-1-f.a)/f.m);
  for(var k=k0;k<=k1;k++) out.push(f.a+k*f.m); return out;
}
function bandCov(ink,w,h,fixed,a,b,horiz,band){
  var hit=0,tot=0,t,d,v;
  for(t=Math.max(0,Math.round(a));t<=Math.min((horiz?w:h)-1,Math.round(b));t++){ tot++; v=0;
    for(d=-band;d<=band;d++){ var xx=horiz?t:Math.round(fixed)+d, yy=horiz?Math.round(fixed)+d:t;
      if(xx>=0&&yy>=0&&xx<w&&yy<h&&ink[yy*w+xx]){v=1;break;} }
    hit+=v; }
  return tot?hit/tot:0;
}
/* look a few pixels either side of the expected line for where the printed line really is (thin band, best coverage) */
function bestEdge(ink,w,h,fixed,a,b,horiz,sr){
  var best={c:-1,p:fixed},d1,d2,t,n=Math.max(1,Math.round(b-a)),len=(horiz?w:h);
  for(d1=-sr;d1<=sr;d1++) for(d2=-sr;d2<=sr;d2++){ if(Math.abs(d2-d1)>2) continue;
    var hit=0,tot=0;
    for(t=Math.max(0,Math.round(a));t<=Math.min(len-1,Math.round(b));t+=2){ var u=(t-a)/n, off=Math.round(fixed+d1+(d2-d1)*u), ok=0, q;
      for(q=-1;q<=1;q++){ var xx=horiz?t:off+q, yy=horiz?off+q:t; if(xx>=0&&yy>=0&&xx<w&&yy<h&&ink[yy*w+xx]){ ok=1; break; } }
      hit+=ok; tot++; }
    var cv=tot?hit/tot:0, p=fixed+(d1+d2)/2;
    if(cv>best.c+0.02||(Math.abs(cv-best.c)<=0.02&&Math.abs(p-fixed)<Math.abs(best.p-fixed))) best={c:cv,p:p}; }
  return best; }
function fingerprint(ink,w,x0,y0,x1,y1){
  var ins=0.15*(x1-x0), ax=x0+ins, bx=x1-ins, ay=y0+ins, by=y1-ins, v=new Float32Array(N*N), c=new Float32Array(N*N);
  for(var y=Math.ceil(ay);y<by;y++) for(var x=Math.ceil(ax);x<bx;x++){
    var gx=Math.min(N-1,Math.floor((x-ax)/(bx-ax)*N)), gy=Math.min(N-1,Math.floor((y-ay)/(by-ay)*N));
    v[gy*N+gx]+=ink[y*w+x]; c[gy*N+gx]++; }
  var sum=0; for(var i=0;i<v.length;i++){ v[i]=c[i]?v[i]/c[i]:0; sum+=v[i]; }
  return {v:blur(v),mean:sum/v.length};
}
function blur(v){
  var o=new Float32Array(v.length);
  for(var y=0;y<N;y++) for(var x=0;x<N;x++){ var s=0,n=0;
    for(var dy=-1;dy<=1;dy++) for(var dx=-1;dx<=1;dx++){ var yy=y+dy,xx=x+dx; if(yy>=0&&xx>=0&&yy<N&&xx<N){ s+=v[yy*N+xx]; n++; } }
    o[y*N+x]=s/n; }
  return o;
}
function sdist(a,b){
  var best=1e9,dx,dy,x,y,d,s;
  for(dy=-1;dy<=1;dy++) for(dx=-1;dx<=1;dx++){
    d=0; s=0;
    for(y=0;y<N;y++) for(x=0;x<N;x++){
      var ax=x+dx, ay=y+dy, av=(ax>=0&&ay>=0&&ax<N&&ay<N)?a[ay*N+ax]:0, bv=b[y*N+x];
      d+=Math.abs(av-bv); s+=av+bv; }
    var q=s<1e-6?0:d/s; if(q<best) best=q; }
  return best;
}
function dist(a,b){ var d=0,s=0; for(var i=0;i<a.length;i++){ d+=Math.abs(a[i]-b[i]); s+=a[i]+b[i]; } return s<1e-6?0:d/s; }

/* dictionary templates, drawn as simple strokes; printed symbols vary by publisher, so these only *suggest* */
var TPL=null;
function drawGlyph(c,ops,k){ c.strokeStyle='#000'; c.fillStyle='#000'; c.lineWidth=3.2*k; c.lineCap='round'; c.lineJoin='round';
  ops.forEach(function(o){ c.beginPath();
    if(o[0]==='L'){ c.moveTo(o[1]*k,o[2]*k); c.lineTo(o[3]*k,o[4]*k); c.stroke(); }
    else if(o[0]==='P'){ o.slice(1).forEach(function(p,i){ if(i) c.lineTo(p[0]*k,p[1]*k); else c.moveTo(p[0]*k,p[1]*k); }); c.stroke(); }
    else if(o[0]==='C'){ c.arc(o[1]*k,o[2]*k,o[3]*k,0,6.283); c.stroke(); }
    else if(o[0]==='D'){ c.arc(o[1]*k,o[2]*k,o[3]*k,0,6.283); c.fill(); }
    else if(o[0]==='U'){ c.moveTo(8*k,6*k); c.lineTo(8*k,15*k); c.arc(14*k,15*k,6*k,Math.PI,0,true); c.lineTo(20*k,6*k); c.stroke(); }
    else if(o[0]==='T'){ c.font='bold '+(11*k)+'px sans-serif'; c.textAlign='center'; c.fillText(o[1],o[2]*k,o[3]*k); } }); }
function templates(){
  if(TPL) return TPL; TPL=[];
  var lib=window.SYMLIB; if(!lib) return TPL;
  lib.items.forEach(function(it){ it.g.forEach(function(g){
    var S=84, cv=document.createElement('canvas'); cv.width=cv.height=S; var c=cv.getContext('2d');
    c.fillStyle='#fff'; c.fillRect(0,0,S,S); drawGlyph(c,g[1],S/28);
    var d=c.getImageData(0,0,S,S).data, ink=new Uint8Array(S*S); for(var i=0;i<S*S;i++) ink[i]=d[4*i]<128?1:0;
    TPL.push({id:it.id,set:g[0],v:fingerprint(ink,S,0,0,S,S).v}); }); });
  return TPL;
}
function cellLabel(q){
  var all=[]; templates().forEach(function(t){ var d=sdist(q.v,t.v); all.push({id:t.id,e:d+(RARE[t.id]?0.05:0),d:d}); });
  all.sort(function(a,b){return a.e-b.e;}); var b0=all[0]; if(!b0||b0.d>0.30) return null;
  var sec=all.filter(function(a){return a.id!==b0.id;})[0]; return (!sec||sec.e-b0.e>=0.04)?b0.id:null;
}
var RARE={sk2p:1,k3tog:1,ktbl:1,cable:1,inc3:1};
function suggest(cl){
  if(cl.kind==='blank') return {label:'blank',score:1};
  if(cl.kind==='filled') return {label:'nostitch',score:1};
  var all=[];
  templates().forEach(function(t){ var d=sdist(cl.v,t.v); all.push({id:t.id,set:t.set,d:Math.round(d*100)/100,e:d+(RARE[t.id]?0.05:0)}); });
  all.sort(function(a,b){return a.e-b.e;}); cl.top=all.slice(0,3);
  var best=all[0]; if(!best) return {label:'',score:0};
  var second=all.filter(function(a){return a.id!==best.id;})[0], margin=second?second.e-best.e:1;
  return best.d<0.62?{label:best.id,set:best.set,score:1-best.d,margin:margin}:{label:'',score:0};
}

function largestBlock(cells){
  var map={},seen={},best=[],i; cells.forEach(function(q){ map[q.r+','+q.c]=q; });
  cells.forEach(function(q){ var k=q.r+','+q.c; if(seen[k]) return;
    var st=[q],comp=[]; seen[k]=1;
    while(st.length){ var u=st.pop(); comp.push(u);
      [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d){ var kk=(u.r+d[0])+','+(u.c+d[1]); if(map[kk]&&!seen[kk]){ seen[kk]=1; st.push(map[kk]); } }); }
    if(comp.length>best.length) best=comp; });
  return best;
}
/* follow the real printed lines where the photo is slightly curved or tilted: pull each lattice line to the nearest detected line (within 20% of a cell) */
function snapTo(pos,peaksList,m){ var out=pos.map(function(p){ var best=null; peaksList.forEach(function(q){ var d=Math.abs(q.p-p); if(d<0.2*m&&(!best||d<best.d)) best={d:d,p:q.p}; }); return best?best.p:p; });
  for(var i=1;i<out.length;i++) if(out[i]-out[i-1]<0.6*m) out[i]=out[i-1]+m; return out; }
/* keep only the lattice between the first and last real printed line, so margins and captions are not counted as squares */
function trimTo(pos,peaksList,m){ var lo=-1,hi=-1; pos.forEach(function(p,i){ if(peaksList.some(function(q){return Math.abs(q.p-p)<0.2*m;})){ if(lo<0) lo=i; hi=i; } }); return lo<0||hi-lo<2?pos:pos.slice(lo,hi+1); }
function analyzeCore(g,w,h,lenient,kf){
  var res={w:w,h:h,metrics:{}}, mn=Math.min(w,h);
  if(mn<200) return fail('tooSmall');
  var sharp=sharpness(g,w,h), con=contrast(g); res.metrics={sharp:sharp,contrast:con};
  if(con<45) return fail('lowContrast');
  var ink=binarize(g,w,h,kf), L=Math.max(18,Math.round(0.03*mn)), sc=lineScores(ink,w,h,L);
  var py=peaks(sc.hs,0.25,L*3), px=peaks(sc.vs,0.25,L*3);
  function withDouble(list){ var o=list.slice(); list.forEach(function(f){ o.push({a:f.a,m:f.m*2,n:f.n/2,sc:f.sc*0.9}); o.push({a:f.a+f.m,m:f.m*2,n:f.n/2,sc:f.sc*0.9}); }); return o; }
  // a lattice whose half-way positions also carry grid lines is too coarse (each "cell" would hold 2x2 real squares): use half the pitch
  function at(arr,p){ var i=Math.round(p),m=0,d; for(d=-2;d<=2;d++){ var v=arr[i+d]; if(v>m) m=v; } return m; }
  function fixHalf(list,arr){ return list.map(function(f){ var main=0,mid=0,k,n=0;
      for(k=0;;k++){ var p=f.a+k*f.m; if(p>=arr.length-3) break; if(p>=3){ main+=at(arr,p); mid+=at(arr,p+f.m/2); n++; } }
      for(k=-1;;k--){ var p2=f.a+k*f.m; if(p2<3) break; main+=at(arr,p2); mid+=at(arr,p2+f.m/2); n++; }
      if(n>=3&&main>0&&mid/main>0.8&&f.m/2>=8){ return {a:f.a,m:f.m/2,n:f.n*2,sc:f.sc,half:true}; } return f; }); }
  var cy=fixHalf(withDouble(fitLattice(py,lenient)),sc.hs), cx=fixHalf(withDouble(fitLattice(px,lenient)),sc.vs);
  res.metrics.hLines=py.length; res.metrics.vLines=px.length; res.metrics.hP=py.map(function(q){return Math.round(q.p);}); res.metrics.vP=px.map(function(q){return Math.round(q.p);});
  if(!cx.length||!cy.length) return fail(sharp<25?'blurry':(py.length+px.length<4?'noGrid':'irregular'));
  var mxx=Math.max.apply(null,cx.map(function(f){return f.sc;})), myy=Math.max.apply(null,cy.map(function(f){return f.sc;})), pairs=[];
  cx.forEach(function(x){ cy.forEach(function(y){ var asp=Math.abs(Math.log(x.m/y.m)); if(asp>0.3) return; pairs.push({fx:x,fy:y,sc:x.sc/mxx+y.sc/myy-4*Math.max(0,asp-0.12)}); }); });
  pairs.sort(function(a,b){return b.sc-a.sc;});
  if(!pairs.length) return fail('irregular');
  var cells=null, fx=null, fy=null, xs, ys, why='irregular', pi, bestC=null;
  for(pi=0;pi<Math.min(10,pairs.length);pi++){
    fx=pairs[pi].fx; fy=pairs[pi].fy;
    xs=latticePositions(fx,w); ys=latticePositions(fy,h);
    xs=snapTo(xs,px,fx.m); ys=snapTo(ys,py,fy.m);
    xs=trimTo(xs,px,fx.m); ys=trimTo(ys,py,fy.m);
    if(xs.length>120||ys.length>160){ continue; }
    var cs=[],r,c,band=Math.max(2,Math.round(0.28*Math.min(fx.m,fy.m)));
    for(r=0;r<ys.length-1;r++) for(c=0;c<xs.length-1;c++){
      var x0=xs[c],x1=xs[c+1],y0=ys[r],y1=ys[r+1],sr=Math.max(2,Math.round(0.2*Math.min(fx.m,fy.m))),
        eT=bestEdge(ink,w,h,y0,x0+3,x1-3,true,sr), eB=bestEdge(ink,w,h,y1,x0+3,x1-3,true,sr),
        eL=bestEdge(ink,w,h,x0,y0+3,y1-3,false,sr), eR=bestEdge(ink,w,h,x1,y0+3,y1-3,false,sr),
        cov=[eT.c,eB.c,eL.c,eR.c], sides=cov.filter(function(q){return q>=0.6;}).length;
      if(eT.c>=0.6) y0=eT.p; if(eB.c>=0.6) y1=eB.p; if(eL.c>=0.6) x0=eL.p; if(eR.c>=0.6) x1=eR.p;
      var fp0=sides>=3?fingerprint(ink,w,x0,y0,x1,y1):null;
      if(fp0&&(sides>=4||fp0.mean>=0.03)){ var fp=fp0;
        cs.push({s:sides,r:r,c:c,x0:x0,y0:y0,x1:x1,y1:y1,v:fp.v,mean:fp.mean,kind:fp.mean<0.03?'blank':(fp.mean>0.5?'filled':'sym')}); } }
    cs=largestBlock(cs);
    // cells whose borders were hidden by heavy neighbouring symbols: fill gaps inside each printed row
    (function(){ var have={},rmin={},rmax={}; cs.forEach(function(q){ have[q.r+','+q.c]=1; rmin[q.r]=Math.min(rmin[q.r]===undefined?1e9:rmin[q.r],q.c); rmax[q.r]=Math.max(rmax[q.r]===undefined?-1:rmax[q.r],q.c); });
      Object.keys(rmin).forEach(function(rk){ var rr=+rk; for(var cc=rmin[rk]+1;cc<rmax[rk];cc++){ if(have[rr+','+cc]) continue; if(!have[(rr-1)+','+cc]&&!have[(rr+1)+','+cc]) continue;
        var gx0=xs[cc],gx1=xs[cc+1],gy0=ys[rr],gy1=ys[rr+1]; if(gx1===undefined||gy1===undefined) continue;
        var fq=fingerprint(ink,w,gx0,gy0,gx1,gy1); cs.push({s:2,r:rr,c:cc,x0:gx0,y0:gy0,x1:gx1,y1:gy1,v:fq.v,mean:fq.mean,kind:fq.mean<0.03?'blank':(fq.mean>0.5?'filled':'sym'),filledIn:true}); } }); })();
    if(cs.length<(lenient?12:24)){ why='noGrid'; continue; }
    var s4=cs.filter(function(q){return q.s>=4;}).length/cs.length;
    (res.metrics.tries=res.metrics.tries||[]).push([Math.round(fx.m),Math.round(fy.m),cs.length,Math.round(s4*100)/100]);
    if(s4<(lenient?0.3:0.5)){ why='irregular'; continue; }
    var latN=Math.max(1,(xs.length-1)*(ys.length-1)), cand={cs:cs,s4:s4,fx:fx,fy:fy,xs:xs,ys:ys,score:cs.length*s4*Math.min(1,cs.length/latN/0.5)};
    if(!bestC||cand.score>bestC.score) bestC=cand;
  }
  if(bestC){ cells=bestC.cs; fx=bestC.fx; fy=bestC.fy; xs=bestC.xs; ys=bestC.ys; res.metrics.s4=Math.round(bestC.s4*100)/100; res.metrics.cw=Math.round(fx.m*10)/10; res.metrics.ch=Math.round(fy.m*10)/10; }
  if(!cells) return fail(why);
  res.grid={xs:xs,ys:ys,cw:fx.m,ch:fy.m}; res.cells=cells;
  var sym=cells.filter(function(q){return q.kind==='sym';}).length;
  if(sym<3) return fail('noSymbols');
  if(sharp<25) res.warn='blurry';
  var lat=Math.max(1,(xs.length-1)*(ys.length-1)); res.metrics.cov=Math.round(cells.length/lat*100)/100; res.metrics.area=Math.round((xs[xs.length-1]-xs[0])*(ys[ys.length-1]-ys[0])/(w*h)*100)/100; if(!lenient&&(res.metrics.cov<0.4||res.metrics.area<0.3)) return fail('irregular'); if(res.metrics.cov<0.6) res.partial=true;
  // clusters
  var filled=cells.filter(function(q){return q.kind==='filled';}).length;
  if(filled>0.5*cells.length) return fail('photo');
  var cls=[];
  cells.forEach(function(q){
    var key=q.kind, best=null;
    cls.forEach(function(k){ if(k.kind!==q.kind) return; var d=q.kind==='sym'?sdist(q.v,k.v):0; if(d<0.24&&(!best||d<best.d)) best={d:d,k:k}; });
    if(best){ best.k.cells.push(q); q.cl=best.k.id; }
    else { var k={id:cls.length,kind:q.kind,v:q.v,cells:[q],rep:q}; cls.push(k); q.cl=k.id; } });
  // fold tiny groups (<=2 cells) into the nearest bigger group of the same kind when they are close enough
  cls.slice().forEach(function(k){
    if(k.kind!=='sym'||k.cells.length>2) return; var best=null;
    var sk=suggest(k);
    cls.forEach(function(o){ if(o===k||o.kind!=='sym'||o.cells.length<=2) return; var d=sdist(k.v,o.v); if(d<0.5&&(!best||d<best.d)){
      var so=suggest(o); if(sk.label&&so.label&&sk.label!==so.label&&sk.score>=0.6&&so.score>=0.6) return; best={d:d,o:o}; } });
    if(best){ k.cells.forEach(function(q){ q.cl=best.o.id; best.o.cells.push(q); }); cls.splice(cls.indexOf(k),1); } });
  var merged=true;
  while(merged){ merged=false;
    for(var ia=0;ia<cls.length&&!merged;ia++) for(var ib=ia+1;ib<cls.length&&!merged;ib++){
      var A=cls[ia],B=cls[ib]; if(A.kind!=='sym'||B.kind!=='sym') continue;
      if(sdist(A.v,B.v)<0.12){ var big=A.cells.length>=B.cells.length?A:B, small=big===A?B:A; small.cells.forEach(function(q){ q.cl=big.id; big.cells.push(q); }); cls.splice(cls.indexOf(small),1); merged=true; } } }
  // a blurry group can hide two different library symbols (e.g. an arrow and an anchor): split by confident per-cell matches
  cls.slice().forEach(function(k){
    if(k.kind!=='sym'||k.cells.length<4) return;
    var lab=k.cells.map(cellLabel), cnt={}; lab.forEach(function(l){ if(l) cnt[l]=(cnt[l]||0)+1; });
    var keep=Object.keys(cnt).filter(function(l){return cnt[l]>=2;}); if(keep.length<2) return;
    var means={}; keep.forEach(function(l){ var m=new Float32Array(N*N),n=0; k.cells.forEach(function(q,i){ if(lab[i]===l){ for(var z=0;z<m.length;z++) m[z]+=q.v[z]; n++; } }); for(var z=0;z<m.length;z++) m[z]/=n; means[l]=m; });
    var groups={}; keep.forEach(function(l){ groups[l]=[]; });
    k.cells.forEach(function(q,i){ var l=lab[i]; if(!l||!groups[l]){ var bd=9,bl=keep[0]; keep.forEach(function(x){ var d=sdist(q.v,means[x]); if(d<bd){ bd=d; bl=x; } }); l=bl; } groups[l].push(q); });
    var nextId=cls.reduce(function(m,o){return Math.max(m,o.id);},0)+1;
    keep.forEach(function(l,gi){ var g=groups[l], c;
      if(gi===0){ c=k; c.cells=g; c.v=means[l]; c.rep=g[0]; } else { c={id:nextId++,kind:'sym',v:means[l],cells:g,rep:g[0]}; cls.push(c); }
      g.forEach(function(q){ q.cl=c.id; }); }); });
  cls.sort(function(a,b){return b.cells.length-a.cells.length;});
  cls.forEach(function(k){ k.sug=suggest(k); });
  var symGroups=cls.filter(function(k){return k.kind==='sym';}).length;
  res.metrics.groups=symGroups; if(symGroups>(lenient?40:20)) return fail('photo');
  res.clusters=cls; res.ok=true; return res;
  function fail(reason){ res.ok=false; res.reason=reason; return res; }
}

/* skew: find the small rotation (degrees) that makes ink lines most axis-aligned */
function estimateSkew(cv){
  var sc=Math.min(1,500/Math.max(cv.width,cv.height)), w=Math.max(8,Math.round(cv.width*sc)), h=Math.max(8,Math.round(cv.height*sc));
  var t=document.createElement('canvas'); t.width=w; t.height=h; var x=t.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,w,h); x.drawImage(cv,0,0,w,h);
  var ink=binarize(grayFromCanvas(t),w,h), pts=[], n=0, i, y, xx;
  for(y=0;y<h;y++) for(xx=0;xx<w;xx++) if(ink[y*w+xx]) n++;
  var step=Math.max(1,Math.floor(n/50000)), k=0;
  for(y=0;y<h;y++) for(xx=0;xx<w;xx++) if(ink[y*w+xx]&&(k++%step===0)) pts.push(xx,y);
  var diag=Math.ceil(Math.hypot(w,h))+2;
  function score(deg){
    var a=deg*Math.PI/180, ca=Math.cos(a), sa=Math.sin(a), hx=new Float32Array(2*diag), hy=new Float32Array(2*diag), s=0, j;
    for(j=0;j<pts.length;j+=2){ var px=pts[j],py=pts[j+1]; hx[((px*ca+py*sa)+diag)|0]++; hy[((-px*sa+py*ca)+diag)|0]++; }
    for(j=0;j<hx.length;j++) s+=hx[j]*hx[j]+hy[j]*hy[j];
    return s;
  }
  var best=0, bs=score(0), d, sc0=bs;
  for(d=-8;d<=8;d+=0.5){ var s0=score(d); if(s0>bs){ bs=s0; best=d; } }
  var c=best; for(d=c-0.5;d<=c+0.5;d+=0.1){ var s1=score(d); if(s1>bs){ bs=s1; best=d; } }
  return bs>sc0*1.04?best:0;
}
/* key (legend) lines: one entry per text line that starts with a small square-ish glyph */
function legendLines(g,w,h){
  var ink=binarize(g,w,h), rows=new Uint32Array(h), y, x, out=[];
  for(y=0;y<h;y++){ var s=0; for(x=0;x<w;x++) s+=ink[y*w+x]; rows[y]=s; }
  var bands=[], st=-1, gap=0;
  for(y=0;y<=h;y++){ var on=y<h&&rows[y]>0; if(on){ if(st<0) st=y; gap=0; } else if(st>=0){ gap++; if(gap>2||y===h){ bands.push([st,y-gap]); st=-1; gap=0; } } }
  bands.forEach(function(b){
    var y0=b[0], y1=b[1], bh=y1-y0+1; if(bh<7||bh>70) return;
    var cols=new Uint8Array(w); for(x=0;x<w;x++) for(y=y0;y<=y1;y++) if(ink[y*w+x]){ cols[x]=1; break; }
    var xs=-1; for(x=0;x<w;x++) if(cols[x]){ xs=x; break; } if(xs<0) return;
    var xe=xs, g0=0; for(x=xs;x<w;x++){ if(cols[x]){ xe=x; g0=0; } else { g0++; if(g0>Math.max(2,0.25*bh)) break; } }
    var gw=xe-xs+1; if(gw<0.6*bh||gw>2.2*bh) return;
    var last=xe; for(x=w-1;x>xe;x--) if(cols[x]){ last=x; break; }
    out.push({x0:xs,x1:xe,y0:y0,y1:y1+1,end:last,fp:fingerprint(ink,w,xs,y0,xe+1,y1+1).v});
  });
  return out;
}

/* symbol key: split into columns, then one entry per text row that starts with a small boxed symbol:
   the symbol's fingerprint (to match chart symbols) and where its text sits (to read the meaning) */
/* keys drawn as little boxes: erase the box outlines (square: two long horizontal runs and two vertical edges) so only the symbol is left */
function eraseBoxes(ink,w,h){
  var runs=[],x,y,rn,minL=Math.max(12,Math.round(0.1*w));
  for(y=0;y<h;y++){ rn=0; for(x=0;x<=w;x++){ if(x<w&&ink[y*w+x]) rn++; else { if(rn>=minL) runs.push([y,x-rn,x]); rn=0; } } }
  var done=[];
  for(var i=0;i<runs.length;i++) for(var j=i+1;j<runs.length;j++){ var a=runs[i],b=runs[j], wd=a[2]-a[1], dy=b[0]-a[0];
    if(dy<5||Math.abs(a[1]-b[1])>4||Math.abs(a[2]-b[2])>4||dy<0.75*wd||dy>1.3*wd) continue;
    var ok=0,tot=0; for(var yy=a[0];yy<=b[0];yy++){ tot++; var l=0; for(var xx=a[1]-1;xx<=a[1]+3;xx++) if(ink[yy*w+xx]) l=1; var r=0; for(xx=a[2]-4;xx<=a[2]+1;xx++) if(ink[yy*w+xx]) r=1; if(l&&r) ok++; }
    if(ok<0.85*tot) continue;
    for(yy=a[0]-2;yy<=b[0]+2;yy++) for(xx=a[1]-3;xx<=a[2]+3;xx++){ if(yy<0||yy>=h||xx<0||xx>=w) continue; if(yy<=a[0]+2||yy>=b[0]-2||xx<=a[1]+3||xx>=a[2]-3) ink[yy*w+xx]=0; }
    done.push([a[1],a[0],a[2],b[0]]); }
  return done;
}
function keyEntries(cv){
  var w=cv.width,h=cv.height,g=grayFromCanvas(cv),ink=binarize(g,w,h,0.92),x,y,occ=new Uint8Array(w);
  var boxes=eraseBoxes(ink,w,h), bo=[];
  boxes.sort(function(p,q){ return p[1]-q[1]||p[0]-q[0]; }).forEach(function(b){ if(!bo.some(function(c){ return Math.abs(c[0]-b[0])<6&&Math.abs(c[1]-b[1])<6; })) bo.push(b); });
  if(bo.length>=1){ // boxed key: each box is a symbol, its text sits to the right on the same height
    var outb=[];
    bo.forEach(function(b){ var nx=w; bo.forEach(function(c){ if(c[0]>b[2]&&c[1]<b[3]&&c[3]>b[1]&&c[0]<nx) nx=c[0]; });
      var ts=-1,te=-1,xx,yy; for(xx=b[2]+4;xx<nx-2;xx++){ var any=0; for(yy=b[1];yy<=b[3];yy++) if(ink[yy*w+xx]){ any=1; break; } if(any){ if(ts<0) ts=xx; te=xx; } }
      if(ts<0) return;
      outb.push({x0:b[0]+3,x1:b[2]-3,y0:b[1]+3,y1:b[3]-2,tx0:ts,tx1:te,end:te,fp:fingerprint(ink,w,b[0]+3,b[1]+3,b[2]-2,b[3]-2).v}); });
    if(outb.length) return outb; }
  // drop long rules and page edges (they glue columns and rows together)
  for(y=0;y<h;y++){ var rn=0; for(x=0;x<=w;x++){ if(x<w&&ink[y*w+x]) rn++; else { if(rn>=0.4*w) for(var q=x-rn;q<x;q++) ink[y*w+q]=0; rn=0; } } }
  for(y=0;y<h;y++){ var rs2=0; for(x=0;x<w;x++) rs2+=ink[y*w+x]; if(rs2>0.33*w||y<0.025*h||y>0.975*h) for(x=0;x<w;x++) ink[y*w+x]=0; }
  for(x=0;x<w;x++){ var cn=0; for(y=0;y<=h;y++){ if(y<h&&ink[y*w+x]) cn++; else { if(cn>=0.7*h) for(var q2=y-cn;q2<y;q2++) ink[q2*w+x]=0; cn=0; } } }
  for(y=0;y<h;y++) for(x=0;x<w;x++) if(ink[y*w+x]&&(y<2||y>h-3||x<2||x>w-3)) ink[y*w+x]=0;
  for(x=0;x<w;x++){ var cc0=0; for(y=0;y<h;y++) cc0+=ink[y*w+x]; if(cc0>3) occ[x]=1; }
  var xs=-1,xe=-1; for(x=0;x<w;x++) if(occ[x]){ if(xs<0) xs=x; xe=x; } if(xs<0) return [];
  var best=null,run=0,rs=0; for(x=xs;x<=xe+1;x++){ if(x<=xe&&!occ[x]){ if(!run) rs=x; run++; } else { if(run&&(!best||run>best.n)) best={s:rs,n:run}; run=0; } }
  var cols=[[xs,xe]]; if(best&&best.n>=Math.max(10,0.03*w)&&best.s>0.25*w&&best.s<0.75*w) cols=[[xs,best.s-1],[best.s+best.n,xe]];
  var out=[];
  cols.forEach(function(col){
    var rows=new Uint32Array(h); for(y=0;y<h;y++){ var s0=0; for(x=col[0];x<=col[1];x++) s0+=ink[y*w+x]; rows[y]=s0; }
    var bands=[],st=-1,gap=0; for(y=0;y<=h;y++){ var on=y<h&&rows[y]>1; if(on){ if(st<0) st=y; gap=0; } else if(st>=0){ gap++; if(gap>2||y===h){ bands.push([st,y-gap]); st=-1; gap=0; } } }
    bands.forEach(function(b){
      var y0=b[0],y1=b[1],bh=y1-y0+1; if(bh<7||bh>90) return;
      var cc=new Uint8Array(w); for(x=col[0];x<=col[1];x++) for(y=y0;y<=y1;y++) if(ink[y*w+x]){ cc[x]=1; break; }
      var gs=-1; for(x=col[0];x<=col[1];x++) if(cc[x]){ gs=x; break; } if(gs<0) return;
      var ge=gs,g0=0; for(x=gs;x<=col[1];x++){ if(cc[x]){ ge=x; g0=0; } else { g0++; if(g0>Math.max(2,0.3*bh)) break; } }
      var gw=ge-gs+1; if(gw<0.6*bh||gw>2.4*bh) return;
      var ts=-1; for(x=ge+1;x<=col[1];x++) if(cc[x]){ ts=x; break; } if(ts<0) return;
      var te=ts; for(x=col[1];x>ts;x--) if(cc[x]){ te=x; break; }
      out.push({x0:gs,x1:ge,y0:y0,y1:y1+1,tx0:ts,tx1:te,end:te,fp:fingerprint(ink,w,gs,y0,ge+1,y1+1).v});
    }); });
  return out;
}

/* if the full area fails, retry with margins trimmed: titles, captions and neighbours often sit at the edges */
function score(r){ return r&&r.ok?r.cells.length*(r.metrics.s4||0.5)*Math.min(1,(r.metrics.cov||0.5)/0.5):-1; }
function analyze(g,w,h,lenient){
  var res=analyzeCore(g,w,h,lenient);
  if(!lenient){ // whole picture: one quick pass only
    return res; }
  // user-marked region: try fainter line thresholds and trimmed margins, keep the best reading
  var best=res.ok?res:null, first=res, bs=score(res);
  if(!res.ok||(res.metrics.cov||1)<0.6){
    [0.92,0.96].forEach(function(kk){ var r2=analyzeCore(g,w,h,lenient,kk); if(r2.ok&&score(r2)>bs){ best=r2; bs=score(r2); best.sens=kk; } else if(!first.ok&&!best&&r2.reason&&false){ first=r2; } });
  }
  if(best) return best;
  if(['noGrid','irregular','blurry','noSymbols'].indexOf(res.reason)<0) return res;
  var tries=[[0,.16,0,0],[0,0,0,.16],[0,.16,0,.16],[.06,.06,.06,.06],[.12,.12,.12,.12],[.2,.2,.2,.2]];
  for(var i=0;i<tries.length;i++){
    var f=tries[i], ox=Math.round(f[0]*w), oy=Math.round(f[1]*h), nw=w-ox-Math.round(f[2]*w), nh=h-oy-Math.round(f[3]*h);
    if(nw<200||nh<200) continue;
    var sub=new Uint8ClampedArray(nw*nh); for(var y=0;y<nh;y++) for(var x=0;x<nw;x++) sub[y*nw+x]=g[(y+oy)*w+x+ox];
    var rr=analyzeCore(sub,nw,nh,lenient);
    if(rr.ok&&rr.metrics.s4>=0.3){
      rr.cells.forEach(function(q){ q.x0+=ox; q.x1+=ox; q.y0+=oy; q.y1+=oy; });
      rr.w=w; rr.h=h; rr.trimmed=true; return rr;
    }
  }
  return first;
}
/* Clean (digital/PDF/screenshot) pages: the chart is the biggest set of long straight grid lines. Returns {chart,key} boxes or null.
   Key = everything else with ink below or beside the chart (symbol list). Phone photos of paper have short, tilted lines and return null. */
function findBoxes(g,w,h){
  var ink=binarize(g,w,h,0.86), x,y,run,st, hr=new Int32Array(h), hs=new Int32Array(h), he=new Int32Array(h), vr=new Int32Array(w), vs=new Int32Array(w), ve=new Int32Array(w);
  for(y=0;y<h;y++){ run=0; for(x=0;x<=w;x++){ if(x<w&&ink[y*w+x]){ if(!run) st=x; run++; } else { if(run>hr[y]){ hr[y]=run; hs[y]=st; he[y]=x; } run=0; } } }
  for(x=0;x<w;x++){ run=0; for(y=0;y<=h;y++){ if(y<h&&ink[y*w+x]){ if(!run) st=y; run++; } else { if(run>vr[x]){ vr[x]=run; vs[x]=st; ve[x]=y; } run=0; } } }
  var mh=0, mv=0; for(y=0;y<h;y++) if(hr[y]>mh) mh=hr[y]; for(x=0;x<w;x++) if(vr[x]>mv) mv=vr[x];
  if(mh<0.15*Math.min(w,h)||mv<0.15*Math.min(w,h)) return null;
  var x0=1e9,x1=-1,y0=1e9,y1=-1,nh=0,nv=0,prev=-9;
  for(y=0;y<h;y++) if(hr[y]>=0.6*mh){ x0=Math.min(x0,hs[y]); x1=Math.max(x1,he[y]); if(y-prev>2) nh++; prev=y; }
  prev=-9; for(x=0;x<w;x++) if(vr[x]>=0.6*mv){ y0=Math.min(y0,vs[x]); y1=Math.max(y1,ve[x]); if(x-prev>2) nv++; prev=x; }
  if(nh<3||nv<3) return null;
  var pad=3; x0=Math.max(0,x0-pad); y0=Math.max(0,y0-pad); x1=Math.min(w,x1+pad); y1=Math.min(h,y1+pad);
  var chart={x:x0,y:y0,w:x1-x0,h:y1-y0};
  // key: ink outside the chart, below (preferred) or to the right; skip the row/column numbers hugging the chart
  function bbox(ax0,ay0,ax1,ay1){ var a=1e9,b=1e9,c=-1,d=-1; for(var j=ay0;j<ay1;j++) for(var i=ax0;i<ax1;i++) if(ink[j*w+i]){ if(i<a)a=i; if(i>c)c=i; if(j<b)b=j; if(j>d)d=j; } return c<0?null:{x:a,y:b,w:c-a+1,h:d-b+1}; }
  var gapY=Math.round((y1-y0)/Math.max(3,nh)*0.9), key=null;
  var below=bbox(0,Math.min(h,y1+gapY),w,h), right=bbox(Math.min(w,x1+Math.round((x1-x0)/Math.max(3,nv))),0,w,h);
  key=below&&below.w*below.h>=20*20?below:(right&&right.w*right.h>=20*20?right:null);
  if(key){ key.x=Math.max(0,key.x-4); key.y=Math.max(0,key.y-4); key.w=Math.min(w-key.x,key.w+8); key.h=Math.min(h-key.y,key.h+8); }
  return {chart:chart,key:key};
}
window.Reader={findBoxes:findBoxes,keyEntries:keyEntries,cellTop:function(v){var a=[];templates().forEach(function(t){a.push([t.id,Math.round(sdist(v,t.v)*100)/100]);});a.sort(function(x,y){return x[1]-y[1];});return a.slice(0,3);},binarize:binarize,grayFromCanvas:grayFromCanvas,analyze:analyze,estimateSkew:estimateSkew,legendLines:legendLines,dist:dist,sdist:sdist};

})();
