import sharp from "sharp";
import { writeFileSync } from "node:fs";

const SRC = "C:/Users/WIRELEX/InfoPay/brand/infopay-logo-source.png";
const OUT = "C:/Users/WIRELEX/InfoPay/frontend/public";
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

// Wrap a PNG buffer in a minimal ICO container (modern PNG-in-ICO).
function pngToIco(pngBuffer, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // count
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0); // width
  entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
  entry.writeUInt8(0, 2); // palette
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bpp
  entry.writeUInt32LE(pngBuffer.length, 8); // size
  entry.writeUInt32LE(22, 12); // offset
  return Buffer.concat([header, entry, pngBuffer]);
}

async function main() {
  const meta = await sharp(SRC).metadata();
  const W = meta.width;
  const H = meta.height;
  console.log("source:", W, "x", H);

  // 1) Monogram base: crop the top region (the "1P" mark, above the wordmark),
  // trim the surrounding white, then centre it on a padded white square.
  const cropH = Math.round(H * 0.61);
  const cropped = await sharp(SRC)
    .extract({ left: 0, top: 0, width: W, height: cropH })
    .png()
    .toBuffer();
  const markTrimmed = await sharp(cropped).trim({ threshold: 12 }).toBuffer();

  const tMeta = await sharp(markTrimmed).metadata();
  const side = Math.round(Math.max(tMeta.width, tMeta.height) * 1.18); // ~9% padding
  const markSquare = await sharp({
    create: { width: side, height: side, channels: 4, background: WHITE },
  })
    .composite([{ input: markTrimmed, gravity: "center" }])
    .png()
    .toBuffer();

  // Icon set from the monogram square.
  const iconSizes = {
    "favicon-16x16.png": 16,
    "favicon-32x32.png": 32,
    "apple-touch-icon.png": 180,
    "icon-192.png": 192,
    "icon-512.png": 512,
    "logo-mark.png": 256,
  };
  for (const [name, size] of Object.entries(iconSizes)) {
    await sharp(markSquare)
      .resize(size, size, { fit: "contain", background: WHITE })
      .flatten({ background: WHITE })
      .png()
      .toFile(`${OUT}/${name}`);
    console.log("wrote", name);
  }

  // favicon.ico (32x32 PNG-in-ICO)
  const ico32 = await sharp(markSquare)
    .resize(32, 32, { fit: "contain", background: WHITE })
    .flatten({ background: WHITE })
    .png()
    .toBuffer();
  writeFileSync(`${OUT}/favicon.ico`, pngToIco(ico32, 32));
  console.log("wrote favicon.ico");

  // 2) Full logo, flattened on white, capped at 1024 wide.
  await sharp(SRC)
    .trim({ threshold: 12 })
    .resize({ width: 1024, withoutEnlargement: true })
    .flatten({ background: WHITE })
    .png()
    .toFile(`${OUT}/logo.png`);
  console.log("wrote logo.png");

  // 3) OpenGraph 1200x630: full logo centred on white with padding.
  const logoForOg = await sharp(SRC)
    .trim({ threshold: 12 })
    .resize({ height: 470, width: 1000, fit: "inside", withoutEnlargement: true })
    .toBuffer();
  await sharp({
    create: { width: 1200, height: 630, channels: 4, background: WHITE },
  })
    .composite([{ input: logoForOg, gravity: "center" }])
    .png()
    .toFile(`${OUT}/og-image.png`);
  console.log("wrote og-image.png");

  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
