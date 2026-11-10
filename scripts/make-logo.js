// Regenerate: install resvg OUTSIDE the project (it is not an app dependency),
//   mkdir /tmp/resvg && cd /tmp/resvg && npm init -y && npm i @resvg/resvg-js@2.6.2
//   node scripts/make-logo.js /tmp/resvg/node_modules assets/images
// Keep the paths in sync with components/Logo.tsx.
// Renders the "fyft" logo assets (SVG -> PNG) for the Fyft app.
// Usage: node make-logo.js <resvg node_modules dir> <assets/images out dir>
const path = require('path');
const fs = require('fs');
const { Resvg } = require(path.join(process.argv[2], '@resvg', 'resvg-js'));
const OUT = process.argv[3];

const MAGENTA = '#dc5ad8'; // Colors.primary (dark)
const BG = '#0b0b0f';

// "fyft" in Outfit ExtraBold (OFL), same outlines as LOGO_PATH in
// components/Logo.tsx (letters spaced +14 so the f/t bars do not touch).
const PATH = 'M55.6 148.2L20.8 148.2L20.8 79.4L0 79.4L0 50.4L20.8 50.4L20.8 44.2Q20.8 31.8 26.2 21.9Q31.6 12 41.7 6Q51.8 0 66 0L66 0Q76.6 0 84.6 3.5Q92.6 7 98.4 12.8L98.4 12.8L76.6 34.6Q75 32.8 72.7 31.9Q70.4 31.0 67.4 31.0L67.4 31.0Q62.0 31.0 58.8 34.2Q55.6 37.4 55.6 42.8L55.6 42.8L55.6 50.4L83.2 50.4L83.2 79.4L55.6 79.4L55.6 148.2ZM154.2 189.6L119.2 189.6L140.4 143.2L103.2 50.4L140.4 50.4L157.2 106.6L174 50.4L211.2 50.4L171 148.4L154.2 189.6ZM282.2 148.2L247.4 148.2L247.4 79.4L226.6 79.4L226.6 50.4L247.4 50.4L247.4 44.2Q247.4 31.8 252.8 21.9Q258.2 12 268.3 6Q278.4 0 292.6 0L292.6 0Q303.2 0 311.2 3.5Q319.2 7 325 12.8L325 12.8L303.2 34.6Q301.6 32.8 299.3 31.9Q297 31.0 294 31.0L294 31.0Q288.6 31.0 285.4 34.2Q282.2 37.4 282.2 42.8L282.2 42.8L282.2 50.4L309.8 50.4L309.8 79.4L282.2 79.4L282.2 148.2ZM388 148.2L353.2 148.2L353.2 79.4L331.6 79.4L331.6 50.4L353.2 50.4L353.2 10L388 10L388 50.4L409.6 50.4L409.6 79.4L388 79.4L388 148.2Z';
const W = 409.6;
const H = 189.6;

/** Wordmark scaled to `width` px and centered at (cx, cy). */
function placedWordmark(cx, cy, width) {
  const k = width / W;
  return `<g transform="translate(${cx - (W / 2) * k} ${cy - (H / 2) * k}) scale(${k})"><path d="${PATH}" fill="${MAGENTA}"/></g>`;
}

function render(svg, size, file) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  fs.writeFileSync(path.join(OUT, file), png);
  console.log('wrote', file, png.length, 'bytes');
}

const S = 1024;

// iOS / generic icon: dark square + wordmark. NO frame: Android/iOS masks
// clip the edges, a frame showed up as stray purple lines (2026-11-09).
render(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
    <rect width="${S}" height="${S}" fill="${BG}"/>
    ${placedWordmark(512, 512, 520)}
  </svg>`,
  S,
  'icon.png'
);

// Android adaptive foreground: transparent, wordmark inside the safe circle
// (~61% of the canvas; its diagonal must fit, so keep the width <= ~540)
// (the launcher masks the outer area). Background color comes from app.json.
render(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
    ${placedWordmark(512, 512, 420)}
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
