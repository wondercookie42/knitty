const {chromium}=require('playwright');const http=require('http'),fs=require('fs');
const srv=http.createServer((q,r)=>{let f=require('path').join(__dirname,'../../public')+(q.url.split('?')[0]==='/'?'/index.html':q.url.split('?')[0]);
 try{const d=fs.readFileSync(f);r.setHeader('content-type',f.endsWith('.js')?'text/javascript':'text/html');r.end(d);}catch(e){r.statusCode=404;r.end();}}).listen(8796);
const dir=process.env.SAMPLES||require('path').join(__dirname,'../../samples')+'/';
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1000,height:900}});
await p.route(/fonts\./,r=>r.abort());await p.goto('http://localhost:8796/reader.html');
for(const f of fs.readdirSync(dir).filter(f=>/^(9b5f|f63a|f88f)/.test(f))){ await p.setInputFiles('#file',dir+f);await p.waitForTimeout(1200);
 console.log(f.slice(0,8),await p.evaluate(()=>{const x=__readerDebug().last;return x?(x.ok?'OK cells '+x.cells.length+' groups '+x.clusters.length+' cov '+x.metrics.cov+' s4 '+x.metrics.s4+' partial '+!!x.partial:'FAIL'):'MARK'}));}
await b.close();srv.close();})();
