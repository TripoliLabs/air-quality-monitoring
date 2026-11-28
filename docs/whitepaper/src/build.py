"""Qalawun white paper: A4, flowing HTML printed to PDF by headless Chrome.

Brand follows the dashboard (apps/dashboard/src/style.css): Readex Pro, deep-sea
ink #0c2231, teal #0a6788, sea-haze #eef4f8, lines #d3dee6.
"""
import json, math
from PIL import Image, ImageOps, ImageChops, ImageFilter, ImageEnhance

META = json.load(open('img/meta.json'))
MAP = json.load(open('../map/map.json'))
DATE = '28 November 2026'

# ------------------------------------------------------------------ map in brand colours
def brand_map():
    m = json.load(open('../map/meta.json'))
    z = m['z']; X = range(*m['X']); Y = range(*m['Y'])
    M = Image.new('RGB', (256 * len(X), 256 * len(Y)))
    for i, x in enumerate(X):
        for j, y in enumerate(Y):
            M.paste(Image.open(f'../map/tiles/{z}_{x}_{y}.png').convert('RGB'), (i * 256, j * 256))
    r, g, b = M.split()
    sea = ImageChops.subtract(b, r).point(lambda v: 255 if v > 30 else 0).filter(ImageFilter.MedianFilter(5))
    gr = ImageEnhance.Contrast(ImageOps.grayscale(M)).enhance(1.3)
    land = ImageOps.colorize(gr, black=(61, 85, 102), white=(250, 252, 253))
    out = Image.composite(Image.new('RGB', M.size, (207, 224, 234)), land, sea)
    out.save('img/map_brand.png')
brand_map()

# ------------------------------------------------------------------ helpers
FIG = [0]


def fig(body, caption, wide=False):
    FIG[0] += 1
    return (f'<figure class="{"wide" if wide else ""}">{body}'
            f'<figcaption><b>Figure {FIG[0]}.</b> {caption}</figcaption></figure>')


def ref(n):
    return f'<sup class="ref">[{n}]</sup>'


def img(name, w, style=''):
    m = META[name]
    ext = 'jpg' if name.startswith('dash') else 'png'
    return f'<img src="img/{name}.{ext}" style="width:{w}px;height:{m["h"] * w / m["w"]:.0f}px;{style}">'


def callout_fig(name, W, H, box, labels):
    """Image with leader-line labels; labels with y=None follow their anchors."""
    m = META[name]
    x0, y0, bw = box
    s = bw / m['w']
    for side in ('l', 'r'):
        grp = [L for L in labels if L.get('y') is None and ((L['x'] < x0) == (side == 'l'))]
        grp.sort(key=lambda L: m['anchors'][L['a']][1])
        prev = -1e9
        for L in grp:
            want = y0 + m['anchors'][L['a']][1] * s - 9
            L['y'] = max(want, prev + L.get('gap', 44))
            prev = L['y']
    ih = m['h'] * s
    H = max([y0 + ih] + [L['y'] + 34 for L in labels]) + 6
    out = [f'<div class="cfig" style="width:{W}px;height:{H:.0f}px">',
           f'<img src="img/{name}.png" style="left:{x0}px;top:{y0}px;width:{bw}px">']
    svg = []
    for L in labels:
        ax, ay = m['anchors'][L['a']]
        ax, ay = x0 + ax * s, y0 + ay * s
        lx, ly, lw = L['x'], L['y'], L.get('w', 170)
        right = lx > ax
        tx = lx - 5 if right else lx + lw + 5
        ty = ly + 8
        mid = tx - 14 if right else tx + 14
        svg.append(f'<polyline points="{ax:.1f},{ay:.1f} {mid:.1f},{ty:.1f} {tx:.1f},{ty:.1f}" class="ld"/>'
                   f'<circle cx="{ax:.1f}" cy="{ay:.1f}" r="2.2" class="dot"/>')
        out.append(f'<div class="lab" style="left:{lx}px;top:{ly:.0f}px;width:{lw}px;text-align:{"left" if right else "right"}">'
                   f'<b>{L["t"]}</b>{L.get("d", "")}</div>')
    out.append(f'<svg class="lead" width="{W}" height="{H}">{"".join(svg)}</svg></div>')
    return ''.join(out)


MARK = ('<svg viewBox="0 0 32 32" class="mark"><rect width="32" height="32" rx="9" fill="#0a6788"/>'
        '<g stroke="#fff" stroke-width="2.2" stroke-linecap="round" fill="none"><path d="M7 11.5h11.5a3 3 0 1 0-3-3"/>'
        '<path d="M7 16.5h17"/><path d="M7 21.5h8.5a2.6 2.6 0 1 1-2.6 2.6"/></g><circle cx="23.5" cy="21.5" r="1.7" fill="#fff"/></svg>')

# ------------------------------------------------------------------ diagrams
def architecture():
    def node(x, y, w, h, title, sub, cls=''):
        return (f'<g class="nd {cls}"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10"/>'
                f'<text x="{x + 14}" y="{y + 24}" class="t">{title}</text>'
                + ''.join(f'<text x="{x + 14}" y="{y + 42 + i * 15}" class="s">{l}</text>' for i, l in enumerate(sub)) + '</g>')

    def arrow(x1, y1, x2, y2, label='', sub='', dash=False):
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        return (f'<path d="M{x1},{y1} L{x2},{y2}" class="ar{" dash" if dash else ""}" marker-end="url(#ah)"/>'
                f'<text x="{mx}" y="{my - 8}" class="al" text-anchor="middle">{label}</text>'
                f'<text x="{mx}" y="{my + 16}" class="as" text-anchor="middle">{sub}</text>')
    svg = f'''<svg viewBox="0 0 640 330" class="diag">
<defs><marker id="ah" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9z" fill="#0a6788"/></marker></defs>
{node(0, 20, 130, 92, 'Sensor box', ['measures every 5 min', 'solar + one 18650 cell', 'sends 13 bytes'])}
{arrow(132, 66, 202, 66, 'LoRaWAN', 'EU868, encrypted')}
{node(204, 20, 120, 92, 'Gateway', ['Dragino DLOS8N', 'on a high roof', '8 channels'])}
{arrow(326, 66, 396, 66, '4G', 'mobile data')}
<g class="nd dk"><rect x="398" y="0" width="242" height="230" rx="10"/>
<text x="412" y="24" class="t">Our server</text><text x="508" y="24" class="s">Hetzner, EU, self-hosted</text>
{''.join(f'<rect x="412" y="{38 + i * 37}" width="214" height="31" rx="6" class="in"/><text x="424" y="{58 + i * 37}" class="s"><tspan class="b">{a}</tspan>  {b}</text>' for i, (a, b) in enumerate([('ChirpStack', 'checks, decrypts, de-duplicates'), ('Ingestion', 'decodes, validates, works out AQI'), ('TimescaleDB', 'every reading, with history'), ('Redis', 'latest value, live updates'), ('API', 'REST + WebSocket, open data')]))}
</g>
{arrow(519, 232, 519, 270, '', '')}
{node(398, 272, 242, 56, 'Public dashboard', ['Arabic and English, phone first'], 'br')}
<path d="M396,300 C300,300 230,250 230,150 L230,114" class="ar dash" marker-end="url(#ah)"/>
<text x="250" y="262" class="as">settings go back the same way</text><text x="250" y="277" class="as">(interval, calibration)</text>
</svg>'''
    return svg


def payload():
    fields = [('PM2.5', 2, '#0a6788', '×10'), ('PM10', 2, '#0a6788', '×10'), ('Temp.', 2, '#3d8fae', '×100'),
              ('Humidity', 2, '#3d8fae', '×100'), ('Pressure', 2, '#7fb4c9', 'hPa'), ('Battery', 2, '#526b7a', 'mV'),
              ('Flags', 1, '#0c2231', '')]
    x = 0
    cells = ''
    W = 640 / 13
    for name, n, col, unit in fields:
        cells += (f'<rect x="{x * W + 1}" y="0" width="{n * W - 2}" height="46" rx="5" fill="{col}"/>'
                  f'<text x="{x * W + 9}" y="21" class="bt">{name}</text><text x="{x * W + 9}" y="37" class="bs">{unit}</text>')
        x += n
    ticks = ''.join(f'<text x="{i * W + W / 2}" y="62" class="tk" text-anchor="middle">{i}</text>' for i in range(13))
    return f'<svg viewBox="0 0 640 70" class="diag">{cells}{ticks}</svg>'


def particle_scale():
    S = 2.6
    return f'''<svg viewBox="0 0 640 210" class="diag">
<circle cx="110" cy="105" r="{35 * S}" fill="#e3ecf2" stroke="#8ca5b3"/>
<circle cx="110" cy="105" r="{5 * S}" fill="#526b7a"/><circle cx="110" cy="105" r="{1.25 * S}" fill="#0a6788"/>
<path d="M110,105 L300,40" class="ld"/><path d="M123,105 L300,105" class="ld"/><path d="M112,107 L300,170" class="ld"/>
<text x="308" y="36" class="t">Human hair</text><text x="308" y="53" class="s">about 50 to 70 µm across</text>
<text x="308" y="101" class="t">PM10</text><text x="308" y="118" class="s">under 10 µm: dust, road grit, pollen</text>
<text x="308" y="166" class="t">PM2.5</text><text x="308" y="183" class="s">under 2.5 µm: smoke, exhaust; reaches deep into the lungs</text>
</svg>'''


def duty_chart():
    X0, Y0, CW, CH = 46, 20, 570, 190
    X = lambda t: X0 + t * CW / 300
    Y = lambda a: Y0 + CH - a * CH / 250
    pts = [(0, 3), (0, 210), (33, 210), (33, 170), (34.5, 170), (34.5, 3), (300, 3)]
    poly = ' '.join(f'{X(t):.1f},{Y(a):.1f}' for t, a in pts)
    grid = ''.join(f'<line x1="{X0}" x2="{X0 + CW}" y1="{Y(v):.1f}" y2="{Y(v):.1f}" class="gl"/>'
                   f'<text x="{X0 - 6}" y="{Y(v) + 4:.1f}" class="tk" text-anchor="end">{v}</text>' for v in (0, 50, 100, 150, 200, 250))
    xt = ''.join(f'<text x="{X(t):.1f}" y="{Y0 + CH + 16}" class="tk" text-anchor="middle">{t} s</text>' for t in (0, 60, 120, 180, 240, 300))
    return f'''<svg viewBox="0 0 640 240" class="diag">{grid}{xt}
<polygon points="{X(0):.1f},{Y(0):.1f} {poly} {X(300):.1f},{Y(0):.1f}" fill="#63c7e3" opacity=".35"/>
<polyline points="{poly}" fill="none" stroke="#0a6788" stroke-width="2"/>
<text x="{X(3):.1f}" y="{Y(222):.1f}" class="al">Fan on, settle 30 s, read</text>
<text x="{X(40):.1f}" y="{Y(176):.1f}" class="al">Send, about 1 s</text>
<text x="{X(130):.1f}" y="{Y(16):.1f}" class="al">Asleep for the rest: a few mA, to be measured</text>
<text x="{X0}" y="10" class="tk">current drawn from the cell, mA, one 5-minute cycle (estimate)</text></svg>'''


def energy_bars():
    rows = [('Particle counter fan (through the booster)', 1.66), ('ESP32 awake and radio', 0.55), ('Asleep', 0.24)]
    tot = sum(v for _, v in rows)
    out = ''
    x = 0
    cols = ['#0a6788', '#3d8fae', '#a9c6d4']
    for (n, v), c in zip(rows, cols):
        w = v / tot * 640
        out += f'<rect x="{x}" y="0" width="{w - 2}" height="26" fill="{c}" rx="3"/>'
        x += w
    leg = ''.join(f'<rect x="{i * 215}" y="40" width="10" height="10" fill="{c}"/><text x="{i * 215 + 16}" y="49" class="s">{n.split(" (")[0]}: <tspan class="b">{v:.2f} Wh</tspan></text>'
                  for i, ((n, v), c) in enumerate(zip(rows, cols)))
    return f'<svg viewBox="0 0 640 58" class="diag">{out}{leg}</svg>', tot


def wiring():
    return '''<svg viewBox="0 0 640 300" class="diag wiring">
<defs><marker id="aw" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8z" fill="#0c2231"/></marker></defs>
<g class="nd"><rect x="0" y="10" width="120" height="50" rx="8"/><text x="12" y="32" class="t">Solar panel</text><text x="12" y="49" class="s">5 V, 2 W, USB lead</text></g>
<path d="M120,35 H190" class="ar2" marker-end="url(#aw)"/><text x="126" y="28" class="as">micro-USB, 5 V</text>
<g class="nd dk"><rect x="192" y="0" width="210" height="228" rx="10"/><text x="206" y="24" class="t">LILYGO T-Beam V1.2</text>
<rect x="206" y="36" width="182" height="40" rx="5" class="in"/><text x="216" y="53" class="s">AXP2101: charges the cell, runs</text><text x="216" y="68" class="s">the 3.3 V rails, measures the battery</text>
<rect x="206" y="84" width="182" height="28" rx="5" class="in"/><text x="216" y="103" class="s">18650 cell, 3.7 V, in its holder</text>
<rect x="206" y="120" width="182" height="28" rx="5" class="in"/><text x="216" y="139" class="s">ESP32 + SX1276 LoRa, 868 MHz</text>
<text x="206" y="174" class="s">one edge: 3.3V · GND · 22 · 21 · 3.3V</text>
<text x="206" y="192" class="s">other edge: GND · 13 · 14</text>
<text x="206" y="214" class="s" style="fill:#8ca5b3">3 GND pins, two 3.3 V pins: none shared</text></g>
<g class="nd"><rect x="470" y="10" width="170" height="70" rx="8"/><text x="482" y="32" class="t">BME280</text><text x="482" y="49" class="s">3.3 V, GND, SDA → 21,</text><text x="482" y="65" class="s">SCL → 22 (I2C)</text></g>
<g class="nd br"><rect x="440" y="118" width="200" height="56" rx="8"/><text x="452" y="140" class="t">MiniBoost 5 V, in heat-shrink</text><text x="452" y="158" class="s">3.3 V in from the second 3.3 V pin</text></g>
<g class="nd"><rect x="470" y="212" width="170" height="84" rx="8"/><text x="482" y="234" class="t">PMS7003</text><text x="482" y="251" class="s">5 V and GND from the booster</text><text x="482" y="267" class="s">TX → 13 · RX ← 14</text><text x="482" y="283" class="s">3.3 V logic, no shifter</text></g>
<path d="M402,45 H468" class="ar2" marker-end="url(#aw)"/><text x="408" y="38" class="as">4 wires · JST</text>
<path d="M402,146 H438" class="ar2" marker-end="url(#aw)"/><text x="406" y="139" class="as">2 wires</text>
<path d="M540,174 V210" class="ar2" marker-end="url(#aw)"/><text x="546" y="196" class="as">5 V, GND</text>
<path d="M402,200 H430 V250 H468" class="ar2" marker-end="url(#aw)"/><text x="406" y="243" class="as">2 wires · JST</text>
</svg>'''


# ------------------------------------------------------------------ figures with labels
EXPLODED = callout_fig('exploded', 640, 760, (212, 0, 226), [
    dict(a='panel', x=455, y=None, w=180, t='Solar panel', d='5 V, 2 W. Also shades the box.'),
    dict(a='lid', x=455, y=None, w=180, t='Lid and brackets', d='Printed; holds the panel at 30°.'),
    dict(a='ant', x=455, y=None, w=180, t='LoRa antenna', d='The T-Beam’s own, through the wall.'),
    dict(a='tbeam', x=0, y=None, w=200, t='LILYGO T-Beam V1.2', d='ESP32, LoRa radio, charger, 18650 cell.'),
    dict(a='boost', x=0, y=None, w=200, t='MiniBoost in heat-shrink', d='3.3 V in, 5 V out for the PMS7003.'),
    dict(a='upper', x=455, y=None, w=180, t='Top room, sealed', d='Electronics stay dry.'),
    dict(a='gland', x=0, y=None, w=200, t='Cable gland', d='The panel lead comes in here.'),
    dict(a='pms', x=0, y=None, w=200, t='PMS7003', d='Laser particle counter.'),
    dict(a='bme', x=455, y=None, w=180, t='BME280', d='Temperature, humidity, pressure.'),
    dict(a='lower', x=455, y=None, w=180, t='Bottom room, louvred', d='Air in, sun and rain out.'),
])
EXPLODED_W = 1
CUTAWAY = callout_fig('cutaway', 640, 470, (130, 6, 370), [
    dict(a='ant', x=512, y=None, w=128, t='Antenna', d='screwed on through the wall'),
    dict(a='tbeam', x=512, y=None, w=128, t='T-Beam', d='on four printed posts'),
    dict(a='usb', x=512, y=None, w=128, t='Panel lead', d='micro-USB, from the gland'),
    dict(a='hdr', x=0, y=None, w=115, t='Header pins', d='wires soldered on'),
    dict(a='grommet', x=0, y=None, w=115, t='Grommet', d='wires down to the sensors'),
])
LOWER = callout_fig('lower_room', 640, 330, (120, 10, 400), [
    dict(a='pms', x=0, y=None, w=115, t='PMS7003', d='on four feet'),
    dict(a='inlet', x=0, y=None, w=115, t='Inlet', d='faces the louvres'),
    dict(a='adapter', x=525, y=None, w=115, t='Adapter', d='1.27 mm plug to wires'),
    dict(a='boost', x=525, y=None, w=115, t='MiniBoost', d='in heat-shrink, 3.3 → 5 V'),
    dict(a='bme', x=525, y=None, w=115, t='BME280', d='on a post, far from the fan'),
    dict(a='louvre', x=0, y=None, w=115, t='Louvres', d='angled down at 35°'),
])

bars, tot = energy_bars()

# ------------------------------------------------------------------ content
cover = f'''<section class="cover">
<div class="cv-top">{MARK}<span>Qalawun</span><span class="ar">قلاوون</span></div>

<path d="M0 30 H330 a28 28 0 1 0 -28 -28"/><path d="M0 80 H470"/><path d="M0 130 H230 a24 24 0 1 1 -24 24"/></g>
<circle cx="400" cy="130" r="8" fill="#63c7e3"/></svg></div>
<h1>Clean-air data for Tripoli, street by street</h1>
<p class="cv-sub">An open network of solar-powered LoRaWAN sensors that measures fine dust, temperature and humidity,
and publishes every reading as it arrives.</p>
<div class="cv-art">{img('node_pole', 360)}</div>
<div class="cv-meta"><b>White paper</b> · Version 1.0 · {DATE}<br>TripoliLabs · Open source, AGPL-3.0</div>
</section>'''

import os
CHAPTERS = ['The problem', 'Design goals', 'How the system works', 'The sensor box', 'Power', 'Firmware',
            'Server, storage and open data', 'Data quality and limits', 'Deployment and roadmap',
            'Status: verified and still to check', 'Open by design', 'References']
PAGES = json.load(open('pages.json')) if os.path.exists('pages.json') else {}
TOC = ''.join(f'<li><span>{c}</span><i>{PAGES.get(c, "")}</i></li>' for c in CHAPTERS)
summary = f'''<section class="sec">
<div class="abstract"><h2 class="nonum">Summary</h2>
<p>Tripoli has almost no public air-quality monitoring. Diesel generators run for much of the day, traffic is dense,
and nobody can say how clean the air is on a given street at a given hour. <b>Qalawun</b> is TripoliLabs' answer: small,
cheap sensor boxes on poles around the city that measure fine dust (PM2.5 and PM10), temperature and humidity every
five minutes, and a public website that shows the result, live, in Arabic and English.</p>
<p>The boxes need neither mains power nor Wi-Fi. Each runs on a 2 W solar panel and one lithium cell, and sends its
13-byte reading by LoRaWAN radio to a gateway on a rooftop several kilometres away. The gateway forwards it over 4G to
a self-hosted server, which checks it, stores it and pushes it to every open page within seconds.</p>
<p>This paper explains the problem, the design and its trade-offs, the hardware down to the wiring, the power budget,
the software, what we have verified on real hardware, and what is still to be checked before the first three boxes go up.</p></div>
<div class="keys">
<div><b>~$65</b><span>parts per box, estimate</span></div>
<div><b>5 min</b><span>between readings, changeable remotely</span></div>
<div><b>~4 days</b><span>on a full cell with no sun, estimate</span></div>
<div><b>0</b><span>cables to the box: sun in, radio out</span></div></div>
<h3>Contents</h3>
<ol class="toc">{TOC}</ol>
</section>'''

s1 = f'''<section class="sec brk">
<h2><i>1</i>The problem</h2>
<p>Fine particles are the air pollutant with the clearest link to ill health. Particles under 2.5 micrometres (PM2.5)
come mostly from burning: engines, generators, open fires. They are small enough to pass deep into the lungs, and the
World Health Organization's 2021 guideline sets their safe yearly average at just 5 µg/m³, with a 24-hour limit of
15 µg/m³.{ref(1)} Coarser particles (PM10) come from dust, building work and road grit.</p>
{fig(particle_scale(), 'How small fine dust is. Circles drawn to scale; sizes from the US EPA.' + ref(2))}
<p>In Tripoli the mains supply is cut for many hours a day, so neighbourhoods run on diesel generators placed close to
homes, shops and schools. Traffic is heavy and the city has almost no public monitoring.{ref(3)} The result is that residents,
doctors, schools and journalists have no way to know how bad the air is outside their own door, when it is worst, or
whether anything is improving.</p>
<h2><i>2</i>Design goals</h2>
<p>The design follows from the city it has to work in:</p>
<table class="tbl"><tr><th>Goal</th><th>What it means for the design</th></tr>
<tr><td>Work through power cuts</td><td>Each box runs on its own solar panel and cell. Only the gateway needs power, and it can carry its own backup.</td></tr>
<tr><td>Need no internet at the box</td><td>LoRaWAN radio: one gateway covers many boxes several kilometres away; the gateway itself uses 4G.</td></tr>
<tr><td>Cheap enough to cover a city</td><td>Off-the-shelf boards and sensors, a 3D-printed box, about $65 in parts per box.</td></tr>
<tr><td>Easy to build and fix</td><td>Wired by hand straight to the board’s pins, sensors on plugs, every part replaceable; one design for every box.</td></tr>
<tr><td>Trustworthy</td><td>Open hardware, firmware and server; every reading public; honest about sensor limits.</td></tr>
<tr><td>For everyone in Tripoli</td><td>Arabic and English, phone first, light on data.</td></tr></table>
</section>'''

s3 = f'''<section class="sec brk">
<h2><i>3</i>How the system works</h2>
<p>A reading travels from a box on a pole to a public page in under a minute. Only the server end has a wire.</p>
{fig(architecture(), 'The data path. The gateway forwards messages it cannot read; only our server holds the keys.', True)}
<h3>One reading on the air</h3>
<p>Every five minutes the box sends a 13-byte message. Values are scaled to whole numbers so they fit in two bytes each;
the last byte carries a version number and says which sensors answered, so a box with a dead sensor still reports its
battery and stays reachable.{ref(4)} Small messages keep each radio transmission short, which saves energy and respects the 1% duty-cycle
limit of the EU868 band.</p>
{fig(payload(), 'The 13-byte uplink, little-endian. Bytes 0 to 12; scaling under each field.', True)}
<h3>Security</h3>
<p>Each box joins the network over the air (LoRaWAN OTAA) with its own root key, which never leaves the box and our server.
Every message is encrypted and signed with session keys derived at join time, so a gateway, ours or anyone else's,
can pass messages on but cannot read or forge them. Keys are never stored in the repository.</p>
</section>'''

s4 = f'''<section class="sec brk">
<h2><i>4</i>The sensor box</h2>
<p>Every box is the same: one 3D-printed enclosure on a pole, with two rooms. The top room is sealed and holds the
electronics. The bottom room is shaded and louvred, like a small weather screen: air flows through, sun and rain stay
out. The panel sits on four printed brackets above the lid, tilted 30° to face south, and doubles as a sunshade.</p>
{fig(EXPLODED, 'The box pulled apart. Drawn from our 3D model; the T-Beam and the MiniBoost are their makers’ own CAD models.', True)}
</section>
<section class="sec brk">
<h3>Parts</h3>
<p>We have three of each of the main parts already, enough for the first three boxes and the gateway. There is no extra circuit board: the sensors wire straight to the T-Beam.</p>
<div class="parts">
{''.join(f'<div class="pt"><div class="pi">{img(n, w)}</div><b>{t}</b><span>{d}</span></div>' for n, w, t, d in [
    ('part_tbeam', 200, 'LILYGO T-Beam V1.2, 868 MHz', 'ESP32, SX1276 LoRa radio, AXP2101 charger, 18650 holder, one antenna.' + ref(5)),
    ('part_pms', 150, 'Plantower PMS7003', 'Laser particle counter, 48 × 37 × 12 mm. 5 V supply, 3.3 V serial data.' + ref(6)),
    ('part_bme', 110, 'BME280 breakout', 'Bosch sensor for temperature, humidity and pressure, over I2C.' + ref(7)),
    ('part_boost', 120, 'MiniBoost 5 V', 'Adafruit’s CAD model. 11 × 18 mm; rides in heat-shrink on the PMS7003’s power wire.' + ref(8)),
    ('part_cell', 170, '18650 cell, 3,000 mAh', 'One per box, in the T-Beam’s holder. Bought locally from a trusted shop.'),
    ('part_panel', 170, 'Solar panel, 5 V 2 W', 'About 136 × 110 mm, USB lead straight into the T-Beam.'),
    ('part_box', 160, 'Printed enclosure', 'About 112 × 84 × 96 mm plus brackets. PETG or ASA, light colour.'),
    ('part_gateway', 60, 'Dragino DLOS8N gateway', '260 × 90 × 85 mm, outdoor, 8 channels, 4G. One covers many boxes.' + ref(9)),
])}
</div>
<table class="tbl cost"><tr><th>Cost per box (parts)</th><th>US$</th></tr>
<tr><td>LILYGO T-Beam V1.2</td><td>29 – 32</td></tr><tr><td>Plantower PMS7003 and adapter</td><td>13 – 15</td></tr>
<tr><td>BME280 breakout</td><td>2.5 – 3</td></tr><tr><td>Solar panel, cell, MiniBoost</td><td>about 15</td></tr>
<tr><td>JST plugs, wire, heat-shrink, gland, filament</td><td>about 5</td></tr>
<tr class="tot"><td>Total, estimate</td><td>about 65 – 70</td></tr></table>
</section>
<section class="sec">
<h3>Inside the top room</h3>
<p>The top room holds only the T-Beam, on four printed posts with its antenna end against the right wall. Its own
antenna screws on through a hole in that wall and turns up, clear of the panel. The panel’s USB lead enters through a
cable gland in the front wall, straight in line with the T-Beam’s micro-USB socket. Eight wires are soldered to the
T-Beam’s header pins and run down through a grommet to the sensors.</p>
{fig(CUTAWAY, 'The top room with the front and side walls removed.', True)}
<p>No extra board is needed. LilyGO’s schematic shows three ground pins and two 3.3 V pins on the header{ref(16)}, so
every wire has a pin of its own and nothing is spliced. Leaving out a perfboard halves the box’s footprint, from
170 × 110 mm to 112 × 84 mm. Each sensor connects through a small locking JST plug, so a broken sensor can be swapped on
the pole without a soldering iron. A custom PCB only makes sense once we build boxes by the dozen.</p>
<h3>The sensor room</h3>
{fig(LOWER, 'The bottom room on its own. The PMS7003 sits on four feet with its inlet facing the louvres; the MiniBoost lies beside it in heat-shrink; the BME280 sits on a post on the far side, away from the fan’s warm air.', True)}
</section>
<section class="sec">
<h3>Wiring</h3>
{fig(wiring(), 'How the parts connect. Pin numbers are the ones the firmware expects.' + ref(10), True)}
<table class="tbl"><tr><th>Sensor</th><th>Connections</th></tr>
<tr><td>BME280</td><td>VCC → 3.3 V pin · GND → GND · SCL → GPIO 22 · SDA → GPIO 21 (I2C address 0x76). CSB and SDO left free.</td></tr>
<tr><td>MiniBoost</td><td>IN → the second 3.3 V pin · GND → GND · OUT → PMS7003 VCC. Covered in heat-shrink.</td></tr>
<tr><td>PMS7003</td><td>VCC → MiniBoost 5 V · GND → booster GND · TX → GPIO 13 · RX ← GPIO 14. Its data lines are 3.3 V, so no level shifter.</td></tr>
<tr><td>Power rail</td><td>Both 3.3 V pins come from the power chip’s DCDC3 rail, which the firmware must switch on. It stays on through sleep; the particle counter’s fan sleeps on a serial command.</td></tr></table>
<p class="small">Why not the “5V” pin? On the V1.2 it carries the board’s system supply, which follows the battery at night
and rises towards the panel’s voltage in the sun. The header has no battery pin. The 3.3 V rail is steady and the
booster turns it into the 5 V the particle counter needs.{ref(16)}</p>
{fig(img('top_room', 520, 'display:block;margin:0 auto'), 'The top room from above. Front wall at the bottom; the gland and USB lead on the front, the antenna on the right, wires to the sensors through a grommet at the back left.', True)}
<h3>Designed to fit</h3>
<p>Every part is placed in one 3D model, and a script checks that no two parts intersect: boards, posts, walls,
the antenna, the panel and every wire. The only contacts it allows are the intended ones, such as a wire ending in its
plug or the lid resting on the walls. The model, the check and the renders are in the repository under
<code>hardware/render</code>, and the same model produced the animation on the website.</p>
</section>'''

s5 = f'''<section class="sec brk">
<h2><i>5</i>Power</h2>
<p>The box lives on a 2 W panel and one 18650 cell. It spends most of its time asleep; most of its energy goes on the
particle counter's fan, which must run for about 30 seconds before each reading so the air in the chamber settles.</p>
{fig(duty_chart(), 'Current drawn from the cell over one five-minute cycle. Estimate from datasheet figures; the bench will measure it.', True)}
{fig(bars, f'Where a day’s energy goes, at one reading every five minutes: about {tot:.1f} Wh in total.', True)}
<table class="tbl"><tr><th></th><th>Estimate</th><th>How</th></tr>
<tr><td>Panel in</td><td>3.5 – 6 Wh a day</td><td>2 W × 3 to 5 sun hours × 0.6 for angle, dust and charging loss</td></tr>
<tr><td>Box uses</td><td>about {tot:.1f} Wh a day</td><td>fan about 100 mA at 5 V{ref(6)} through the booster; ESP32 about 50 mA awake</td></tr>
<tr><td>No sun</td><td>about 4 days</td><td>3,000 mAh × 3.7 V = 11 Wh in a full cell</td></tr>
<tr><td>Bad week</td><td>stretch the interval</td><td>set it to 10 minutes from the server: the fan's share halves</td></tr></table>
<h3>Could a smaller panel do?</h3>
<p>Smaller panels exist with better cells, but at this size they also give less power, and the good ones are
6 V panels whose open-circuit voltage is above what the T-Beam accepts.</p>
<table class="tbl"><tr><th>Panel</th><th>Size</th><th>Power</th><th>Open-circuit</th><th>Fit for us</th></tr>
<tr><td>Ours: 5 V 2 W USB</td><td>about 136 × 110 mm</td><td>2 W</td><td>regulated 5 V USB</td><td>Yes: plugs straight in. Measure once.</td></tr>
<tr><td>Voltaic P124, ETFE</td><td>66 × 113 mm</td><td>1.2 W</td><td>7.1 – 7.3 V</td><td>Needs a 5 V regulator, and a 10-minute interval to balance the day{ref(15)}</td></tr>
<tr><td>Voltaic P126, ETFE</td><td>112 × 136 mm</td><td>2 W</td><td>8.7 V</td><td>Same size as ours, needs a regulator{ref(15)}</td></tr></table>
<p>So we keep the panels we have. A box that has to be smaller can use the 1.2 W panel with a small 5 V regulator
and a 10-minute interval, at about half the panel area; the brackets on the lid take either size.</p>
<div class="note"><b>Before a panel touches a T-Beam.</b> The T-Beam's USB input is rated 3.9 to 6 V{ref(5)}, and its
power chip switches the board off above 7 V.{ref(11)} Our panels are sold as 5 V, but an unloaded panel in full sun can
read higher, so each one is measured once with a multimeter first. The firmware will also cap the charging current so a
weak panel does not collapse under load.</div>
</section>'''

s6 = f'''<section class="sec">
<h2><i>6</i>Firmware</h2>
<p>The firmware is written in C on ESP-IDF, with RadioLib for LoRaWAN. It follows a ports-and-adapters design: the
logic (sensor sampling, the payload codec, remote settings) lives in a portable core that builds both for the ESP32
and for a normal computer. On a computer it runs against simulated sensors, which is how the unit tests and our
network simulator exercise the real code without hardware.{ref(10)}</p>
<table class="tbl"><tr><th>Step</th><th>What the box does</th></tr>
<tr><td>Wake</td><td>Restores its LoRaWAN session from RTC memory, so it does not need to join again.</td></tr>
<tr><td>Measure</td><td>Wakes the PMS7003, waits 30 s, reads it; reads the BME280; reads the battery voltage.</td></tr>
<tr><td>Send</td><td>Encodes 13 bytes and sends them on port 2.</td></tr>
<tr><td>Listen</td><td>Opens the receive windows after the uplink for any queued setting.</td></tr>
<tr><td>Sleep</td><td>Puts the sensor's fan to sleep and the ESP32 in deep sleep until the next reading.</td></tr></table>
<h3>Remote settings</h3>
<p>Three settings can be changed from the server without visiting the box. A command is queued on port 10, applied
as soon as it arrives, stored in flash so it survives a power cut, and confirmed with a report on port 11.</p>
<table class="tbl"><tr><th>Setting</th><th>Range</th><th>Why</th></tr>
<tr><td>Sample interval</td><td>2 min to 6 h</td><td>save energy in a cloudy week; the lower limit respects the radio duty cycle</td></tr>
<tr><td>PM2.5 offset</td><td>± 50 µg/m³</td><td>correct a box against a reference</td></tr>
<tr><td>Temperature offset</td><td>± 10 °C</td><td>correct for self-heating in the box</td></tr></table>
<p>A value out of range is refused and reported as such; the box keeps its current setting. The same payload layout
and command codes are shared by the firmware and the server through common test vectors, so the two cannot drift apart
without the tests failing.</p>
</section>'''

s7 = f'''<section class="sec">
<h2><i>7</i>Server, storage and open data</h2>
<p>Everything on the server side is open source and self-hosted, on a single Hetzner machine in the EU to start with.</p>
<table class="tbl"><tr><th>Part</th><th>Role</th></tr>
<tr><td>ChirpStack v4</td><td>LoRaWAN network server: joins, decryption, de-duplication when several gateways hear a box.{ref(12)}</td></tr>
<tr><td>Mosquitto</td><td>Message broker between the gateway bridge, ChirpStack and our services.</td></tr>
<tr><td>Ingestion service</td><td>Decodes each uplink, validates it, works out the air quality index and stores it.</td></tr>
<tr><td>TimescaleDB</td><td>Every reading, kept for a year; hourly averages kept up to date automatically; older data compressed after 7 days.</td></tr>
<tr><td>Redis</td><td>The latest value per box and the live feed to open pages.</td></tr>
<tr><td>API</td><td>REST and WebSocket for the dashboard and for anyone who wants the data.</td></tr></table>
<h3>Air quality index</h3>
<p>Readings are turned into one number from 0 to 500 with the US EPA method: an index is worked out for PM2.5 and for
PM10, and the higher of the two is the box's AQI.{ref(13)} The dashboard shows the six EPA categories in their standard colours,
with plain-language advice in Arabic and English.</p>
{fig(img('dash_live', 640, 'border:1px solid #d3dee6;border-radius:8px'), 'The Qalawun dashboard, live view. Shown here on simulated data from our network simulator.', True)}
</section>'''

s8 = f'''<section class="sec brk">
<h2><i>8</i>Data quality and limits</h2>
<p>These are low-cost sensors, not regulatory monitors. They are good at showing differences between places and over
time, and at catching events such as a generator starting next door. A single reading can be off. We say so on the
website and design around it:</p>
<ul class="pl">
<li><b>Humidity.</b> In damp air, particles absorb water and swell, so optical counters read high. Every reading
carries the humidity it was taken at, so it can be corrected later.</li>
<li><b>Heat.</b> The electronics warm the box. The BME280 sits in the shaded bottom room, away from the fan, and a
temperature offset can be set remotely.</li>
<li><b>Calibration.</b> A PM2.5 offset can be set per box. Where possible, a box will run next to a reference monitor
for a few weeks to find it.</li>
<li><b>Gaps.</b> A missing reading is shown as missing, never filled in. The battery voltage in every message shows a
box failing before it stops.</li>
<li><b>Ageing.</b> Particle counters drift as dust builds up inside. Boxes are compared with their neighbours over time,
and the sensor is the cheapest part to replace.</li></ul>
<h2><i>9</i>Deployment and roadmap</h2>
<p>We start small and spend more only once the step before has proven itself.</p>
<div class="stages">
<div><span class="tag done">Done</span><b>Bench test</b><p>One T-Beam joined our network through the DLOS8N gateway and its reading was decoded by our server (7 October 2026).</p></div>
<div><span class="tag now">Next</span><b>Three boxes</b><p>Wired by hand, in printed boxes, in three neighbourhoods. Run for months on sun alone.</p></div>
<div><span class="tag">Later</span><b>25 to 50 boxes</b><p>Our own PCB, a few more gateways, a public API.</p></div>
<div><span class="tag">Later</span><b>100+ boxes</b><p>OpenAQ integration and partnerships with universities.</p></div></div>
{fig(f'<div class="map" style="width:78%;margin:0 auto"><img src="img/map_brand.png"><svg viewBox="0 0 {MAP["size"][0]} {MAP["size"][1]}">' + ''.join(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="14" fill="#0a6788" stroke="#fff" stroke-width="4"/><text x="{x + (-20 if n.startswith(("El Mina", "Zahrieh")) else 20):.0f}" y="{y + 7:.0f}" text-anchor="{"end" if n.startswith(("El Mina", "Zahrieh")) else "start"}" class="mp">{n}</text>' for n, x, y in MAP['pts']) + f'<circle cx="640" cy="690" r="{3 * MAP["km_px"]:.0f}" fill="none" stroke="#0c2231" stroke-width="3" stroke-dasharray="14 10"/><rect x="630" y="680" width="20" height="20" fill="#0c2231"/><rect x="60" y="1220" width="{MAP["km_px"]:.0f}" height="10" fill="#0c2231"/><text x="60" y="1205" class="mp">1 km</text></svg></div>', 'Example sites from our simulator, and a 3 km ring around one possible gateway roof. Real sites are still to be chosen, with the owners’ permission. Map data © OpenStreetMap contributors.' + ref(14), True)}
</section>'''

s9 = f'''<section class="sec brk">
<h2><i>10</i>Status: verified and still to check</h2>
<div class="two"><div><h3>Verified on hardware</h3><ul class="ok">
<li>T-Beam V1.2 power chip (AXP2101) found and set up</li>
<li>LoRa radio started on the default pins</li>
<li>OTAA join through the DLOS8N to ChirpStack</li>
<li>Uplink on port 2 decoded by our ingestion service</li></ul>
<h3>Verified in software</h3><ul class="ok">
<li>Payload and settings codec shared by firmware and server, with common test vectors</li>
<li>Full pipeline running on simulated boxes: real LoRaWAN joins and encryption through ChirpStack</li>
<li>Dashboard live on simulated data, in both languages</li>
<li>3D model of the box with no colliding parts</li></ul></div>
<div><h3>Still to check</h3><ul class="todo">
<li>Solder the BME280 pins; confirm it is a BME280 (chip ID 0x60), not a BMP280</li>
<li>Fit the PMS7003 adapters and read the sensor on the real board</li>
<li>Measure each panel's open-circuit voltage in full sun: 6 V or less</li>
<li>Firmware: switch on the 3.3 V header rail (DCDC3) at boot</li>
<li>Measure sleep current and energy per cycle</li>
<li>Remote settings on a real box, including after a power cut</li>
<li>Print a test box: fit, heat in the sun, rain through the louvres</li>
<li>Measure our panels; the drawings assume 136 × 110 mm</li>
<li>Choose sites and the gateway roof; SIM and backup power for the gateway</li></ul></div></div>
</section>'''

s10 = f'''<section class="sec">
<h2><i>11</i>Open by design</h2>
<p>Firmware, server, dashboard and hardware designs are public under the AGPL-3.0 licence, so anyone can audit the
numbers, run their own copy or build a box. Every reading is published as it arrives and can be downloaded or read from
the API. The project collects no personal data: the boxes measure air, and the website needs no account.</p>
<p>Qalawun is named after the Mamluk sultan who took Tripoli in 1289, under whom the city was rebuilt where it stands
today. The project is run by TripoliLabs volunteers. You can host a box on your building, improve the code or use the data:
<b>github.com/TripoliLabs/air-quality-monitoring</b>.</p>
<h2 class="nonum">References</h2>
<ol class="refs">
<li>World Health Organization. <i>WHO global air quality guidelines</i>, 2021. who.int/publications/i/item/9789240034228</li>
<li>US EPA. <i>Particulate Matter (PM) Basics.</i> epa.gov/pm-pollution/particulate-matter-pm-basics</li>
<li>TripoliLabs. Project brief, <code>AGENTS.md</code>, in our repository.</li>
<li>TripoliLabs. Telemetry codec, <code>packages/telemetry-codec</code>.</li>
<li>LILYGO. T-Beam hardware notes and 3D model. github.com/Xinyuan-LilyGO/LilyGo-LoRa-Series</li>
<li>Plantower. PMS7003 digital particle concentration sensor, data manual.</li>
<li>Bosch Sensortec. BME280 datasheet. bosch-sensortec.com</li>
<li>Adafruit. MiniBoost 5 V 1 A, product 4654, and its CAD model. github.com/adafruit/Adafruit_CAD_Parts</li>
<li>Dragino. DLOS8N outdoor LoRaWAN gateway, user manual. wiki.dragino.com</li>
<li>TripoliLabs. Firmware README: build, pins and hardware status, <code>firmware/</code>.</li>
<li>X-Powers. AXP2101 datasheet V1.4.</li>
<li>ChirpStack documentation. chirpstack.io/docs</li>
<li>US EPA. <i>Technical Assistance Document for the Reporting of Daily Air Quality – the AQI</i>.</li>
<li>OpenStreetMap contributors. Map data under the ODbL. openstreetmap.org/copyright</li>
<li>Voltaic Systems. Small solar panels: P124, P126 specifications. voltaicsystems.com/small-solar-panels</li>
<li>LILYGO. T-Beam V1.2 schematic, <code>schematic/LilyGo_TBeam_V1.2.pdf</code>. github.com/Xinyuan-LilyGO/LilyGo-LoRa-Series</li></ol>
<p class="small">All drawings in this paper are renders of our own 3D model, not photographs. Prices are estimates
from November 2026. Power figures are estimates from datasheets until measured.</p>
</section>'''

css = open('style.css').read()
html = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Qalawun white paper</title>
<style>{css}</style></head><body>{cover}{summary}{s1}{s3}{s4}{s5}{s6}{s7}{s8}{s9}{s10}</body></html>'''
open('whitepaper.html', 'w').write(html)
print('ok', FIG[0], 'figures')
