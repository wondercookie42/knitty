// Fails if any language is missing keys (or has extras) compared with English.
const fs=require('fs');
const html=fs.readFileSync(__dirname+'/../public/index.html','utf8');
const blk=html.split('/*STR_START*/')[1].split('/*STR_END*/')[0];
const STR=eval('(function(){'+blk+';return STR;})()');
const keys=(o,p='')=>Object.entries(o).flatMap(([k,v])=>{const q=p?p+'.'+k:k;
  return Array.isArray(v)?[q+'['+v.length+']']:v&&typeof v==='object'?keys(v,q):[q];});
const base=keys(STR.en);let bad=0;
for(const l of Object.keys(STR)){ if(l==='en')continue;
  const k=keys(STR[l]);const miss=base.filter(x=>!k.includes(x)),extra=k.filter(x=>!base.includes(x));
  console.log(l,'missing',miss.length,'extra',extra.length);if(miss.length||extra.length){bad=1;console.log(miss,extra);}}
process.exit(bad);
