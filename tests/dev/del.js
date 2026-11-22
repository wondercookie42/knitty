// Draw chart + text boxes, then delete them with the per-box button and check state.
const {chromium}=require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const srv=http.createServer((q,r)=>{let f=path.join(__dirname,'../../public')+(q.url.split('?')[0]==='/'?'/index.html':q.url.split('?')[0]);
 try{const d=fs.readFileSync(f);r.setHeader('content-type',f.endsWith('.js')?'text/javascript':'text/html');r.end(d);}catch(e){r.statusCode=404;r.end();}}).listen(8803);
const img=process.argv[2]||path.join(__dirname,'../../samples/key5.png');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1000,height:900}});
await p.route(/fonts\./,r=>r.abort());await p.goto('http://localhost:8803/reader.html');
await p.setInputFiles('#file',img);await p.waitForTimeout(800);
const bb=await p.locator('#ov').boundingBox();
async function drag(x0,y0,x1,y1){await p.mouse.move(bb.x+bb.width*x0,bb.y+bb.height*y0);await p.mouse.down();await p.mouse.move(bb.x+bb.width*x1,bb.y+bb.height*y1,{steps:4});await p.mouse.up();}
const st=()=>p.evaluate(()=>[...document.querySelectorAll('.tool')].map(t=>t.querySelector('small').textContent).join('|')+' del-buttons='+document.querySelectorAll('[data-del]').length);
await p.locator('[data-tool=chart]').click();await drag(.1,.1,.5,.4);console.log('after chart  :',await st());
await p.locator('[data-tool=text]').click();await drag(.1,.5,.6,.9);console.log('after text   :',await st());
await p.locator('[data-del=chart]').click();console.log('del chart    :',await st());
const dis=await p.locator('[data-read]').isDisabled();console.log('read disabled:',dis);
await p.locator('[data-del=text]').click();console.log('del text     :',await st());
await p.screenshot({path:'/tmp/del.png'});
const ok=(await st()).endsWith('del-buttons=0')&&dis; console.log(ok?'PASS':'FAIL');
await b.close();srv.close();process.exit(ok?0:1);})();
