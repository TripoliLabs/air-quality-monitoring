import json,subprocess,sys
CH=['The problem','Design goals','How the system works','The sensor box','Power','Firmware','Server, storage and open data','Data quality and limits','Deployment and roadmap','Status: verified and still to check','Open by design','References']
n=int(subprocess.check_output(['pdfinfo',sys.argv[1]]).decode().split('Pages:')[1].split()[0])
out={}
for p in range(3,n+1):
    t=subprocess.check_output(['pdftotext','-f',str(p),'-l',str(p),'-layout',sys.argv[1],'-']).decode()
    lines=[l.strip() for l in t.splitlines()]
    for i,c in enumerate(CH):
        if c in out: continue
        num=str(i+1)
        import re
        for l in lines:
            if re.fullmatch(re.escape(num)+r'\s+'+re.escape(c), l) or (c=='References' and l=='References'):
                out[c]=p;break
json.dump(out,open('pages.json','w'));print(out)
