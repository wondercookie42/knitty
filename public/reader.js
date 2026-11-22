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
function analyze(g,w,h){
  var res={w:w,h:h,metrics:{}}, mn=Math.min(w,h);
  if(mn<200) return fail('tooSmall');
  var sharp=sharpness(g,w,h), con=contrast(g); res.metrics={sharp:sharp,contrast:con};
  if(con<45) return fail('lowContrast');
  var ink=binarize(g,w,h), L=Math.max(18,Math.round(0.03*mn)), sc=lineScores(ink,w,h,L);
  var py=peaks(sc.hs,0.25,L*3), px=peaks(sc.vs,0.25,L*3);
  var cy=fitLattice(py), cx=fitLattice(px), pr=pickPair(cx,cy), fx=pr&&pr.fx, fy=pr&&pr.fy;
  res.metrics.hLines=py.length; res.metrics.vLines=px.length;
  if(!fx||!fy) return fail(sharp<25?'blurry':(py.length+px.length<4?'noGrid':'irregular'));
  var xs=latticePositions(fx,w), ys=latticePositions(fy,h);
  if(xs.length>120||ys.length>160) return fail('irregular');
  var cells=[],r,c,band=Math.max(2,Math.round(0.07*Math.min(fx.m,fy.m)));
  for(r=0;r<ys.length-1;r++) for(c=0;c<xs.length-1;c++){
    var x0=xs[c],x1=xs[c+1],y0=ys[r],y1=ys[r+1],
      cov=[bandCov(ink,w,h,y0,x0+3,x1-3,true,band),bandCov(ink,w,h,y1,x0+3,x1-3,true,band),
           bandCov(ink,w,h,x0,y0+3,y1-3,false,band),bandCov(ink,w,h,x1,y0+3,y1-3,false,band)],
      sides=cov.filter(function(q){return q>=0.6;}).length;
    var fp0=sides>=3?fingerprint(ink,w,x0,y0,x1,y1):null;
    if(fp0&&(sides>=4||fp0.mean>=0.03)){ var fp=fp0;
      cells.push({r:r,c:c,x0:x0,y0:y0,x1:x1,y1:y1,v:fp.v,mean:fp.mean,kind:fp.mean<0.03?'blank':(fp.mean>0.5?'filled':'sym')}); } }
  cells=largestBlock(cells);
  res.grid={xs:xs,ys:ys,cw:fx.m,ch:fy.m}; res.cells=cells;
  if(cells.length<12) return fail('noGrid');
  var sym=cells.filter(function(q){return q.kind==='sym';}).length;
  if(sym<3) return fail('noSymbols');
  if(sharp<25) res.warn='blurry';
  // clusters
  var cls=[];
  cells.forEach(function(q){
    var key=q.kind, best=null;
    cls.forEach(function(k){ if(k.kind!==q.kind) return; var d=q.kind==='sym'?dist(q.v,k.v):0; if(d<0.30&&(!best||d<best.d)) best={d:d,k:k}; });
    if(best){ best.k.cells.push(q); q.cl=best.k.id; }
    else { var k={id:cls.length,kind:q.kind,v:q.v,cells:[q],rep:q}; cls.push(k); q.cl=k.id; } });
  cls.forEach(function(k){ k.sug=suggest(k); });
  res.clusters=cls; res.ok=true; return res;
  function fail(reason){ res.ok=false; res.reason=reason; return res; }
}
window.Reader={grayFromCanvas:grayFromCanvas,analyze:analyze};
})();
