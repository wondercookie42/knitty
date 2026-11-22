/* Reads the MEANING of a symbol-key line from its (OCR'd) text. Phrase patterns per language, checked most specific first.
   Fuzzy matching tolerates OCR slips (a letter or two). Returns {label, phrase} or null. */
(function(){
function norm(s){ return (s||'').toLowerCase().replace(/ä/g,'a').replace(/ö/g,'o').replace(/ü/g,'u').replace(/ß/g,'ss').replace(/ё/g,'е')
  .replace(/[|!¦\\]/g,'l').replace(/[^a-zа-я0-9]+/g,''); }
// smallest edit distance between needle and any substring of hay (Sellers)
function fuzzy(hay,needle,maxErr){
  var m=needle.length, prev=new Array(m+1), cur=new Array(m+1), i, j, best=m;
  for(i=0;i<=m;i++) prev[i]=i;
  for(j=1;j<=hay.length;j++){ cur[0]=0;
    for(i=1;i<=m;i++){ var sub=needle[i-1]===hay[j-1]?0:((/[0-9]/.test(needle[i-1])||/[0-9]/.test(hay[j-1]))?3:1); cur[i]=Math.min(prev[i]+(/[0-9]/.test(hay[j-1])?3:1),cur[i-1]+(/[0-9]/.test(needle[i-1])?3:1),prev[i-1]+sub); }
    if(cur[m]<best) best=cur[m]; var t=prev; prev=cur; cur=t; }
  return best<=maxErr?best:-1;
}
// [label, phrase(s)] most specific first. Phrases are written in plain letters (normalised the same way).
var RULES=[
 ['sk2p',   ['dopp uberz abn','doppelt uberzogen','dopp uberzogen','sk2p','s2kp','sl1 k2tog psso','центральная убавка','снять 1 две вместе протянуть']],
 ['k3tog',  ['3 m re zus','3 m zus','3 re zus','k3tog','три вместе','3 вместе']],
 ['skp',    ['uberz abn','uberzogen zusstr','2 m uberzogen','1 m abh','ssk','skp','снять провязать протянуть','с наклоном влево','2 m re verschr zus','2 re verschr zus']],
 ['k2tog',  ['2 m re zusstr','2 m re zus','2 re zus','2 m zus','2 stitches together','k2tog','две вместе лицевой','2 вместе лицевой','две петли вместе']],
 ['ktbl',   ['1 m re verschr','re verschr','k tbl','ktbl','knit through back','лицевая скрещенная','лицевая за заднюю']],
 ['yo',     ['umschlag','1 u','iu','yarn over','yo','накид']],
 ['inc3',   ['aus 1 m 3 m','1 m 3 m herausstr','in 3 m','1 into 3','one into three','из одной три','одна в три']],
 ['nostitch',['ohne strickbedeutung','keine bedeutung','leeres kastchen','no stitch','не вяжется','нет петли','пустая клетка']],
 ['purl',   ['1 m li','1 m links','m li','purl','изнаночная','изн']],
 ['knit',   ['1 m re','mere','1 m rechts','1 re','m re','knit','лицевая','лиц']]
];
var PREP=RULES.map(function(r){ return [r[0],r[1].map(function(p){ return norm(p); })]; });
function parse(text){
  var t=norm(text); if(t.length<2) return null;
  var best=null;
  for(var i=0;i<PREP.length;i++){ var lab=PREP[i][0], ps=PREP[i][1];
    for(var j=0;j<ps.length;j++){ var p=ps[j], tol=p.length<=3?0:(p.length<=6?1:2); // short phrases must match exactly
      var e=fuzzy(t,p,tol); if(e>=0){ var rank=i*100+e; if(!best||rank<best.rank) best={rank:rank,label:lab,phrase:p}; break; } }
    if(best&&best.rank<(i+1)*100) break; }  // first rule that matched wins (rules ordered by specificity)
  return best?{label:best.label,phrase:best.phrase}:null;
}
window.KeyDict={parse:parse,norm:norm};
if(typeof module!=='undefined') module.exports=window.KeyDict;
})();
