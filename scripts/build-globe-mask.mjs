// Rasterises Natural Earth (world-atlas) into an equirectangular mask used by the dot globe:
//   R channel = land, G channel = Azerbaijan.  Output: public/globe/mask.png (4096×2048).
// Dev-only tool. Needs Playwright with Chromium available: `node scripts/build-globe-mask.mjs`,
// then quantise to 3 colours (~55 KB):
//   convert public/globe/mask.png +dither -remap palette.png PNG8:public/globe/mask.png
// where palette.png holds black, red and yellow.
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { feature } from "topojson-client";

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const W = 4096;
const H = 2048;

const land50 = require("world-atlas/land-50m.json");
const countries10 = require("world-atlas/countries-10m.json");
const land = feature(land50, land50.objects.land);
const az = feature(countries10, countries10.objects.countries).features.find((f) => f.properties.name === "Azerbaijan");

// Equirectangular projection, done here so the page only draws paths.
const project = ([lon, lat]) => [((lon + 180) / 360) * W, ((90 - lat) / 180) * H];
const rings = (geo) => {
  const g = geo.type === "FeatureCollection" ? geo.features.map((f) => f.geometry) : [geo.geometry];
  const out = [];
  for (const geom of g) {
    const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
    for (const poly of polys) out.push(poly.map((ring) => ring.map(project)));
  }
  return out;
};

const { chromium } = require("playwright");
const browser = await chromium.launch();
const page = await browser.newPage();
const dataUrl = await page.evaluate(
  ({ W, H, landPolys, azPolys }) => {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    const fill = (polys, color) => {
      ctx.fillStyle = color;
      for (const poly of polys) {
        ctx.beginPath();
        for (const ring of poly) {
          ring.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.closePath();
        }
        ctx.fill("evenodd");
      }
    };
    fill(landPolys, "rgb(255,0,0)");
    ctx.globalCompositeOperation = "lighter";
    fill(azPolys, "rgb(0,255,0)");
    return c.toDataURL("image/png");
  },
  { W, H, landPolys: rings(land), azPolys: rings(az) },
);
await browser.close();

const out = resolve(root, "public/globe/mask.png");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, Buffer.from(dataUrl.split(",")[1], "base64"));
console.log(`globe mask → ${out}`);
