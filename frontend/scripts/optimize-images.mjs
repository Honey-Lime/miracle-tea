// Одноразовый скрипт: делает WebP/AVIF-версии PNG из public/ и манифест размеров.
// Запуск: npm run images
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
const outDir = path.join(publicDir, "img");
const manifestPath = path.join(root, "src", "data", "imageManifest.json");

const DEFAULT_WIDTHS = [640, 1280, 1976];
const sources = [
  { name: "firstscreen" },
  { name: "homepage1" },
  { name: "homepage2" },
  { name: "homepage3" },
  { name: "leaf1" },
  { name: "leaf2" },
  { name: "leaf3" },
  { name: "leaf4" },
  { name: "first-screen-bg", widths: [1280, 1920] },
];

const formats = [
  { ext: "webp", encode: (image) => image.webp({ quality: 80, effort: 5 }) },
  { ext: "avif", encode: (image) => image.avif({ quality: 55, effort: 4 }) },
];

await mkdir(outDir, { recursive: true });
await mkdir(path.dirname(manifestPath), { recursive: true });

const manifest = {};

for (const { name, widths = DEFAULT_WIDTHS } of sources) {
  const input = path.join(publicDir, `${name}.png`);
  const { width, height } = await sharp(input).metadata();
  const sizes = [...new Set(widths.map((target) => Math.min(target, width)))];

  for (const size of sizes) {
    for (const { ext, encode } of formats) {
      const file = path.join(outDir, `${name}-${size}.${ext}`);
      await encode(sharp(input).resize({ width: size, withoutEnlargement: true })).toFile(file);
    }
  }

  manifest[name] = { width, height, widths: sizes };
  console.log(`${name}: ${sizes.join(", ")}`);
}

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
