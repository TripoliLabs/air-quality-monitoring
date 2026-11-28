# Sensor box 3D model and renders

`node.py` builds the whole sensor box in Blender, checks that no two parts
collide, and renders the stills used in the white paper and the explode/assemble
animation on the About page.

## What is modelled

| Part | Source |
|------|--------|
| LILYGO T-Beam V1.2 | LilyGO's own STEP (`dimensions/T-Beam-V1X.7z` in [LilyGo-LoRa-Series](https://github.com/Xinyuan-LilyGO/LilyGo-LoRa-Series)) |
| Adafruit MiniBoost 5 V 1 A | Adafruit's STEP (`4654 MiniBoost 5V` in [Adafruit_CAD_Parts](https://github.com/adafruit/Adafruit_CAD_Parts), MIT) |
| PMS7003 | Modelled: 48 × 37 × 12 mm, inlet and outlet on the front face |
| BME280 breakout | Modelled: purple 6-pin board, 15 × 11.5 mm |
| Perfboard carrier | Modelled: standard 4 × 6 cm double-sided board, 2.54 mm pitch, two JST-XH plugs, 6-pin header |
| Solar panel | Modelled: 136 × 110 mm (typical 5 V 2 W panel; measure ours) |
| Printed box | Our design: 170 × 110 mm footprint, sealed top room, louvred bottom room |
| DLOS8N gateway | Modelled: 260 × 90 × 85 mm |

The T-Beam has one LoRa antenna. LilyGO's file draws the whip twice (straight and
folded); we drop both and draw it once, screwed on through the right wall and
turned up.

## Run

Blender 4.4, headless. The STEP files are not committed; download them and convert
to glTF first (needs `cadquery-ocp`):

```bash
pip install cadquery-ocp
python step2glb.py T-Beam-V1X-PCB.stp cad/tbeam.glb
python step2glb.py "4654 MiniBoost 5V.step" cad/boost.glb

blender -b --python node.py -- cad out check          # collision check
blender -b --python node.py -- cad out stills parts   # white paper images
blender -b --python node.py -- cad out scrub          # 60 frames + labels.json for the website
```

`check` prints `COLLISIONS []` when nothing intersects. Intended contacts (a wire
ending in its plug, the lid on the walls, the gland through its hole) are listed
in `ALLOW` and printed object by object, so they can be reviewed too.

`scrub` renders the box opening in 60 transparent frames and writes where each
part's label belongs in every frame. Convert them to WebP (quality 72) and copy
them with `labels.json` to `apps/dashboard/src/assets/node/`. The About page
scrubs through them as the reader scrolls (`NodeScroll.vue`).
