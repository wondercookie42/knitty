const {chromium}=require('playwright');const http=require('http'),fs=require('fs');
const srv=http.createServer((q,r)=>{let f=require('path').join(__dirname,'../../public')+(q.url.split('?')[0]==='/'?'/index.html':q.url.split('?')[0]);
 try{const d=fs.readFileSync(f);r.setHeader('content-type',f.endsWith('.js')?'text/javascript':'text/html');r.end(d);}catch(e){r.statusCode=404;r.end();}}).listen(8801);
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1000,height:900}});
await p.route(/fonts\./,r=>r.abort());await p.goto('http://localhost:8801/reader.html');
const data='data:image/png;base64,'+fs.readFileSync(process.argv[2]).toString('base64');
console.log(await p.evaluate(async(d)=>{const im=new Image();im.src=d;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;c.getContext('2d').drawImage(im,0,0);
 return JSON.stringify([false,true].map(len=>{const r=Reader.analyze(Reader.grayFromCanvas(c),c.width,c.height,len);return {ok:r.ok,reason:r.reason,cells:r.cells&&r.cells.length,m:r.metrics}}))},data));
await b.close();srv.close();})();
