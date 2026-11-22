import json,base64,io,sys
from PIL import Image, ImageDraw
d=json.load(open('cal.json'))
for name,v in d.items():
    if 'fail' in v: print(name,'FAIL',v['fail']); continue
    cl=v['clusters']; W=6; rows=(len(cl)+W-1)//W
    sheet=Image.new('RGB',(W*150,rows*80),'white'); dr=ImageDraw.Draw(sheet)
    for i,k in enumerate(cl):
        im=Image.open(io.BytesIO(base64.b64decode(k['img'].split(',')[1]))).resize((60,60))
        x=(i%W)*150; y=(i//W)*80; sheet.paste(im,(x+2,y+2))
        dr.text((x+66,y+4),'n=%d %s'%(k['n'],k['kind']),fill='black')
        for j,m in enumerate((k.get('top') or [])[:3]): dr.text((x+66,y+18+j*12),'%s/%s %.2f'%(m['id'],m['set'],m['d']),fill='blue' if j==0 else 'gray')
    sheet.save('cal_%s.png'%name); print(name,v['cells'],len(cl))
