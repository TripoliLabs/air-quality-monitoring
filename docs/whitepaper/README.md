# Qalawun white paper

- [`qalawun-white-paper.pdf`](qalawun-white-paper.pdf): the white paper, A4.
- [`../../hardware/shopping-list.pdf`](../../hardware/shopping-list.pdf): what to buy for the first three boxes.

Both follow the dashboard's brand: Readex Pro, deep-sea ink `#0c2231`, teal
`#0a6788`, sea-haze `#eef4f8` (see `apps/dashboard/src/style.css`).

## Rebuilding

`src/` holds the layout. The pages are HTML printed to PDF with headless Chrome.

1. Render the images with `hardware/render/node.py` and crop them into `img/`,
   with their label anchors in `img/meta.json`.
2. Put Readex Pro (`ReadexPro[HEXP,wght].ttf` from Google Fonts, OFL) next to
   the scripts as `ReadexPro.ttf`.
3. Build and print twice, so the contents page picks up the page numbers:

```bash
python build.py && chrome --headless --no-pdf-header-footer \
  --print-to-pdf=qalawun-white-paper.pdf whitepaper.html
python pages.py qalawun-white-paper.pdf   # writes pages.json
python build.py && chrome --headless --no-pdf-header-footer \
  --print-to-pdf=qalawun-white-paper.pdf whitepaper.html
python shop.py && chrome --headless --no-pdf-header-footer \
  --print-to-pdf=shopping-list.pdf shopping.html
```

The map uses OpenStreetMap tiles (© OpenStreetMap contributors, ODbL).
