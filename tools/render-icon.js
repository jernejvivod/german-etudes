// Renders the app icon, build/icon.svg, to build/icon.icns (the app bundle's icon) and build/icon.png (1024 px).
// Run by Electron, whose Chromium draws the SVG with the system's serif fonts: npm run icon (macOS, needs iconutil).
'use strict';

const { app, BrowserWindow } = require('electron');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const BUILD = path.join(__dirname, '..', 'build');
// The iconset's files: each point size at 1x and 2x (icon_16x16@2x is the 32 px rendition …).
const ICONSET = [16, 32, 128, 256, 512].flatMap((size) => [
  [`icon_${size}x${size}.png`, size],
  [`icon_${size}x${size}@2x.png`, size * 2],
]);
const SIZES = [...new Set(ICONSET.map(([, size]) => size))]; // 16 … 1024

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'german-etudes-icon-'));
app.setPath('userData', path.join(tmp, 'profile')); // keep Electron's own profile out of ~/Library
app.dock?.hide();
app.on('quit', () => fs.rmSync(tmp, { recursive: true, force: true }));

// Draws the SVG at each size straight from the vector (no downscaling of a large bitmap) and returns PNG data URLs.
async function render(svg) {
  const win = new BrowserWindow({ show: false });
  await win.loadURL('about:blank');
  const url = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  return win.webContents.executeJavaScript(`(async () => {
    const img = new Image();
    img.src = ${JSON.stringify(url)};
    await img.decode();
    const draw = (size) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      canvas.getContext('2d').drawImage(img, 0, 0, size, size);
      return canvas.toDataURL('image/png');
    };
    draw(1024); // the first draw loads the font
    await new Promise((resolve) => setTimeout(resolve, 300));
    return Object.fromEntries(${JSON.stringify(SIZES)}.map((size) => [size, draw(size)]));
  })()`);
}

app.whenReady().then(async () => {
  try {
    const pngs = await render(fs.readFileSync(path.join(BUILD, 'icon.svg'), 'utf8'));
    const png = (size) => Buffer.from(pngs[size].split(',')[1], 'base64');
    const iconset = path.join(tmp, 'icon.iconset');
    fs.mkdirSync(iconset);
    for (const [name, size] of ICONSET) fs.writeFileSync(path.join(iconset, name), png(size));
    execFileSync('iconutil', ['-c', 'icns', '-o', path.join(BUILD, 'icon.icns'), iconset]);
    fs.writeFileSync(path.join(BUILD, 'icon.png'), png(1024));
    console.log(`Wrote ${path.join(BUILD, 'icon.icns')} and icon.png`);
    app.quit();
  } catch (err) {
    console.error(err);
    fs.rmSync(tmp, { recursive: true, force: true }); // app.exit skips quit
    app.exit(1);
  }
});
