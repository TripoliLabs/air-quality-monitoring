import json, glob, os
from PIL import Image
M = json.load(open('img/meta.json'))
for f in glob.glob('../r2/*.png'):
    n = os.path.basename(f)[:-4]
    if n.startswith(('lt_', 'sheet', 'anim', 'about', 'al', 'bd', 'parts_sheet', 'scr', 's1', 'scrub')):
        continue
    im = Image.open(f)
    if im.mode != 'RGBA':
        continue
    j = f[:-4] + '.json'
    meta = json.load(open(j)) if os.path.exists(j) else {'anchors': {}}
    bb = im.getbbox(); pad = 14
    if n == 'node_pole':
        bb = (max(bb[0] - pad, 0), 0, min(bb[2] + pad, im.width), im.height)
    else:
        bb = (max(bb[0] - pad, 0), max(bb[1] - pad, 0), min(bb[2] + pad, im.width), min(bb[3] + pad, im.height))
    c = im.crop(bb)
    anchors = {k: [v[0] - bb[0], v[1] - bb[1]] for k, v in meta['anchors'].items()}
    lim = 1300
    if max(c.size) > lim and n != 'node_pole':
        s = lim / max(c.size); c = c.resize((round(c.width * s), round(c.height * s)), Image.LANCZOS)
        anchors = {k: [v[0] * s, v[1] * s] for k, v in anchors.items()}
    if n == 'node_pole':
        s = 1300 / c.height * 3; c = c.resize((round(c.width * s), round(c.height * s)), Image.LANCZOS) if s < 1 else c
    c.save(f'img/{n}.png', optimize=True)
    M[n] = {'w': c.width, 'h': c.height, 'anchors': anchors}
json.dump(M, open('img/meta.json', 'w'))
for f in glob.glob('img/*.png'):
    im = Image.open(f); im.thumbnail((240, 240)); im.save('thumb/' + os.path.basename(f), optimize=True)
print('prepped')
