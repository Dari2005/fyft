// Regenerate: install resvg OUTSIDE the project (it is not an app dependency),
//   mkdir /tmp/resvg && cd /tmp/resvg && npm init -y && npm i @resvg/resvg-js@2.6.2
//   node scripts/make-logo.js /tmp/resvg/node_modules assets/images
// Keep the paths in sync with components/Logo.tsx.
// Renders the "fyft." logo assets (SVG -> PNG) for the Fyft app.
// Usage: node make-logo.js <resvg node_modules dir> <assets/images out dir>
const path = require('path');
const fs = require('fs');
const { Resvg } = require(path.join(process.argv[2], '@resvg', 'resvg-js'));
const OUT = process.argv[3];

const WHITE = '#f2f2f5';
const PURPLE = '#8b6cf0';
const BG = '#0b0b0f';

// Wordmark drawn with round strokes in a local box (~x 13..515, y 28..307),
// so no font is needed. Center ~ (264, 167).
function wordmark(sw = 34) {
  const s = `fill="none" stroke="${WHITE}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"`;
  return `
    <path d="M60 220 V85 a40 40 0 0 1 40 -40 h12" ${s}/>
    <path d="M30 115 H100" ${s}/>
    <path d="M150 115 V170 a35 35 0 0 0 70 0" ${s}/>
    <path d="M220 115 V250 a40 40 0 0 1 -40 40 H160" ${s}/>
    <path d="M290 220 V85 a40 40 0 0 1 40 -40 h12" ${s}/>
    <path d="M260 115 H330" ${s}/>
    <path d="M400 50 V185 a35 35 0 0 0 35 35 h10" ${s}/>
    <path d="M372 115 H445" ${s}/>
    <circle cx="495" cy="203" r="21" fill="${PURPLE}"/>`;
}

/** Wordmark scaled to `width` px and centered at (cx, cy). */
function placedWordmark(cx, cy, width) {
  const k = width / 502;
  return `<g transform="translate(${cx - 264 * k} ${cy - 167 * k}) scale(${k})">${wordmark()}</g>`;
}

function render(svg, size, file) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  fs.writeFileSync(path.join(OUT, file), png);
  console.log('wrote', file, png.length, 'bytes');
}

const S = 1024;

// iOS / generic icon: dark square, thin purple inset frame, wordmark.
render(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
    <rect width="${S}" height="${S}" fill="${BG}"/>
    <rect x="76" y="76" width="${S - 152}" height="${S - 152}" rx="150" fill="none" stroke="${PURPLE}" stroke-width="16"/>
    ${placedWordmark(512, 512, 600)}
  </svg>`,
  S,
  'icon.png'
);

// Android adaptive foreground: transparent, content inside the ~66% safe zone
// (the launcher masks the outer area). Background color comes from app.json.
render(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
    <rect x="208" y="208" width="${S - 416}" height="${S - 416}" rx="120" fill="none" stroke="${PURPLE}" stroke-width="12"/>
    ${placedWordmark(512, 512, 440)}
  </svg>`,
  S,
  'android-icon-foreground.png'
);

// Splash: wordmark only, transparent (splash background color from app.json).
render(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
    ${placedWordmark(512, 512, 760)}
  </svg>`,
  S,
  'splash-icon.png'
);

// Favicon (web).
render(
  `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 ${S} ${S}">
    <rect width="${S}" height="${S}" rx="220" fill="${BG}"/>
    ${placedWordmark(512, 512, 800)}
  </svg>`,
  48,
  'favicon.png'
);
