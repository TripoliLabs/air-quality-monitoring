# Qalawun sensor node: full assembly, collision check, stills and the
# explode/assemble animation. Blender 4.4, headless, units = millimetres.
#
#   blender -b --python node.py -- <cad_dir> <out_dir> <job> [job ...]
#
# cad_dir holds tbeam.glb (LilyGO T-Beam V1.x STEP) and boost.glb (Adafruit
# 4654 MiniBoost STEP), both converted from STEP with step2glb.py. Every other
# part is modelled here from its published dimensions.
import bpy, bmesh, sys, math, json, os
from mathutils import Vector, Matrix, Euler
from mathutils.bvhtree import BVHTree
from bpy_extras.object_utils import world_to_camera_view

ARGS = sys.argv[sys.argv.index('--') + 1:]
CAD, OUT = ARGS[0], ARGS[1]
JOBS = ARGS[2:]

# ----------------------------------------------------------------- palette
# Brand colours from the Qalawun dashboard (apps/dashboard/src/style.css):
# deep-sea ink #0c2231, brand teal #0a6788, sea-haze page #eef4f8.
def hexc(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def lin(c):  # sRGB -> linear for diffuse_color
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c)


PAL = {
    'shell': '#f6f9fb', 'shell_d': '#dbe5ec', 'lid': '#ffffff', 'teal': '#0a6788', 'teal_l': '#63c7e3',
    'ink': '#0c2231', 'grey': '#8a9ba6', 'grey_d': '#4d606c', 'pole': '#9aa6ae', 'silver': '#c9ced2',
    'label': '#eef1f3', 'black': '#151a1e', 'purple': '#5b2a86', 'gold': '#c9a43a', 'pcb': '#1f7a4a',
    'copper': '#c98a4b', 'panel': '#13284a', 'frame': '#b9c2c8', 'white': '#f7f9fa', 'rubber': '#2b3238',
    'red': '#c4342d', 'green_led': '#3fd07a', 'yellow': '#e3b62c', 'blue': '#2a63b8', 'green': '#2f8f57', 'orange': '#e07b26',
    'cell': '#2d6fb0', 'concrete': '#cdd5da', 'shrink': '#9fd3e6',
}
MATS = {}


def mat(name):
    if name not in MATS:
        m = bpy.data.materials.new(name)
        m.diffuse_color = (*hexc(PAL[name]), 0.35 if name == 'shrink' else 1)
        MATS[name] = m
    return MATS[name]


# ----------------------------------------------------------------- groups
GROUPS = {}       # name -> empty
EXPLODE = {}      # name -> Vector offset when exploded
WIRES = set()     # groups hidden while exploded


def group(name, explode=(0, 0, 0), wire=False):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    GROUPS[name] = e
    EXPLODE[name] = Vector(explode)
    if wire:
        WIRES.add(name)
    return e


def _finish(o, color, g):
    if o.type == 'MESH':
        o.data.materials.clear()
        o.data.materials.append(mat(color))
    o.parent = GROUPS[g]
    return o


def box(g, size, loc, color, rot=(0, 0, 0), bevel=0.0, name='box'):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        md = o.modifiers.new('bv', 'BEVEL')
        md.width = bevel
        md.segments = 2
        md.limit_method = 'ANGLE'
    return _finish(o, color, g)


def cyl(g, r, h, loc, color, rot=(0, 0, 0), verts=40, name='cyl'):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, location=loc, rotation=rot, vertices=verts)
    o = bpy.context.active_object
    o.name = name
    return _finish(o, color, g)


def torus(g, R, r, loc, color, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, location=loc, rotation=rot,
                                     major_segments=64, minor_segments=12)
    return _finish(bpy.context.active_object, color, g)


def sphere(g, r, loc, color):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=24, ring_count=12)
    return _finish(bpy.context.active_object, color, g)


def strut(g, p, q, w, color):
    """Square bar from p to q."""
    p, q = Vector(p), Vector(q)
    d = q - p
    bpy.ops.mesh.primitive_cube_add(size=1, location=(p + q) / 2)
    o = bpy.context.active_object
    o.scale = (w, w, d.length)
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = d.to_track_quat('Z', 'Y')
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return _finish(o, color, g)


def wire(g, pts, color, r=0.6):
    cu = bpy.data.curves.new('w', 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = r
    cu.bevel_resolution = 3
    cu.use_fill_caps = True
    sp = cu.splines.new('BEZIER')
    sp.bezier_points.add(len(pts) - 1)
    for bp, p in zip(sp.bezier_points, pts):
        bp.co = p
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    o = bpy.data.objects.new('wire', cu)
    bpy.context.scene.collection.objects.link(o)
    cu.materials.append(mat(color))
    o.parent = GROUPS[g]
    return o


def hole(target, loc, r, axis, depth=20):
    """Boolean a round hole through `target` (mesh object)."""
    rot = {'x': (0, math.radians(90), 0), 'y': (math.radians(90), 0, 0), 'z': (0, 0, 0)}[axis]
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, rotation=rot, vertices=32)
    c = bpy.context.active_object
    c.hide_render = True
    c.hide_viewport = True
    c.name = 'cutter'
    md = target.modifiers.new('hole', 'BOOLEAN')
    md.operation = 'DIFFERENCE'
    md.object = c
    md.solver = 'EXACT'
    return c


def import_glb(path, g):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    roots = [o for o in new if o.parent is None]
    w = bpy.data.objects.new(g + '_cad', None)
    bpy.context.scene.collection.objects.link(w)
    for r in roots:
        r.parent = w
    w.parent = GROUPS[g]
    return w, new


def world_bbox(objs):
    pts = []
    for o in objs:
        if o.type == 'MESH':
            pts += [o.matrix_world @ Vector(c) for c in o.bound_box]
    return (Vector([min(p[i] for p in pts) for i in range(3)]),
            Vector([max(p[i] for p in pts) for i in range(3)]))


# ----------------------------------------------------------------- dimensions
BW, BD = 112.0, 84.0          # outer footprint of the printed box (no perfboard)
T = 2.4                       # wall thickness
LH = 36.0                     # lower (sensor) room height, floor to divider underside
DZ = LH                       # divider bottom
TOPF = DZ + T                 # top-room floor (divider top)
UH1 = 92.0                    # top of the walls
PMS_X, PMS_Y = -24.0, -17.0   # PMS7003 centre: inlet towards the front louvres
BME_X, BME_Y = 38.0, 14.0     # BME280 on its post, away from the fan
BOOST = (16.0, -22.0)         # MiniBoost in heat-shrink, on the sensor-room floor
GROM = (-38.0, -24.0)         # grommet in the divider, in front of the T-Beam
LID = 4.0
TILT = math.radians(30)

# Panel: 136 x 110 mm is the usual size for a 5 V 2 W USB panel. Measure ours.
PW, PD, PT = 136.0, 110.0, 2.6

TB = {}  # T-Beam reference points (filled by build)


def build(shots_pole=True):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear(); GROUPS.clear(); EXPLODE.clear(); WIRES.clear(); TB.clear()

    # ---------------- printed box -----------------
    group('lower', (0, 0, -115))
    group('upper', (0, 0, 0))
    group('lid', (0, 0, 140))
    group('panel', (0, 0, 220))
    group('tbeam', (0, 0, 85))
    group('antenna', (60, 0, 85))
    group('boost', (0, 0, -35))
    group('pms', (0, 0, -60))
    group('bme', (0, 0, -60))
    group('gland', (0, -60, 0))
    group('mount', (0, 90, 0))
    group('cables', wire=True)
    group('wires', wire=True)

    # lower room: floor, corner posts, louvres on all four sides
    box('lower', (BW, BD, 3), (0, 0, 1.5), 'shell')
    for sx in (-1, 1):
        for sy in (-1, 1):
            box('lower', (6, 6, LH - 3), (sx * (BW / 2 - 3), sy * (BD / 2 - 3), 3 + (LH - 3) / 2), 'shell')
    for k in range(5):
        z = 8.5 + k * 5.9
        for sy in (-1, 1):
            box('lower', (BW - 12, 1.6, 6.5), (0, sy * (BD / 2 - 3.0), z), 'shell',
                rot=(math.radians(-35 * sy), 0, 0))
        for sx in (-1, 1):
            box('lower', (1.6, BD - 12, 6.5), (sx * (BW / 2 - 3.0), 0, z), 'shell',
                rot=(0, math.radians(35 * sx), 0))
    # sensor mounts on the lower floor
    for x in (PMS_X - 17, PMS_X + 17):
        for y in (PMS_Y - 13, PMS_Y + 13):
            box('lower', (5, 5, 2.6), (x, y, 4.3), 'shell_d')       # PMS7003 feet
    cyl('lower', 3, 9.8, (BME_X, BME_Y, 3 + 4.9), 'shell_d')         # BME280 post

    # upper shell: divider (with grommet hole), walls, posts, back plate
    div = box('upper', (BW, BD, T), (0, 0, DZ + T / 2), 'shell')
    hole(div, (GROM[0], GROM[1], DZ + T / 2), 5.5, 'z')
    h = UH1 - TOPF
    front = box('upper', (BW, T, h), (0, -BD / 2 + T / 2, TOPF + h / 2), 'shell')
    box('upper', (BW, T, h), (0, BD / 2 - T / 2, TOPF + h / 2), 'shell')
    box('upper', (T, BD - 2 * T, h), (-BW / 2 + T / 2, 0, TOPF + h / 2), 'shell')
    right = box('upper', (T, BD - 2 * T, h), (BW / 2 - T / 2, 0, TOPF + h / 2), 'shell')
    # brand badge on the front: a teal tile with the three air lines of the mark
    bxb, bzb = -BW / 2 + 19, TOPF + (UH1 - TOPF) / 2
    box('upper', (24, 1.0, 24), (bxb, -BD / 2 - 0.5, bzb), 'teal', bevel=0.4)
    for dz, w_ in ((5, 12), (0, 15), (-5, 9)):
        box('upper', (w_, 0.4, 1.8), (bxb - 1.5 + (w_ - 15) / 2, -BD / 2 - 1.2, bzb + dz), 'white')
    TB['badge'] = Vector((bxb, -BD / 2 - 1, bzb))
    # back plate with two pole brackets (printed with the shell)
    box('upper', (60, 6, UH1 - 6), (0, BD / 2 + 3, (UH1 - 6) / 2 + 3), 'shell_d')
    for z in (14, UH1 - 14):
        box('upper', (60, 10, 14), (0, BD / 2 + 11, z), 'shell_d')

    # ---------------- T-Beam (official CAD) -----------------
    w, new = import_glb(os.path.join(CAD, 'tbeam.glb'), 'tbeam')
    for o in list(new):
        if o.name.startswith('TIANXIAN_ZU01_2'):        # whip, both copies: we draw it bent up
            bpy.data.objects.remove(o)
    new = [o for o in bpy.data.objects if o.name.startswith(('T22_', 'MICRO', 'TIANXIAN'))]
    w.scale = (1000, 1000, 1000)
    w.rotation_euler = (math.radians(-90), 0, math.radians(90))
    bpy.context.view_layer.update()
    pcb = [o for o in new if o.name.startswith('T22_GPS_V1-1-PCB')][0]
    mn, mx = world_bbox([pcb])
    lo, _ = world_bbox(new)
    # place: PCB end 1.5 mm inside the right wall, holder 1 mm above the floor
    xc = BW / 2 - T - 1.5 - (mx.x - mn.x) / 2
    yc = 16.0
    zb = TOPF + 1.0
    w.location = (xc - (mn.x + mx.x) / 2, yc - (mn.y + mx.y) / 2, zb - lo.z)
    bpy.context.view_layer.update()
    # PCB underside: ray up from below at a free corner
    sc = bpy.context.scene
    dg = bpy.context.evaluated_depsgraph_get()
    hit = sc.ray_cast(dg, Vector((xc - 44, yc + 12, zb - 0.5)), Vector((0, 0, 1)))
    pcb_bot = hit[1].z if hit[0] else zb + 18.4
    hit = sc.ray_cast(dg, Vector((xc - 44, yc + 12, pcb_bot + 10)), Vector((0, 0, -1)))
    pcb_top = hit[1].z if hit[0] else pcb_bot + 1.6
    TB.update(xc=xc, yc=yc, zb=zb, pcb_bot=pcb_bot, pcb_top=pcb_top)
    usb = [o for o in new if o.name.startswith('MICRO')][0]
    umn, umx = world_bbox([usb])
    TB['usb'] = Vector(((umn.x + umx.x) / 2, umn.y, (umn.z + umx.z) / 2))
    swv = [o for o in new if o.name.startswith('TIANXIAN')]
    smn, smx = world_bbox(swv)
    TB['sma'] = Vector((smx.x, (smn.y + smx.y) / 2, (smn.z + smx.z) / 2))
    # the swivel and hex belong to the antenna, which screws on from outside
    for o in swv:
        mw = o.matrix_world.copy()
        o.parent = GROUPS['antenna']
        o.matrix_world = mw
    # four posts under the PCB corners
    for sx in (-1, 1):
        for sy in (-1, 1):
            hp = pcb_bot - TOPF - 0.2
            cyl('upper', 2.6, hp, (xc + sx * 46.5, yc + sy * 16.5, TOPF + hp / 2), 'shell_d', verts=24)
    # header pins used (V1.2 schematic): back edge 3V3 GND 22 21 3V3, front edge GND 13 14
    TB['hdr_back'] = []
    TB['hdr_front'] = []
    for row, n, y in (('hdr_back', 5, yc + 17.8), ('hdr_front', 3, yc - 17.8)):
        for i in range(n):
            x = xc - 44 + i * 2.54
            box('tbeam', (0.64, 0.64, 8), (x, y, pcb_top + 3), 'gold')
            TB[row].append(Vector((x, y, pcb_top + 7.2)))
        box('tbeam', (n * 2.54, 2.5, 2.5), (xc - 44 + (n - 1) / 2 * 2.54, y, pcb_top + 1.25 + 0.05), 'black')

    # ---------------- antenna: through a hole in the right wall, bent up -----
    hole(right, (BW / 2 - T / 2, TB['sma'].y, TB['sma'].z), 5.4, 'x')
    pivot = Vector((TB['sma'].x - 4.5, TB['sma'].y, TB['sma'].z))
    sphere('antenna', 4.8, pivot, 'black')
    cyl('antenna', 4.6, 50, pivot + Vector((0, 0, 27)), 'black', verts=32)
    sphere('antenna', 4.6, pivot + Vector((0, 0, 52)), 'black')
    TB['ant_top'] = pivot + Vector((0, 0, 56))

    # ---------------- MiniBoost (Adafruit CAD) in clear heat-shrink -----------
    bw_, bnew = import_glb(os.path.join(CAD, 'boost.glb'), 'boost')
    bw_.scale = (1000, 1000, 1000)
    # the STEP carries no colours: black solder mask, silver parts, like the real board
    for o in bnew:
        if o.type == 'MESH':
            big = max(o.dimensions) > 0.010
            o.data.materials.clear()
            o.data.materials.append(mat('black' if big else 'silver'))
    bw_.rotation_euler = (math.radians(90), 0, 0)
    bpy.context.view_layer.update()
    bmn, bmx = world_bbox(bnew)
    if (bmx.z - bmn.z) > (bmx.y - bmn.y):
        bw_.rotation_euler = (0, 0, 0)
        bpy.context.view_layer.update()
        bmn, bmx = world_bbox(bnew)
    bw_.location += Vector((BOOST[0] - (bmn.x + bmx.x) / 2, BOOST[1] - (bmn.y + bmx.y) / 2, 3 + 1.2 - bmn.z))
    bpy.context.view_layer.update()
    bmn, bmx = world_bbox(bnew)
    TB['boost'] = (bmn + bmx) / 2
    TB['boost_dims'] = bmx - bmn
    sh_ = box('boost', (bmx.x - bmn.x + 2, bmx.y - bmn.y + 2, bmx.z - bmn.z + 2), TB['boost'], 'shrink', bevel=0.8)
    sh_.name = 'shrink'
    TB['boost_in'] = Vector((TB['boost'].x, bmn.y + 1, TB['boost'].z))   # input end, towards the grommet
    TB['boost_out'] = Vector((TB['boost'].x, bmx.y - 1, TB['boost'].z))  # output end, towards the PMS7003

    # ---------------- sensors in the lower room -----------------
    # PMS7003: 48 x 37 x 12 mm, inlet and outlet on the front long face
    px, py, pz0 = PMS_X, PMS_Y, 5.7
    box('pms', (48, 37, 12), (px, py, pz0 + 6), 'silver', bevel=0.6)
    box('pms', (46, 35, 0.3), (px, py, pz0 + 12.16), 'label')
    for x in (-16, -6):
        box('pms', (7, 0.5, 6.5), (px + x, py - 18.6, pz0 + 6), 'ink')
    for i in range(5):
        box('pms', (1.2, 0.5, 6.5), (px + 6 + i * 3, py - 18.6, pz0 + 6), 'ink')
    box('pms', (9, 4, 3.6), (px + 14, py + 18.5 + 2, pz0 + 9), 'black')     # 1.27 mm socket + adapter
    box('pms', (20, 14, 1.6), (px + 14, py + 18.5 + 4 + 7, pz0 + 9), 'black')  # Soldered adapter board
    TB['pms'] = Vector((px, py, pz0 + 6))
    TB['pms_conn'] = Vector((px + 14, py + 18.5 + 11, pz0 + 10.6))
    # BME280: GY-BME280 purple breakout, 15 x 11.5 mm, on a post, wires up
    bx, by, bz = BME_X, BME_Y, 3 + 9.8 + 0.1
    box('bme', (15, 11.5, 1.6), (bx, by, bz + 0.8), 'purple')
    box('bme', (2.5, 2.5, 0.9), (bx + 2, by, bz + 2.05), 'silver')
    for i in range(4):
        box('bme', (1.0, 1.4, 0.1), (bx - 6, by - 3.8 + i * 2.54, bz + 1.65), 'gold')
    TB['bme'] = Vector((bx, by, bz + 1.6))

    # ---------------- gland on the front wall, at the T-Beam's USB ----------
    gx, gz = TB['usb'].x, TB['usb'].z
    hole(front, (gx, -BD / 2 + T / 2, gz), 6.2, 'y')
    cyl('gland', 8.0, 3, (gx, -BD / 2 - 1.5, gz), 'rubber', rot=(math.radians(90), 0, 0), verts=6)
    cyl('gland', 6.8, 9, (gx, -BD / 2 - 3 - 4.5, gz), 'rubber', rot=(math.radians(90), 0, 0))
    cyl('gland', 4.5, 4, (gx, -BD / 2 - 12 - 2, gz), 'rubber', rot=(math.radians(90), 0, 0))
    cyl('gland', 6.0, 8, (gx, -BD / 2 + T + 4, gz), 'rubber', rot=(math.radians(90), 0, 0), verts=6)  # lock nut
    cyl('gland', 6.0, T + 0.2, (gx, -BD / 2 + T / 2, gz), 'rubber', rot=(math.radians(90), 0, 0))  # thread
    TB['gland_out'] = Vector((gx, -BD / 2 - 14, gz))
    TB['gland_in'] = Vector((gx, -BD / 2 + T + 8, gz))

    # ---------------- lid + panel brackets + panel -----------------
    box('lid', (BW + 4, BD + 4, LID), (0, 0, UH1 + LID / 2), 'lid', bevel=0.8)
    box('lid', (BW - 2 * T - 0.4, BD - 2 * T - 0.4, 2.0), (0, 0, UH1 - 1.0 - 0.1), 'lid')  # locating lip
    for sx in (-1, 1):
        for sy in (-1, 1):
            cyl('lid', 2.8, 0.6, (sx * (BW / 2 - 7), sy * (BD / 2 - 7), UH1 + LID + 0.3), 'grey')
    # panel above the lid, tilted 30 deg to face south (towards the viewer)
    C = Vector((0, 0, UH1 + LID + 62))
    R = Euler((TILT, 0, 0)).to_matrix()
    u, v, n = R @ Vector((1, 0, 0)), R @ Vector((0, 1, 0)), R @ Vector((0, 0, 1))
    pe = GROUPS['panel']
    o = box('panel', (PW, PD, PT), C, 'frame', bevel=0.5)
    o.rotation_euler = (TILT, 0, 0)
    nx, ny = 6, 4
    cw, ch = (PW - 10) / nx, (PD - 10) / ny
    for i in range(nx):
        for j in range(ny):
            p = C + u * (-(PW - 10) / 2 + cw * (i + .5)) + v * (-(PD - 10) / 2 + ch * (j + .5)) + n * (PT / 2 + 0.15)
            o = box('panel', (cw - 1.2, ch - 1.2, 0.3), p, 'panel')
            o.rotation_euler = (TILT, 0, 0)
    jb = C + u * (-20) + v * (-28) - n * (PT / 2 + 3)
    o = box('panel', (22, 16, 6), jb, 'black')
    o.rotation_euler = (TILT, 0, 0)
    TB['jb'] = jb - n * 3
    # four printed brackets from the lid to the panel underside
    for su in (-1, 1):
        for sv in (-1, 1):
            a = C + u * (su * (PW / 2 - 14)) + v * (sv * (PD / 2 - 16)) - n * (PT / 2 + 0.2)
            b = Vector((a.x, a.y, UH1 + LID + 0.1))
            strut('lid', b, a, 7, 'shell_d')
    TB['panel_c'] = C

    # ---------------- pole and clamps -----------------
    PR = 24.0
    py_ = BD / 2 + 16 + PR + 0.6
    TB['pole'] = Vector((0, py_, 0))
    if shots_pole:
        cyl('mount', PR, 1600, (0, py_, 100), 'pole', verts=64)
        for z in (14, UH1 - 14):
            torus('mount', PR + 1.4, 1.2, (0, py_, z), 'grey_d')

    # ---------------- wires (shown assembled only) -----------------
    # panel lead: junction box -> forward past the lid -> down -> gland -> USB plug
    gout, gin = TB['gland_out'], TB['gland_in']
    jbb = TB['jb']
    wire('cables', [jbb, jbb + Vector((0, 0, -10)), Vector((jbb.x + 8, -BD / 2 - 12, UH1 + LID + 10)),
                    Vector((gout.x, -BD / 2 - 26, gout.z + 16)), Vector((gout.x, -BD / 2 - 26, gout.z)), gout], 'black', 1.6)
    plug_end = Vector((TB['usb'].x, TB['usb'].y - 0.3, TB['usb'].z))
    box('cables', (9, 14, 5.5), plug_end + Vector((0, -7.3, 0)), 'black')   # micro-USB plug body
    wire('cables', [gin + Vector((0, 4, 0)), plug_end + Vector((0, -14.6, 0))], 'black', 1.6)
    # T-Beam header -> grommet -> sensors. Back-edge wires arc over the board.
    g = Vector((GROM[0], GROM[1], DZ + T / 2))

    def through(a, k, n, to, col, up=6):
        o = Vector(((k - (n - 1) / 2) * 0.95, ((k % 2) - 0.5) * 1.0, 0))
        top = max(a.z, TB['pcb_top'] + 8) + up
        wire('wires', [a, a + Vector((0, 0, 6)), Vector((a.x - 2, (a.y + g.y) / 2, top)), g + o + Vector((0, 0, 12)),
                       g + o, g + o + Vector((0, 0, -8)), Vector((to.x, to.y, 26)) + o * 0.5, to + Vector((0, 0, 5)), to], col, 0.45)
    hb, hf = TB['hdr_back'], TB['hdr_front']
    pc = TB['pms_conn']
    bt = [TB['bme'] + Vector((-6, -3.8 + i * 2.54, 0.15)) for i in range(4)]
    bi, bo = TB['boost_in'], TB['boost_out']
    # BME280: 3V3, GND, SDA 21, SCL 22
    through(hb[0], 0, 9, bt[0], 'red')
    through(hb[1], 1, 9, bt[1], 'black')
    through(hb[3], 2, 9, bt[2], 'yellow')
    through(hb[2], 3, 9, bt[3], 'blue')
    # MiniBoost input: second 3V3 and GND (front edge)
    through(hb[4], 4, 9, bi + Vector((-2, 0, 0)), 'red')
    through(hf[0], 5, 9, bi + Vector((2, 0, 0)), 'black', up=2)
    # PMS7003 data: TX -> 13, RX <- 14
    through(hf[1], 6, 9, pc + Vector((1.27, 0, 0)), 'green', up=2)
    through(hf[2], 7, 9, pc + Vector((3.81, 0, 0)), 'white', up=2)
    # MiniBoost output -> PMS7003 VCC and GND
    for dx, col in ((-2, 'red'), (2, 'black')):
        a = bo + Vector((dx, 0, 0))
        b = pc + Vector((-3.81 if col == 'red' else -1.27, 0, 0))
        wire('wires', [a, a + Vector((0, 6, 3)), Vector((b.x, b.y - 8, 22)), b + Vector((0, 0, 4)), b], col, 0.45)
    return TB


# ----------------------------------------------------------------- explode
def set_explode(f):
    for k, e in GROUPS.items():
        e.location = EXPLODE[k] * f


def mesh_of(o, dg):
    ev = o.evaluated_get(dg)
    try:
        me = ev.to_mesh()
    except RuntimeError:
        return None
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.transform(o.matrix_world)
    ev.to_mesh_clear()
    return bm


def collisions(allow=()):
    """Triangle-level overlap test between groups. Returns offending pairs."""
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    trees = {}
    for k, e in GROUPS.items():
        bm = bmesh.new()
        for o in bpy.data.objects:
            if o.type not in ('MESH', 'CURVE') or o.hide_render:
                continue
            p = o
            while p.parent and p.parent.name not in GROUPS:
                p = p.parent
            if p.parent is None or p.parent.name != k:
                continue
            m = mesh_of(o, dg)
            if m:
                tmp = bpy.data.meshes.new('t')
                m.to_mesh(tmp)
                bm.from_mesh(tmp)
                bpy.data.meshes.remove(tmp)
                m.free()
        if len(bm.faces):
            trees[k] = BVHTree.FromBMesh(bm)
        bm.free()
    bad = []
    ks = sorted(trees)
    for i in range(len(ks)):
        for j in range(i + 1, len(ks)):
            a, b = ks[i], ks[j]
            if (a, b) in allow or (b, a) in allow:
                continue
            n = len(trees[a].overlap(trees[b]))
            if n:
                bad.append((a, b, n))
    return bad


# ----------------------------------------------------------------- render
def setup(res, bg=None):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sh = sc.display.shading
    sh.light = 'STUDIO'
    sh.studio_light = 'paint.sl'
    sh.color_type = 'MATERIAL'
    sh.show_object_outline = True
    sh.object_outline_color = hexc('#0c2231')
    sh.show_cavity = True
    sh.cavity_type = 'BOTH'
    sh.cavity_ridge_factor = 1.0
    sh.curvature_ridge_factor = 0.8
    sh.show_specular_highlight = True
    sc.display.render_aa = '16'
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.view_settings.view_transform = 'Standard'
    sc.render.image_settings.file_format = 'PNG'
    if bg is None:
        sc.render.film_transparent = True
        sc.render.image_settings.color_mode = 'RGBA'
    else:
        sc.render.film_transparent = False
        sc.render.image_settings.color_mode = 'RGB'
        if not sc.world:
            sc.world = bpy.data.worlds.new('w')
        sc.world.color = lin(hexc(bg))


def camera(target, direction, scale, parent=None):
    sc = bpy.context.scene
    cam = bpy.data.cameras.new('cam')
    cam.type = 'ORTHO'
    cam.ortho_scale = scale
    cam.clip_end = 100000
    co = bpy.data.objects.new('cam', cam)
    sc.collection.objects.link(co)
    d = Vector(direction).normalized()
    co.location = Vector(target) + d * 3000
    co.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    if parent:
        co.parent = parent
    sc.camera = co
    return co


def render(name, anchors=None):
    sc = bpy.context.scene
    bpy.context.view_layer.update()
    sc.render.filepath = os.path.join(OUT, name + '.png')
    bpy.ops.render.render(write_still=True)
    res = (sc.render.resolution_x, sc.render.resolution_y)
    pts = {}
    for k, v in (anchors or {}).items():
        p = world_to_camera_view(sc, sc.camera, Vector(v))
        pts[k] = [p.x * res[0], (1 - p.y) * res[1]]
    json.dump({'size': list(res), 'anchors': pts}, open(os.path.join(OUT, name + '.json'), 'w'))
    print('RENDERED', name)


def hide_group(k, hide=True):
    for o in bpy.data.objects:
        p = o
        while p.parent and p.parent.name not in GROUPS:
            p = p.parent
        if p.parent and p.parent.name == k:
            o.hide_render = hide


# ----------------------------------------------------------------- jobs
ALLOW = {
    ('upper', 'lower'),            # divider sits on the corner posts
    ('upper', 'lid'),              # lid lip inside the walls
    ('upper', 'gland'),            # gland through its hole
    ('upper', 'mount'),            # brackets around the pole clamp
    ('lower', 'boost'),            # booster taped to the sensor-room floor
    ('panel', 'lid'),              # brackets touch the panel underside
    ('cables', 'panel'), ('cables', 'gland'), ('cables', 'tbeam'),   # lead into the junction box, gland, USB
    ('wires', 'tbeam'), ('wires', 'boost'), ('wires', 'pms'), ('wires', 'bme'),  # wire ends at their pins
    ('antenna', 'tbeam'),          # antenna screwed onto the T-Beam's SMA jack
    ('lower', 'pms'), ('lower', 'bme'),   # sensors on their feet / post
}


def detail(ga, gb):
    dg = bpy.context.evaluated_depsgraph_get()
    def objs(k):
        r = []
        for o in bpy.data.objects:
            if o.type not in ('MESH', 'CURVE') or o.hide_render:
                continue
            p = o
            while p.parent and p.parent.name not in GROUPS:
                p = p.parent
            if p.parent and p.parent.name == k:
                m = mesh_of(o, dg)
                if m and len(m.faces):
                    r.append((o, BVHTree.FromBMesh(m)))
        return r
    out = []
    for a, ta in objs(ga):
        for b, tb in objs(gb):
            n = len(ta.overlap(tb))
            if n:
                mn, mx = world_bbox([a]) if a.type == 'MESH' else (Vector(), Vector())
                out.append((a.name, b.name, n, [round(v, 1) for v in mn], [round(v, 1) for v in mx]))
    return out


def job_check():
    build()
    set_explode(0)
    bad = collisions(ALLOW)
    print('COLLISIONS', json.dumps(bad))
    for a, b, n in bad:
        print('DETAIL', a, b, json.dumps(detail(a, b)))
    for a, b in sorted(ALLOW):
        if a in GROUPS and b in GROUPS:
            for row in detail(a, b):
                print('ALLOWED', a, b, json.dumps(row))
    print('TB', json.dumps({k: (list(v) if isinstance(v, Vector) else v) for k, v in TB.items() if not isinstance(v, list)}))
    # also check the whitelisted pairs only touch, by reporting their counts
    allowed = []
    bpy.context.view_layer.update()
    print('ALLOWED_INFO done')


def job_stills():
    W = os.path.join
    # 1 hero on the pole
    build(); set_explode(0)
    setup((1800, 4200))
    camera((0, 0, 110), (1, -1.3, 0.55), 680)
    render('node_pole', {'ant': TB['ant_top'], 'panel': TB['panel_c'], 'gland': TB['gland_out'],
                         'louvre': (-BW / 2, -BD / 2, 18)})
    # 2 assembled product shot without pole
    build(False); set_explode(0)
    setup((2400, 2200))
    camera((0, 0, 80), (1, -1.3, 0.75), 330)
    render('node', None)
    # 3 exploded
    build(False); set_explode(1)
    hide_group('cables'); hide_group('wires')
    setup((2200, 3600))
    camera((0, 0, 90), (1, -1.3, 0.62), 640)
    E = lambda k, p: Vector(p) + EXPLODE[k]
    render('exploded', {
        'panel': E('panel', TB['panel_c']), 'lid': E('lid', (BW / 2, -BD / 2, UH1 + 2)),
        'ant': E('antenna', TB['ant_top']), 'tbeam': E('tbeam', (TB['xc'] - 10, TB['yc'], TB['pcb_top'] + 4)),
        'boost': E('boost', TB['boost']),
        'upper': E('upper', (BW / 2, -BD / 2, UH1 - 20)), 'gland': E('gland', TB['gland_out']),
        'pms': E('pms', TB['pms']), 'bme': E('bme', TB['bme']), 'lower': E('lower', (BW / 2, -BD / 2, 14)),
    })
    # 4 cutaway: front and right walls, lid and panel removed
    build(False); set_explode(0)
    hide_group('lid'); hide_group('panel'); hide_group('gland'); hide_group('cables')
    for o in bpy.data.objects:
        if o.type == 'MESH' and o.parent == GROUPS['upper']:
            mn, mx = world_bbox([o])
            if (mx.y < -BD / 2 + T + 0.1 and mx.z > TOPF + 5) or (mn.x > BW / 2 - T - 0.1):
                o.hide_render = True
        if o.type == 'MESH' and o.parent == GROUPS['lower']:
            mn, mx = world_bbox([o])
            cy_, cx_ = (mn.y + mx.y) / 2, (mn.x + mx.x) / 2
            if (cy_ < -BD / 2 + 6 and mx.z > 6 and (mx.x - mn.x) > 20) or (cx_ > BW / 2 - 6 and (mx.y - mn.y) > 20 and mx.z > 6):
                o.hide_render = True
    setup((2600, 2200))
    camera((0, 0, 45), (1, -1.25, 0.95), 250)
    render('cutaway', {
        'tbeam': (TB['xc'] + 10, TB['yc'] - 5, TB['pcb_top'] + 6), 'hdr': TB['hdr_back'][2],
        'grommet': (GROM[0], GROM[1], DZ + T), 'usb': TB['usb'], 'ant': TB['ant_top'],
    })
    # 4b the sensor room alone
    build(False); set_explode(0)
    for k in ('upper', 'lid', 'panel', 'tbeam', 'antenna', 'gland', 'cables', 'wires', 'mount'):
        hide_group(k)
    setup((2400, 1600))
    camera((0, 0, 10), (1, -1.3, 1.1), 200)
    render('lower_room', {'pms': TB['pms'] + Vector((-10, -18, 0)), 'inlet': (PMS_X - 16, PMS_Y - 18.6, 11.7),
                          'boost': TB['boost'],
                          'bme': TB['bme'], 'louvre': (-BW / 2 + 2, -20, 20), 'adapter': TB['pms_conn']})
    # 5 top view of the top room (for the layout drawing)
    build(False); set_explode(0)
    hide_group('lid'); hide_group('panel'); hide_group('mount')
    setup((2400, 1700))
    co = camera((0, 0, 0), (0, 0, 1), 200)
    co.rotation_euler = (0, 0, 0)
    render('top_room', None)


def job_anim(theme='light', frames=150, res=(960, 960)):
    bg = {'light': '#ffffff', 'dark': '#0e2330'}[theme]
    build(False)
    setup(res, bg)
    if theme == 'dark':
        bpy.context.scene.display.shading.object_outline_color = hexc('#06131b')
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end = 1, frames
    sc.render.fps = 30
    rig = bpy.data.objects.new('rig', None)
    sc.collection.objects.link(rig)
    rig.location = (0, 0, 95)
    cam = camera((0, 0, 0), (1, -1.3, 0.62), 380, rig)
    # timeline: hold, explode, hold, assemble, hold (seconds at 30 fps)
    keys = [(1, 0), (21, 0), (66, 1), (86, 1), (131, 0), (frames, 0)]

    def ease(t):
        return t * t * (3 - 2 * t)
    for fr in range(1, frames + 1):
        for (f0, a), (f1, b) in zip(keys, keys[1:]):
            if f0 <= fr <= f1:
                t = 0 if f1 == f0 else (fr - f0) / (f1 - f0)
                x = a + (b - a) * ease(t)
                break
        set_explode(x)
        for k in GROUPS:
            GROUPS[k].keyframe_insert('location', frame=fr)
        hidden = x > 0.02
        for o in bpy.data.objects:
            p = o
            while p.parent and p.parent.name not in GROUPS:
                p = p.parent
            if p.parent and p.parent.name in WIRES:
                o.hide_render = hidden
                o.keyframe_insert('hide_render', frame=fr)
        rig.rotation_euler = (0, 0, math.radians(-14 * math.cos(2 * math.pi * (fr - 1) / frames)))
        rig.keyframe_insert('rotation_euler', frame=fr)
        rig.location = (0, 0, 95 + 62 * x)
        rig.keyframe_insert('location', frame=fr)
        cam.data.ortho_scale = 380 + 330 * x
        cam.data.keyframe_insert('ortho_scale', frame=fr)
    sc.render.filepath = os.path.join(OUT, f'anim_{theme}', 'f_')
    bpy.ops.render.render(animation=True)
    print('ANIM', theme)


def fit_render(name, groups, direction=(1, -1.3, 0.9), res=(1600, 1200), pad=1.15):
    keep = set(groups)
    for k in GROUPS:
        hide_group(k, k not in keep)
    objs = []
    for o in bpy.data.objects:
        if o.type in ('MESH', 'CURVE') and not o.hide_render:
            objs.append(o)
    mn, mx = world_bbox([o for o in objs if o.type == 'MESH'])
    c = (mn + mx) / 2
    size = max((mx - mn).length, 10)
    setup(res)
    camera(c, direction, size * pad)
    render(name)


def job_parts():
    build(False); set_explode(0)
    fit_render('part_tbeam', ['tbeam', 'antenna'])
    fit_render('part_pms', ['pms'])
    fit_render('part_bme', ['bme'], pad=1.4)
    fit_render('part_panel', ['panel'])
    fit_render('part_gland', ['gland'], pad=1.4)
    fit_render('part_box', ['lower', 'upper', 'lid'])
    # the MiniBoost alone (Adafruit CAD)
    cad = bpy.data.objects['boost_cad']
    for o in bpy.data.objects:
        if o.type in ('MESH', 'CURVE'):
            p_, inside = o, False
            while p_.parent:
                p_ = p_.parent
                if p_ == cad:
                    inside = True
            o.hide_render = not inside
    objs = [o for o in bpy.data.objects if o.type == 'MESH' and not o.hide_render]
    mn, mx = world_bbox(objs)
    setup((1400, 1100))
    camera((mn + mx) / 2, (1, -1.3, 1.1), (mx - mn).length * 1.2)
    render('part_boost')
    # 18650 cell
    build(False)
    group('cell')
    cyl('cell', 9.15, 62, (0, 0, 0), 'cell', rot=(0, math.radians(90), 0))
    cyl('cell', 9.2, 3, (31, 0, 0), 'white', rot=(0, math.radians(90), 0))
    cyl('cell', 3.5, 1.5, (33.2, 0, 0), 'silver', rot=(0, math.radians(90), 0))
    cyl('cell', 9.2, 1, (-31.5, 0, 0), 'silver', rot=(0, math.radians(90), 0))
    fit_render('part_cell', ['cell'], pad=1.3)
    # Dragino DLOS8N: 260 x 90 x 85 mm body, fibreglass antenna on top
    build(False)
    group('gw')
    box('gw', (90, 85, 260), (0, 0, 130), 'white', bevel=6)
    box('gw', (70, 2, 24), (0, -43, 225), 'shell_d')
    for x in (-25, 0, 25):
        cyl('gw', 6, 12, (x, 0, -6), 'grey_d')
    cyl('gw', 14, 30, (0, 0, 275), 'grey_d')
    cyl('gw', 10, 560, (0, 0, 290 + 280), 'white')
    box('gw', (30, 30, 70), (0, 57, 130), 'grey')
    fit_render('part_gateway', ['gw'], direction=(1, -1.3, 0.5), res=(900, 1800), pad=1.05)


def job_scrub(frames=60, res=(900, 900)):
    """Frames for the scroll-driven explode on the website: transparent, so one set
    serves both themes, plus each label's position in every frame."""
    build(False)
    setup(res)
    sc = bpy.context.scene
    rig = bpy.data.objects.new('rig', None)
    sc.collection.objects.link(rig)
    cam = camera((0, 0, 0), (1, -1.3, 0.62), 380, rig)
    pts = {
        'panel': ('panel', TB['panel_c']),
        'antenna': ('antenna', TB['ant_top']),
        'tbeam': ('tbeam', Vector((TB['xc'] - 10, TB['yc'], TB['pcb_top'] + 4))),
        'boost': ('boost', TB['boost']),
        'pms': ('pms', TB['pms'] + Vector((0, -18, 0))),
        'bme': ('bme', TB['bme']),
    }
    os.makedirs(os.path.join(OUT, 'scrub'), exist_ok=True)
    track = {k: [] for k in pts}
    for i in range(frames):
        x = i / (frames - 1)
        set_explode(x)
        hidden = x > 0.02
        for o in bpy.data.objects:
            p_ = o
            while p_.parent and p_.parent.name not in GROUPS:
                p_ = p_.parent
            if p_.parent and p_.parent.name in WIRES:
                o.hide_render = hidden
        rig.location = (0, 0, 92 + 58 * x)
        rig.rotation_euler = (0, 0, math.radians(-10 + 20 * x))
        cam.data.ortho_scale = 360 + 270 * x
        bpy.context.view_layer.update()
        for k, (g, p) in pts.items():
            v = world_to_camera_view(sc, sc.camera, Vector(p) + EXPLODE[g] * x)
            track[k].append([round(v.x, 4), round(1 - v.y, 4)])
        sc.render.filepath = os.path.join(OUT, 'scrub', f'f_{i:03d}.png')
        bpy.ops.render.render(write_still=True)
    json.dump(track, open(os.path.join(OUT, 'scrub', 'labels.json'), 'w'))
    print('SCRUB', frames)


# ================================================================== gateway
# Dragino DLOS8N, outside only, from Dragino's enclosure drawings (DLOS8
# Enclosure-01..03): body 260 mm tall, 91 mm wide, 82.4 mm deep; round front,
# flat back with a mounting plate. Dragino publishes no 3D model and no internal
# layout, so the inside is not drawn.
GW_R, GW_D = 45.5, 82.4
GW_BACK = GW_D - GW_R          # flat back at y = +36.9
GW_H = 260.0
GW_Z = (0.0, 32.0, 198.0, GW_H)  # bottom cap | body | top cap


def gw_profile(g, z0, z1, color, grow=0.0, name='prof'):
    r = GW_R + grow
    h = z1 - z0
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, location=(0, 0, z0 + h / 2), vertices=96)
    o = bpy.context.active_object
    o.name = name
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, GW_BACK + grow - 200, z0 + h / 2))
    c = bpy.context.active_object
    c.scale = (400, 400, h + 2)
    c.hide_render = c.hide_viewport = True
    md = o.modifiers.new('cut', 'BOOLEAN')
    md.operation = 'INTERSECT'
    md.object = c
    md.solver = 'EXACT'
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.modifier_apply(modifier='cut')
    bpy.data.objects.remove(c)
    for p_ in o.data.polygons:
        p_.use_smooth = False
    return _finish(o, color, g)


def build_gateway(mast=True):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear(); GROUPS.clear(); EXPLODE.clear(); WIRES.clear(); TB.clear()
    group('gw_ant', (-90, 0, 120))
    group('gw_top', (0, 0, 80))
    group('gw_body', (0, 0, 0))
    group('gw_bot', (0, 0, -70))
    group('gw_plate', (0, 70, 0))
    group('gw_mast', (0, 70, 0))
    group('gw_coax', wire=True)
    z0, z1, z2, z3 = GW_Z
    gw_profile('gw_bot', z0, z1 - 0.3, 'white')
    gw_profile('gw_body', z1, z2 - 0.3, 'white')
    gw_profile('gw_top', z2, z3, 'white')
    # rib bands, as drawn near both ends
    for z in (z0 + 8, z0 + 19):
        gw_profile('gw_bot', z, z + 3.5, 'shell_d', grow=0.8)
    for z in (z2 + 10, z2 + 22, z2 + 36, z2 + 48):
        gw_profile('gw_top', z, z + 3.5, 'shell_d', grow=0.8)
    # status LED window on the front of the top cap (8 LEDs in the drawing)
    box('gw_top', (52, 1.0, 9), (0, -GW_R - 0.2, z2 + 29.5), 'ink', bevel=0.3)
    for i in range(8):
        box('gw_top', (2.2, 0.4, 2.2), (-19.25 + i * 5.5, -GW_R - 0.8, z2 + 29.5),
            'green' if i < 3 else 'grey')
    # Dragino's photos: the fibreglass antenna is separate, clamped to the same
    # pole above the gateway, and joined by a short coax to the LoRa socket
    # inside the bottom end cap (next to the Ethernet, USB and DC ports).
    py = GW_BACK + 6.4 + 22 + 25
    ax, ay, az = -42, py - 22, z3 + 70
    box('gw_ant', (30, 14, 14), (ax + 12, py - 26.4 - 7, az + 20), 'grey')     # clamp arm to the pole
    torus('gw_ant', 26.4, 1.6, (0, py, az + 20), 'grey_d')
    cyl('gw_ant', 8, 40, (ax, ay, az), 'silver')                               # N-type base
    cyl('gw_ant', 8, 330, (ax, ay, az + 20 + 165 + 0.2), 'white')
    sphere('gw_ant', 8, (ax, ay, az + 20 + 330 + 0.2), 'white')
    TB['gw_ant'] = Vector((ax, ay, az + 220))
    # two cable glands in the bottom cap: PoE Ethernet, and the antenna coax
    for x in (-18, 18):
        cyl('gw_bot', 6.5, 4, (x, 14, z0 - 2.2), 'grey_d', verts=6)
        cyl('gw_bot', 5.5, 10, (x, 14, z0 - 9.2), 'grey_d')
    wire('gw_bot', [Vector((18, 14, z0 - 14)), Vector((18, 14, z0 - 40)), Vector((26, 26, z0 - 70))], 'ink', 3.0)
    # antenna coax: from the antenna base, down beside the body, into the bottom cap
    wire('gw_coax', [Vector((ax, ay, az - 20.5)), Vector((ax - 8, ay - 4, az - 60)), Vector((-60, 18, 150)),
                     Vector((-60, 18, 30)), Vector((-36, 14, z0 - 30)), Vector((-18, 14, z0 - 14.2))], 'black', 2.2)
    # mounting plate on the flat back (4 screws), bracket, pole clamps
    box('gw_plate', (60, 6, 96), (0, GW_BACK + 3.2, 112), 'grey')
    for sx in (-1, 1):
        for sz in (-1, 1):
            cyl('gw_plate', 3, 1.2, (sx * 22, GW_BACK + 6.6 + 0.2, 112 + sz * 38), 'grey_d',
                rot=(math.radians(90), 0, 0), verts=16)
    for z in (82, 142):
        box('gw_plate', (40, 22, 16), (0, GW_BACK + 6.4 + 11, z), 'grey')
        torus('gw_mast', 26.4, 1.6, (0, py, z), 'grey_d')
    if mast:
        cyl('gw_mast', 25, 1400, (0, py, 60), 'pole', verts=64)
    TB['gw_top'] = Vector((GW_R * 0.7, -GW_R * 0.7, z2 + 30))
    TB['gw_body'] = Vector((GW_R * 0.7, -GW_R * 0.7, (z1 + z2) / 2))
    TB['gw_bot'] = Vector((0, 14, z0 - 9))
    TB['gw_plate'] = Vector((-30, GW_BACK + 6, 112))
    TB['gw_leds'] = Vector((0, -GW_R - 1, z2 + 29.5))


GW_ALLOW = {('gw_plate', 'gw_mast'), ('gw_body', 'gw_plate'), ('gw_ant', 'gw_mast'),
            ('gw_top', 'gw_plate'), ('gw_bot', 'gw_plate'), ('gw_coax', 'gw_ant'), ('gw_coax', 'gw_bot')}


def job_gw_check():
    build_gateway()
    set_explode(0)
    bad = collisions(GW_ALLOW)
    print('GW_COLLISIONS', json.dumps(bad))
    for a, b, n in bad:
        print('GW_DETAIL', a, b, json.dumps(detail(a, b)))


def job_gw_stills():
    build_gateway()
    set_explode(0)
    setup((1600, 3200))
    camera((0, 0, 330), (1, -1.3, 0.45), 780)
    render('gw_mast', None)
    build_gateway()
    set_explode(0)
    setup((1000, 1800))
    camera((0, 0, 300), (1, -1.3, 0.45), 700)
    render('part_gateway', None)
    build_gateway(mast=False)
    set_explode(1)
    hide_group('gw_coax')
    setup((1600, 3000))
    camera((0, 0, 300), (1, -1.3, 0.55), 1000)
    E = lambda k, p: Vector(p) + EXPLODE[k]
    render('gw_exploded', {k: E(k, TB[k]) for k in ('gw_ant', 'gw_top', 'gw_body', 'gw_bot', 'gw_plate')})


def job_gw_scrub(frames=60, res=(840, 1120)):
    build_gateway(mast=False)
    setup(res)
    sc = bpy.context.scene
    rig = bpy.data.objects.new('rig', None)
    sc.collection.objects.link(rig)
    cam = camera((0, 0, 0), (1, -1.3, 0.55), 520, rig)
    pts = {'antenna': 'gw_ant', 'leds': 'gw_top', 'body': 'gw_body', 'cables': 'gw_bot', 'mount': 'gw_plate'}
    anchor = {'antenna': TB['gw_ant'], 'leds': TB['gw_leds'], 'body': TB['gw_body'],
              'cables': TB['gw_bot'], 'mount': TB['gw_plate']}
    os.makedirs(os.path.join(OUT, 'gw_scrub'), exist_ok=True)
    track = {k: [] for k in pts}
    for i in range(frames):
        x = i / (frames - 1)
        set_explode(x)
        for o in bpy.data.objects:
            if o.parent == GROUPS['gw_coax']:
                o.hide_render = x > 0.02
        rig.location = (0, 0, 300 + 30 * x)
        rig.rotation_euler = (0, 0, math.radians(-12 + 24 * x))
        cam.data.ortho_scale = 800 + 240 * x
        bpy.context.view_layer.update()
        for k, g in pts.items():
            v = world_to_camera_view(sc, sc.camera, anchor[k] + EXPLODE[g] * x)
            track[k].append([round(v.x, 4), round(1 - v.y, 4)])
        sc.render.filepath = os.path.join(OUT, 'gw_scrub', f'g_{i:03d}.png')
        bpy.ops.render.render(write_still=True)
    json.dump(track, open(os.path.join(OUT, 'gw_scrub', 'labels.json'), 'w'))
    print('GW_SCRUB', frames)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for j in JOBS:
        if j == 'check':
            job_check()
        elif j == 'stills':
            job_stills()
        elif j == 'gw_check':
            job_gw_check()
        elif j == 'gw_stills':
            job_gw_stills()
        elif j == 'gw_scrub':
            job_gw_scrub()
        elif j == 'scrub':
            job_scrub()
        elif j == 'parts':
            job_parts()
        elif j.startswith('anim'):
            job_anim(j.split('_')[1] if '_' in j else 'light')
