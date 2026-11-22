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
function binarize(g,w,h){
  var r=Math.max(6,Math.round(Math.min(w,h)/60)), W=w+1, I=new Float64Array(W*(h+1)), x,y;
  for(y=0;y<h;y++){ var row=0; for(x=0;x<w;x++){ row+=g[y*w+x]; I[(y+1)*W+x+1]=I[y*W+x+1]+row; } }
  var ink=new Uint8Array(w*h);
  for(y=0;y<h;y++){ var y0=Math.max(0,y-r),y1=Math.min(h,y+r+1);
    for(x=0;x<w;x++){ var x0=Math.max(0,x-r),x1=Math.min(w,x+r+1);
      var sum=I[y1*W+x1]-I[y0*W+x1]-I[y1*W+x0]+I[y0*W+x0], mean=sum/((x1-x0)*(y1-y0));
      var v=g[y*w+x]; ink[y*w+x]=(v<mean*0.86-3||v<70)?1:0; } }
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
function fitLattice(objs){
  if(objs.length<5) return [];
  var pos=objs.map(function(o){return o.p;}), wt=objs.map(function(o){return o.w;}), i;
  var gaps=[]; for(i=0;i<pos.length-1;i++) gaps.push(pos[i+1]-pos[i]);
  var cands=gaps.filter(function(g){return g>=8;}), found=[];
  cands.forEach(function(m0){ pos.forEach(function(anchor){
    var a=anchor,m=m0,pts=[],it,k,p,wsum=0;
    for(it=0;it<4;it++){ pts=[]; wsum=0;
      for(i=0;i<pos.length;i++){ p=pos[i]; k=Math.round((p-a)/m); if(Math.abs(p-(a+k*m))<0.16*m){ pts.push([k,p]); wsum+=wt[i]; } }
      if(pts.length<4) return; var f=ls(pts); if(!f||f.m<8) return; a=f.a; m=f.m; }
    var ks=pts.map(function(q){return q[0];}), span=Math.max.apply(null,ks)-Math.min.apply(null,ks);
    if(pts.length>=5&&span>=4) found.push({a:a,m:m,n:pts.length,sc:wsum}); }); });
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
function templates(){
  if(TPL) return TPL;
  var defs={
    knit:function(c){c.moveTo(7,1.5);c.lineTo(7,12.5);},
    purl:function(c){c.moveTo(1.5,7);c.lineTo(12.5,7);},
    yo:function(c){c.arc(7,7,4.3,0,6.283);},
    k2tog:function(c){c.moveTo(2,12);c.lineTo(12,2);},
    skp:function(c){c.moveTo(2,2);c.lineTo(12,12);},
    slip:function(c){c.moveTo(2,2);c.lineTo(7,12);c.lineTo(12,2);}
  };
  TPL={};
  Object.keys(defs).forEach(function(k){
    var cv=document.createElement('canvas'); cv.width=cv.height=N; var c=cv.getContext('2d');
    c.fillStyle='#fff'; c.fillRect(0,0,N,N); c.strokeStyle='#000'; c.lineWidth=1.6; c.beginPath(); defs[k](c); c.stroke();
    var d=c.getImageData(0,0,N,N).data, v=new Float32Array(N*N); for(var i=0;i<N*N;i++) v[i]=1-d[4*i]/255;
    TPL[k]=blur(v); });
  return TPL;
}
function suggest(cl){
  if(cl.kind==='blank') return {label:'blank',score:1};
  if(cl.kind==='filled') return {label:'nostitch',score:1};
  var t=templates(),best=null;
  Object.keys(t).forEach(function(k){ var d=dist(cl.v,t[k]); if(!best||d<best.d) best={d:d,label:k}; });
  return best&&best.d<0.62?{label:best.label,score:1-best.d}:{label:'',score:0};
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
function analyzeCore(g,w,h,lenient){
  var res={w:w,h:h,metrics:{}}, mn=Math.min(w,h);
  if(mn<200) return fail('tooSmall');
  var sharp=sharpness(g,w,h), con=contrast(g); res.metrics={sharp:sharp,contrast:con};
  if(con<45) return fail('lowContrast');
  var ink=binarize(g,w,h), L=Math.max(18,Math.round(0.03*mn)), sc=lineScores(ink,w,h,L);
  var py=peaks(sc.hs,0.25,L*3), px=peaks(sc.vs,0.25,L*3);
  function withDouble(list){ var o=list.slice(); list.forEach(function(f){ o.push({a:f.a,m:f.m*2,n:f.n/2,sc:f.sc*0.9}); o.push({a:f.a+f.m,m:f.m*2,n:f.n/2,sc:f.sc*0.9}); }); return o; }
  var cy=withDouble(fitLattice(py)), cx=withDouble(fitLattice(px));
  res.metrics.hLines=py.length; res.metrics.vLines=px.length;
  if(!cx.length||!cy.length) return fail(sharp<25?'blurry':(py.length+px.length<4?'noGrid':'irregular'));
  var mxx=Math.max.apply(null,cx.map(function(f){return f.sc;})), myy=Math.max.apply(null,cy.map(function(f){return f.sc;})), pairs=[];
  cx.forEach(function(x){ cy.forEach(function(y){ var asp=Math.abs(Math.log(x.m/y.m)); if(asp>0.3) return; pairs.push({fx:x,fy:y,sc:x.sc/mxx+y.sc/myy-4*Math.max(0,asp-0.12)}); }); });
  pairs.sort(function(a,b){return b.sc-a.sc;});
  if(!pairs.length) return fail('irregular');
  var cells=null, fx=null, fy=null, xs, ys, why='irregular', pi;
  for(pi=0;pi<Math.min(10,pairs.length);pi++){
    fx=pairs[pi].fx; fy=pairs[pi].fy;
    xs=latticePositions(fx,w); ys=latticePositions(fy,h);
    if(xs.length>120||ys.length>160){ continue; }
    var cs=[],r,c,band=Math.max(2,Math.round(0.07*Math.min(fx.m,fy.m)));
    for(r=0;r<ys.length-1;r++) for(c=0;c<xs.length-1;c++){
      var x0=xs[c],x1=xs[c+1],y0=ys[r],y1=ys[r+1],
        cov=[bandCov(ink,w,h,y0,x0+3,x1-3,true,band),bandCov(ink,w,h,y1,x0+3,x1-3,true,band),
             bandCov(ink,w,h,x0,y0+3,y1-3,false,band),bandCov(ink,w,h,x1,y0+3,y1-3,false,band)],
        sides=cov.filter(function(q){return q>=0.6;}).length;
      var fp0=sides>=3?fingerprint(ink,w,x0,y0,x1,y1):null;
      if(fp0&&(sides>=4||fp0.mean>=0.03)){ var fp=fp0;
        cs.push({s:sides,r:r,c:c,x0:x0,y0:y0,x1:x1,y1:y1,v:fp.v,mean:fp.mean,kind:fp.mean<0.03?'blank':(fp.mean>0.5?'filled':'sym')}); } }
    cs=largestBlock(cs);
    if(cs.length<(lenient?12:24)){ why='noGrid'; continue; }
    var s4=cs.filter(function(q){return q.s>=4;}).length/cs.length;
    if(s4<(lenient?0.3:0.5)){ why='irregular'; continue; }
    cells=cs; res.metrics.s4=Math.round(s4*100)/100; res.metrics.cw=Math.round(fx.m*10)/10; res.metrics.ch=Math.round(fy.m*10)/10; break;
  }
  if(!cells) return fail(why);
  res.grid={xs:xs,ys:ys,cw:fx.m,ch:fy.m}; res.cells=cells;
  var sym=cells.filter(function(q){return q.kind==='sym';}).length;
  if(sym<3) return fail('noSymbols');
  if(sharp<25) res.warn='blurry';
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
    cls.forEach(function(o){ if(o===k||o.kind!=='sym'||o.cells.length<=2) return; var d=sdist(k.v,o.v); if(d<0.5&&(!best||d<best.d)) best={d:d,o:o}; });
    if(best){ k.cells.forEach(function(q){ q.cl=best.o.id; best.o.cells.push(q); }); cls.splice(cls.indexOf(k),1); } });
  var merged=true;
  while(merged){ merged=false;
    for(var ia=0;ia<cls.length&&!merged;ia++) for(var ib=ia+1;ib<cls.length&&!merged;ib++){
      var A=cls[ia],B=cls[ib]; if(A.kind!=='sym'||B.kind!=='sym') continue;
      if(sdist(A.v,B.v)<0.12){ var big=A.cells.length>=B.cells.length?A:B, small=big===A?B:A; small.cells.forEach(function(q){ q.cl=big.id; big.cells.push(q); }); cls.splice(cls.indexOf(small),1); merged=true; } } }
  cls.sort(function(a,b){return b.cells.length-a.cells.length;});
  cls.forEach(function(k){ k.sug=suggest(k); });
  var symGroups=cls.filter(function(k){return k.kind==='sym';}).length;
  res.metrics.groups=symGroups; if(symGroups>(lenient?30:20)) return fail('photo');
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

/* if the full area fails, retry with margins trimmed: titles, captions and neighbours often sit at the edges */
function analyze(g,w,h,lenient){
  var res=analyzeCore(g,w,h,lenient);
  if(res.ok||['noGrid','irregular','blurry','noSymbols'].indexOf(res.reason)<0) return res;
  var tries=[[0,.16,0,0],[0,0,0,.16],[0,.16,0,.16],[.06,.06,.06,.06],[.12,.12,.12,.12],[.2,.2,.2,.2]], first=res;
  for(var i=0;i<tries.length;i++){
    var f=tries[i], ox=Math.round(f[0]*w), oy=Math.round(f[1]*h), nw=w-ox-Math.round(f[2]*w), nh=h-oy-Math.round(f[3]*h);
    if(nw<200||nh<200) continue;
    var sub=new Uint8ClampedArray(nw*nh); for(var y=0;y<nh;y++) for(var x=0;x<nw;x++) sub[y*nw+x]=g[(y+oy)*w+x+ox];
    var rr=analyzeCore(sub,nw,nh,lenient);
    if(rr.ok&&rr.metrics.s4>=(lenient?0.3:0.6)){
      rr.cells.forEach(function(q){ q.x0+=ox; q.x1+=ox; q.y0+=oy; q.y1+=oy; });
      rr.w=w; rr.h=h; rr.trimmed=true; return rr;
    }
  }
  return first;
}
window.Reader={grayFromCanvas:grayFromCanvas,analyze:analyze,estimateSkew:estimateSkew,legendLines:legendLines,dist:dist,sdist:sdist};

})();
