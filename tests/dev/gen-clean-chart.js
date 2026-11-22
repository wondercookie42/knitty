// render a clean "as sold" chart from the MIT symbol SVGs (US set), with row/col numbers and a key
const {chromium}=require('playwright'),fs=require('fs');
const S=process.env.SYMS||'./knitting_symbols/'; // git clone https://github.com/marnen/knitting_symbols (MIT)
const dir=fs.existsSync(S+'US')?S+'US/':S+'assets/';
const names=fs.readdirSync(S).includes('US')?null:null;
const all=require('child_process').execSync("find "+S+" -name '*.svg'").toString().trim().split('\n');
const f=n=>all.find(p=>p.endsWith('/'+n+'.svg'));
const rows=[ // chart rows top->bottom
 ['knit','knit','yarnover','decreaseright','knit','knit','knit','decreaseleft','yarnover','knit','knit'],
 ['purl','purl','purl','purl','purl','purl','purl','purl','purl','purl','purl'],
 ['knit','yarnover','decreaseright','knit','knit','knit','knit','knit','decreaseleft','yarnover','knit'],
 ['purl','purl','purl','purl','purl','purl','purl','purl','purl','purl','purl'],
 ['knit','knit','knit','yarnover','decreaseright','knit','decreaseleft','yarnover','knit','knit','knit'],
 ['purl','purl','purl','purl','purl','purl','purl','purl','purl','purl','purl']];
const used=[...new Set(rows.flat())];
const svg=n=>'data:image/svg+xml;base64,'+fs.readFileSync(f(n)).toString('base64');
const C=+process.argv[2]||44;
let h='<body style="margin:30px;background:#fff;font:14px Arial"><div style="display:inline-block">';
h+='<table style="border-collapse:collapse">';
rows.forEach((r,i)=>{h+='<tr>'+r.map(n=>`<td style="width:${C}px;height:${C}px;border:1.5px solid #000;padding:0;text-align:center"><img src="${svg(n)}" style="width:${C-8}px;height:${C-8}px;object-fit:contain"></td>`).join('')+`<td style="padding-left:8px">${rows.length-i}</td></tr>`;});
h+='<tr>'+rows[0].map((_,i)=>`<td style="text-align:center">${rows[0].length-i}</td>`).join('')+'</tr></table>';
h+='<div style="margin-top:20px">'+used.map(n=>`<div style="display:flex;align-items:center;gap:8px;margin:4px 0"><span style="width:${C}px;height:${C}px;border:1.5px solid #000;display:inline-flex;justify-content:center;align-items:center"><img src="${svg(n)}" style="width:${C-8}px;height:${C-8}px"></span> = ${n}</div>`).join('')+'</div></div></body>';
fs.writeFileSync('gen.html',h);
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:700,height:900}});await p.goto('file://'+process.cwd()+'/gen.html');await p.screenshot({path:'gen.png',fullPage:true});await b.close();})();
