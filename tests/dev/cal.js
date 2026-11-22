const {chromium}=require('playwright');const http=require('http'),fs=require('fs');
const srv=http.createServer((q,r)=>{let f='/home/claude/knit-explainer/public'+(q.url.split('?')[0]==='/'?'/index.html':q.url.split('?')[0]);
 try{const d=fs.readFileSync(f);r.setHeader('content-type',f.endsWith('.js')?'text/javascript':'text/html');r.end(d);}catch(e){r.statusCode=404;r.end();}}).listen(8802);
const dir='/mnt/user-data/attachments/8420598d-bc4b-598d-b72c-1de2a193d32a/';
const jobs=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1000,height:900}});
await p.route(/fonts\./,r=>r.abort());await p.goto('http://localhost:8802/reader.html');
const out={};
for(const j of jobs){ await p.setInputFiles('#file',dir+j.f);await p.waitForTimeout(700);
 if(await p.locator('#ov').isVisible()){ const dims=await p.evaluate(()=>[ov.width,ov.height]).catch(()=>null)||await p.evaluate(()=>[document.getElementById('ov').width,document.getElementById('ov').height]); const bb=await p.locator('#ov').boundingBox();
  const fx=v=>v/dims[0]*bb.width, fy=v=>v/dims[1]*bb.height;
  await p.mouse.move(bb.x+fx(j.box[0]),bb.y+fy(j.box[1]));await p.mouse.down();await p.mouse.move(bb.x+fx(j.box[2]),bb.y+fy(j.box[3]),{steps:4});await p.mouse.up();
  await p.locator('[data-nokey]').click().catch(()=>{});
  await p.locator('[data-read]').click();await p.waitForTimeout(1200);}
 out[j.name]=await p.evaluate(()=>{const d=__readerDebug(),x=d.last;if(!x||!x.ok) return {fail:d.failReason};
  const cv=document.getElementById('cv');
  return {cells:x.cells.length,clusters:x.clusters.map(k=>{const r=k.rep,c=document.createElement('canvas');c.width=c.height=56;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,56,56);g.drawImage(cv,r.x0,r.y0,r.x1-r.x0,r.y1-r.y0,0,0,56,56);return {id:k.id,kind:k.kind,n:k.cells.length,top:k.top,sug:k.sug,img:c.toDataURL('image/png')}})}});
 if(await p.locator('#markAgain').isVisible()) await p.locator('#markAgain').click();}
fs.writeFileSync('cal.json',JSON.stringify(out));
await b.close();srv.close();})();
