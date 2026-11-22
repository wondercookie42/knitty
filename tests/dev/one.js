const {chromium}=require('playwright');const http=require('http'),fs=require('fs');
const srv=http.createServer((q,r)=>{let f='/home/claude/knit-explainer/public'+(q.url.split('?')[0]==='/'?'/index.html':q.url.split('?')[0]);
 try{const d=fs.readFileSync(f);r.setHeader('content-type',f.endsWith('.js')?'text/javascript':'text/html');r.end(d);}catch(e){r.statusCode=404;r.end();}}).listen(8798);
const dir='/mnt/user-data/attachments/8420598d-bc4b-598d-b72c-1de2a193d32a/';
const jobs=JSON.parse(process.argv[2]); // [{f,box:[x0,y0,x1,y1] px,name}]
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1000,height:900}});
await p.route(/fonts\./,r=>r.abort());await p.goto('http://localhost:8798/reader.html');
for(const j of jobs){ await p.setInputFiles('#file',dir+j.f);await p.waitForTimeout(800);
 if(!(await p.locator('#ov').isVisible())){ console.log(j.name,'auto-read'); }
 else{ const dims=await p.evaluate(()=>[document.getElementById('ov').width,document.getElementById('ov').height]); const bb=await p.locator('#ov').boundingBox();
  const fx=v=>v/dims[0]*bb.width, fy=v=>v/dims[1]*bb.height;
  await p.mouse.move(bb.x+fx(j.box[0]),bb.y+fy(j.box[1]));await p.mouse.down();await p.mouse.move(bb.x+fx(j.box[2]),bb.y+fy(j.box[3]),{steps:4});await p.mouse.up();
  await p.locator('[data-nokey]').click().catch(()=>{});
  await p.locator('[data-read]').click();await p.waitForTimeout(1200);}
 console.log(j.name,await p.evaluate(()=>{const x=__readerDebug().last;return x?(x.ok?'OK cells '+x.cells.length+' groups '+x.clusters.length+' cov '+x.metrics.cov+' s4 '+x.metrics.s4+' cw '+x.metrics.cw:'FAIL'):'fail '+__readerDebug().failReason}));
 await p.screenshot({path:'one_'+j.name+'.png'});
 if(await p.locator('#markAgain').isVisible()) await p.locator('#markAgain').click();}
await b.close();srv.close();})();
