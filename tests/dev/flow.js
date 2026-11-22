const {chromium}=require('playwright');const http=require('http'),fs=require('fs');
const srv=http.createServer((q,r)=>{let f='/home/claude/knit-explainer/public'+(q.url.split('?')[0]==='/'?'/index.html':q.url.split('?')[0]);
 try{const d=fs.readFileSync(f);r.setHeader('content-type',f.endsWith('.js')?'text/javascript':f.endsWith('.html')?'text/html':'application/octet-stream');r.end(d);}catch(e){r.statusCode=404;r.end();}}).listen(8803);
const dir='/mnt/user-data/attachments/8420598d-bc4b-598d-b72c-1de2a193d32a/';
const j=JSON.parse(process.argv[2]);
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1100,height:900}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.route(/fonts\./,r=>r.abort());await p.goto('http://localhost:8803/reader.html');
await p.setInputFiles('#file',dir+j.f);await p.waitForTimeout(700);
const dims=await p.evaluate(()=>[document.getElementById('ov').width,document.getElementById('ov').height]);const bb=await p.locator('#ov').boundingBox();
const fx=v=>v/dims[0]*bb.width, fy=v=>v/dims[1]*bb.height;
await p.mouse.move(bb.x+fx(j.box[0]),bb.y+fy(j.box[1]));await p.mouse.down();await p.mouse.move(bb.x+fx(j.box[2]),bb.y+fy(j.box[3]),{steps:4});await p.mouse.up();
await p.locator('[data-nokey]').click();await p.locator('[data-read]').click();await p.waitForTimeout(1200);
const log=[];
for(let i=0;i<30;i++){ if(await p.locator('[data-fin]').count()){ await p.locator('[data-fin]').click(); await p.waitForTimeout(200); }
  if(await p.locator('[data-go]').count()) break;
  const txt=await p.locator('#side').innerText();
  if(await p.locator('[data-yes]').count()){ log.push('yes:'+await p.locator('[data-yes]').getAttribute('data-yes')); await p.locator('[data-yes]').click(); }
  else if(await p.locator('[data-set="knit"]').count()){ log.push('manual'); await p.locator('[data-set="knit"]').click(); }
  if(await p.locator('[data-nav="1"]').count()) await p.locator('[data-nav="1"]').click();
  await p.waitForTimeout(150);}
console.log('answers',log.join(' '));
console.log('labels',JSON.stringify(await p.evaluate(()=>__readerDebug().labels)));
await p.screenshot({path:'flow_'+j.name+'_done.png',fullPage:true});
if(await p.locator('[data-go]').count()){ await p.locator('[data-go]').click(); await p.waitForTimeout(1500);
  await p.screenshot({path:'flow_'+j.name+'_exp.png',fullPage:true}); console.log('explainer url',p.url()); }
console.log('errs',errs);await b.close();srv.close();})();
