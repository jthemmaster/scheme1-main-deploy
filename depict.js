import { LAYOUT } from "./species.js";

const PAPER_THEME = {
  C: "#111111",
  O: "#111111",
  N: "#111111",
  F: "#111111",
  CL: "#111111",
  BR: "#111111",
  I: "#111111",
  P: "#111111",
  S: "#111111",
  B: "#111111",
  SI: "#111111",
  H: "#111111",
  BACKGROUND: "#ffffff",
};

export function drawerOptions() {
  return {
    width: LAYOUT.speciesWidth,
    height: LAYOUT.speciesHeight,
    bondThickness: 1.05,
    bondLength: 15,
    shortBondLength: 0.8,
    bondSpacing: 2.7,
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSizeLarge: 10,
    fontSizeSmall: 6,
    padding: 10,
    compactDrawing: true,
    overlapResolutionIterations: 3,
    explicitHydrogens: false,
    terminalCarbons: true,
    themes: { paper: PAPER_THEME },
  };
}

function api() {
  return globalThis.SmilesDrawer ?? null;
}

export function parseSmilesTree(smiles) {
  const smilesDrawer = api();
  if (!smilesDrawer || !smiles) return null;
  let tree = null;
  smilesDrawer.parse(
    smiles,
    (parsed) => {
      tree = parsed;
    },
    () => {
      tree = null;
    },
  );
  return tree;
}

export function drawSpeciesSvg(smiles) {
  const smilesDrawer = api();
  const tree = parseSmilesTree(smiles);
  if (!smilesDrawer?.SvgDrawer || !tree) return null;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", String(LAYOUT.speciesWidth));
  svg.setAttribute("height", String(LAYOUT.speciesHeight));
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", smiles);
  new smilesDrawer.SvgDrawer(drawerOptions()).draw(tree, svg, "paper");
  return svg;
}

export function rasterizeSvg(svg) {
  if (!svg || !globalThis.document) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = LAYOUT.speciesWidth;
      canvas.height = LAYOUT.speciesHeight;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = LAYOUT.paper;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, LAYOUT.speciesWidth, LAYOUT.speciesHeight);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error("Could not rasterize structure."));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`;
  });
}
