"""Qalawun shopping list: A4 landscape, same brand as the white paper."""
import json

META = json.load(open('img/meta.json'))
MARK = ('<svg viewBox="0 0 32 32" class="mark"><rect width="32" height="32" rx="9" fill="#0a6788"/>'
        '<g stroke="#fff" stroke-width="2.2" stroke-linecap="round" fill="none"><path d="M7 11.5h11.5a3 3 0 1 0-3-3"/>'
        '<path d="M7 16.5h17"/><path d="M7 21.5h8.5a2.6 2.6 0 1 1-2.6 2.6"/></g><circle cx="23.5" cy="21.5" r="1.7" fill="#fff"/></svg>')


def im(name):
    return f'<img src="thumb/{name}.png">' if name else ''


def table(rows, subtotal=None, label='Subtotal'):
    out = ('<table class="buy"><colgroup><col style="width:58px"><col><col style="width:40px"><col style="width:80px">'
           '<col style="width:60px"><col style="width:60px"></colgroup>'
           '<tr><th></th><th>Item</th><th>Qty</th><th>Where</th><th>Each</th><th>Total</th></tr>')
    for pic, name, note, qty, where, each, tot in rows:
        out += (f'<tr><td class="pic">{im(pic)}</td><td><b>{name}</b><span>{note}</span></td><td>{qty}</td>'
                f'<td>{where}</td><td class="n">{each}</td><td class="n">{tot}</td></tr>')
    if subtotal:
        out += f'<tr class="sub"><td></td><td colspan="4">{label}</td><td class="n">{subtotal}</td></tr>'
    return out + '</table>'


uk = table([
    ('part_pms', 'PMS7003 with adapter board and cable', 'A fourth sensor, with the one adapter that ships with it.<sup>1</sup>', '1', 'The Pi Hut', '£22.00', '£22.00'),
    ('part_boost', 'Adafruit MiniBoost 5 V 1 A', 'Gives the particle counter its 5 V. One per box, one spare.<sup>2</sup>', '4', 'The Pi Hut', '£3.60', '£14.40'),
    (None, 'Postage', 'Standard UK delivery', '1', 'The Pi Hut', '£3.90', '£3.90'),
], '£40.30', 'Paid, on its way')

de = table([
    ('p_adapter', 'Soldered PMS7003 adapter (333058)', 'The sensor plugs straight in; 6 pins out. End of line, short supply: order soon.<sup>3</sup>', '3', 'Welectron', '€1.90', '€5.70'),
    ('p_jumpers', 'Jumper wires, female to female, 20 cm', 'For bench tests only. A strip of 40 to pull apart.<sup>4</sup>', '1', 'BerryBase', 'from €1.60', '€1.60'),
    (None, 'Postage in Germany', 'DHL or DPD to the visitor’s address', '1', 'Welectron', '€4.95', '€4.95'),
], '≈ €12.25', 'Subtotal, plus BerryBase postage')

lb = table([
    ('part_cell', '18650 cells, about 3,000 mAh', 'Flat top, e.g. Samsung 30Q or LG MJ1. We have 2: buy 2 more. Trusted shop; fakes are common.', '2', 'Tripoli', 'to find', ''),
    ('p_jst', 'JST-XH 4-pin plug pairs, with leads', 'One per sensor, so a broken sensor unplugs on the pole. Two per box, plus spares.', '8', 'Tripoli', 'to find', ''),
    ('p_header', '2.54 mm male header strip', 'Only if the T-Beams’ pins aren’t soldered on yet.', '2 strips', 'Tripoli', 'to find', ''),
    ('p_heatshrink', 'Silicone wire 26 AWG and heat-shrink', 'Sensor wires, and heat-shrink to cover the booster and every joint.', '1 set', 'Tripoli', 'to find', ''),
    ('p_solder', 'Solder 0.8 mm', 'If we have none.', '1', 'Tripoli', 'to find', ''),
    ('p_filament', 'PETG or ASA filament, light colour', 'For the boxes. Not PLA: it softens in the sun.', '1 kg', 'Tripoli', 'to find', ''),
])

have = ['LilyGO T-Beam V1.2, 868 MHz × 3', 'PMS7003 × 3 (sensor only, no adapter)', 'BME280 breakout × 3 (check it is not a BMP280)',
        'Solar panel 5 V 2 W, USB lead × 3', 'Cable glands PG7/PG9 × 3', '18650 cells × 2', 'Dragino DLOS8N gateway × 1',
        'IP67 boxes 130×90×25 mm × 3: too shallow for the T-Beam; keep as spares', 'TP4056 chargers × 3: not needed, the T-Beam charges']
hv = ''.join(f'<li>{x}</li>' for x in have)

src = [
    ('PMS7003 with adapter board, The Pi Hut', 'thepihut.com/products/pms7003-particulate-matter-sensor-with-adapter-board'),
    ('Adafruit MiniBoost 5 V 1 A, product 4654', 'adafruit.com/product/4654'),
    ('Soldered 333058 PMS7003 adapter, Welectron', 'welectron.com/Soldered-333058-PMS7003-sensor-adapter'),
    ('BerryBase jumper wires', 'berrybase.de/en/components/prototyping/jumper-cable/'),
    ('Backup if the German adapters sell out: AliExpress PMS7003 adapter with cable, about $2.40, 2 to 8 weeks', 'aliexpress.com, search “PMS7003 adapter”'),
]
sl = ''.join(f'<li><b>{a}</b><span>{b}</span></li>' for a, b in src)

css = '''@font-face{font-family:Readex;src:url(ReadexPro.ttf);font-weight:160 700}
@page{size:297mm 210mm;margin:0}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Readex;font-weight:340;color:#0c2231;font-size:10.5px;line-height:1.45;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.pg{width:1123px;height:794px;position:relative;overflow:hidden;padding:30px 38px;break-after:page;background:#fff}
.hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #d3dee6}
.brand{display:flex;align-items:center;gap:10px}.brand .mark{width:30px;height:30px}
.brand h1{font-size:24px;font-weight:560;letter-spacing:-.02em}
.brand span{color:#526b7a;font-size:11px;display:block;margin-top:2px}
.sum{text-align:right;font-size:11px;color:#3d5566}.sum b{color:#0c2231;font-weight:560}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:30px}
h2{font-size:15px;font-weight:560;display:flex;align-items:center;gap:8px;margin:2px 0 2px}
h2:before{content:"";width:8px;height:8px;border-radius:50%;background:#0a6788}
.sn{font-size:10px;color:#526b7a;margin-bottom:6px}
table.buy{width:100%;table-layout:fixed;border-collapse:collapse;margin-bottom:14px}
.buy th{text-align:left;font-weight:500;color:#526b7a;font-size:9.5px;padding:3px 6px;border-bottom:1.5px solid #0c2231}
.buy td{padding:3px 6px;border-bottom:1px solid #d3dee6;vertical-align:middle}
.buy td b{display:block;font-weight:560;font-size:11px}.buy td span{color:#526b7a;font-size:9.8px}
.buy td.pic{text-align:center;background:#eef4f8;border-bottom:2px solid #fff}
.buy td.pic img{max-width:44px;max-height:28px;display:block;margin:auto}
.buy td.n{text-align:right;white-space:nowrap}
.buy tr.sub td{font-weight:560;border-bottom:none;padding-top:7px}
.tip{background:#eef4f8;border-left:3px solid #0a6788;border-radius:0 8px 8px 0;padding:9px 12px;font-size:10.5px}
ul.have{list-style:none;columns:2;column-gap:20px}
ul.have li{padding:3px 0 3px 14px;position:relative;break-inside:avoid;font-size:10.3px}
ul.have li:before{content:"";position:absolute;left:1px;top:7px;width:7px;height:4px;border-left:1.6px solid #1A7340;border-bottom:1.6px solid #1A7340;transform:rotate(-45deg)}
.ft{position:absolute;left:38px;right:38px;bottom:16px;display:flex;justify-content:space-between;font-size:9px;color:#526b7a;border-top:1px solid #d3dee6;padding-top:7px}
.src li{list-style:decimal;margin-left:16px;padding:4px 0;border-bottom:1px solid #d3dee6;font-size:10.5px}
.src li span{display:block;color:#0a6788;font-size:9.8px}
h3{font-size:14px;font-weight:560;margin:4px 0 8px}
'''

p1 = f'''<section class="pg"><div class="hd"><div class="brand">{MARK}<div><h1>Shopping list</h1><span>Qalawun sensor boxes · first build of three, plus the gateway</span></div></div>
<div class="sum">UK order paid: <b>£40.30</b> · Germany: <b>about €12</b> · Lebanon: prices to find<br>28 November 2026</div></div>
<div class="cols"><div>
<h2>Ordered in the UK</h2><div class="sn">The Pi Hut. Paid, on its way. Prices include UK VAT.</div>{uk}
<h2>Order in Germany</h2><div class="sn">Delivered to the visitor in Germany, then carried to Tripoli. Prices from the shops’ sites, 23 November 2026.</div>{de}
<div class="tip"><b>Why three adapters:</b> our three PMS7003s came without one. The Pi Hut bundle brings its own, so three leaves a spare. No PMS7003 adapter was found for sale in Turkey.</div>
</div><div>
<h2>Buy in Lebanon</h2><div class="sn">Common parts. No perfboard: the sensors wire straight to the T-Beam.</div>{lb}
<h2>Already have, don’t buy</h2><div class="sn">From the February invoices, and the October bench test.</div><ul class="have">{hv}</ul>
</div></div>
<div class="ft"><span>Qalawun · TripoliLabs</span><span><sup>n</sup> = source on page 2</span><span>1 / 2</span></div></section>'''

p2 = f'''<section class="pg"><div class="hd"><div class="brand">{MARK}<div><h1>Sources and checks</h1><span>Qalawun shopping list</span></div></div></div>
<div class="cols"><div><h3>Sources</h3><ol class="src">{sl}</ol></div>
<div><h3>Before paying</h3><ul class="have">
<li>Cells: check the label and weight. A real 3,000 mAh 18650 weighs about 45 to 50 g; a light one is a fake.</li>
<li>Filament: PETG or ASA, not PLA.</li>
<li>Adapters: the sensor’s plug is 1.27 mm, two rows of five. Check the photo of any other adapter.</li>
<li>JST plugs: get the XH type (2.5 mm pitch) with crimped leads, so no crimp tool is needed.</li></ul>
<h3 style="margin-top:16px">Images</h3><p style="color:#3d5566">All pictures are renders of our own 3D model, not product photos. The T-Beam and the MiniBoost come from their makers’ CAD models.</p></div></div>
<div class="ft"><span>Qalawun · TripoliLabs</span><span></span><span>2 / 2</span></div></section>'''

open('shopping.html', 'w').write(f'<!doctype html><html><head><meta charset="utf-8"><title>Qalawun shopping list</title><style>{css}</style></head><body>{p1}{p2}</body></html>')
print('ok')
