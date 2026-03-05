const fs = require("fs");
const path = require("path");

async function main() {
  const sourcePng = path.join(__dirname, "..", "assets", "icons.png");
  const targetIco = path.join(__dirname, "..", "assets", "icon.ico");

  if (!fs.existsSync(sourcePng)) {
    throw new Error(`Missing PNG icon source: ${sourcePng}`);
  }

  let pngToIco;
  try {
    pngToIco = require("png-to-ico");
  } catch (error) {
    throw new Error(
      "Missing dependency 'png-to-ico'. Run `npm install` before building Windows artifacts."
    );
  }

  const sourceStat = fs.statSync(sourcePng);
  if (fs.existsSync(targetIco)) {
    const targetStat = fs.statSync(targetIco);
    if (targetStat.mtimeMs >= sourceStat.mtimeMs && targetStat.size > 0) {
      console.log(`[joincloud] Windows icon ready: ${targetIco}`);
      return;
    }
  }

  const icoBuffer = await pngToIco([sourcePng]);
  fs.writeFileSync(targetIco, icoBuffer);
  console.log(`[joincloud] Generated Windows icon: ${targetIco}`);
}

main().catch((error) => {
  console.error(`[joincloud] Windows icon generation failed: ${error.message}`);
  process.exit(1);
});
