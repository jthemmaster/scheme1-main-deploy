import { LAYOUT, arrowLines, schemeItems } from "./species.js";
import { drawSpeciesSvg, rasterizeSvg } from "./depict.js";

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function textNode(x, y, value) {
  return `    <t p="${x.toFixed(2)} ${y.toFixed(2)}" Justification="Center">\n      <s font="3" size="12">${escapeXml(value)}</s>\n    </t>`;
}

function cdxmlLabel(token) {
  if (token && typeof token === "object") {
    return String(token.label ?? token.smiles ?? "");
  }
  return String(token ?? "");
}

export function toCdxml(parsed) {
  const reactants = (parsed.reactants ?? []).map(cdxmlLabel);
  const products = (parsed.products ?? []).map(cdxmlLabel);
  const reagents = (parsed.reagents ?? []).join(", ");
  const conditions = (parsed.conditions ?? []).join(", ");
  const nodes = [];
  let x = 80;
  for (const label of reactants) {
    nodes.push(textNode(x, 80, label));
    x += 120;
  }
  nodes.push(textNode(x, 56, reagents || " "));
  nodes.push(textNode(x, 80, "→"));
  nodes.push(textNode(x, 104, conditions || " "));
  x += 120;
  for (const label of products) {
    nodes.push(textNode(x, 80, label));
    x += 120;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE CDXML SYSTEM "http://www.cambridgesoft.com/xml/cdxml.dtd">
<CDXML CreationProgram="Scheme 1" Name="scheme-1">
  <page Width="${Math.max(x, 400)}" Height="160">
    <t p="20.00 24.00"><s font="3" size="9">text-layout CDXML — labels only, not atom-mapped</s></t>
${nodes.join("\n")}
  </page>
</CDXML>
`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function addSpecies(row, item) {
  const species = el("div", "species");
  const slot = el("div", "struct-slot");
  slot.style.width = `${LAYOUT.speciesWidth}px`;
  slot.style.height = `${LAYOUT.speciesHeight}px`;
  const svg = item.smiles ? drawSpeciesSvg(item.smiles) : null;
  if (svg) {
    slot.appendChild(svg);
  } else {
    slot.classList.add("label-only");
    slot.textContent = item.label;
  }
  species.appendChild(slot);
  row.appendChild(species);
}

function stackBlock(className, text) {
  const block = el("div", className);
  const lines = arrowLines(text);
  if (!lines.length) {
    block.appendChild(el("span", null, "\u00a0"));
    return block;
  }
  for (const line of lines) block.appendChild(el("span", null, line));
  return block;
}

function addArrow(row, item) {
  const arrow = el("div", "arrow-block");
  arrow.style.minWidth = `${LAYOUT.arrowWidth}px`;
  arrow.appendChild(stackBlock("stack above", item.reagents));
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const arrowW = LAYOUT.arrowWidth;
  svg.setAttribute("viewBox", `0 0 ${arrowW} 14`);
  svg.setAttribute("width", String(arrowW));
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML =
    `<line x1="2" y1="7" x2="${arrowW - 18}" y2="7" stroke="#111111" stroke-width="1.15"/>` +
    `<path d="M${arrowW - 26} 2.5 L${arrowW - 14} 7 L${arrowW - 26} 11.5" stroke="#111111" stroke-width="1.15" fill="none"/>`;
  arrow.appendChild(svg);
  arrow.appendChild(stackBlock("stack below", item.conditions));
  row.appendChild(arrow);
}

export function renderScheme(parsed, rootEl) {
  rootEl.replaceChildren();
  rootEl.classList.remove("empty");

  const row = el("div", "scheme");
  for (const item of schemeItems(parsed)) {
    if (item.type === "plus") row.appendChild(el("div", "plus", "+"));
    else if (item.type === "arrow") addArrow(row, item);
    else addSpecies(row, item);
  }
  rootEl.appendChild(row);
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function itemWidth(item) {
  if (item.type === "plus") return LAYOUT.plusWidth;
  if (item.type === "arrow") return LAYOUT.arrowWidth;
  return LAYOUT.speciesWidth;
}

function paintLabel(ctx, text, cx, cy, maxWidth) {
  ctx.fillStyle = LAYOUT.ink;
  ctx.font = "400 13px Arial, Helvetica, sans-serif";
  const lines = wrapLabel(ctx, text, maxWidth);
  const start = cy - ((lines.length - 1) * 15) / 2;
  lines.forEach((line, lineIndex) => {
    ctx.fillText(line, cx, start + lineIndex * 15);
  });
}

function paintStack(ctx, text, cx, y, fill, size) {
  const lines = arrowLines(text);
  ctx.fillStyle = fill;
  ctx.font = `400 ${size}px Arial, Helvetica, sans-serif`;
  lines.forEach((line, index) => {
    ctx.fillText(line, cx, y + index * (size + 3));
  });
  return lines.length;
}

export async function paintSchemeCanvas(parsed, canvas) {
  const items = schemeItems(parsed);
  const gap = LAYOUT.gap;
  const widths = items.map(itemWidth);
  const contentW = widths.reduce((sum, w) => sum + w, 0) + gap * Math.max(0, items.length - 1);
  const width = Math.max(820, contentW + 120);
  const height = 280;
  const scale = 2;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.fillStyle = LAYOUT.paper;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = LAYOUT.mute;
  ctx.font = "500 11px Arial, Helvetica, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Scheme 1", 36, 30);

  let x = (width - contentW) / 2;
  const midY = 148;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const w = widths[i];
    const cx = x + w / 2;
    if (item.type === "plus") {
      ctx.fillStyle = LAYOUT.ink;
      ctx.font = "400 20px Arial, Helvetica, sans-serif";
      ctx.fillText("+", cx, midY);
    } else if (item.type === "arrow") {
      const aboveCount = Math.max(1, arrowLines(item.reagents).length);
      paintStack(ctx, item.reagents, cx, midY - 18 - aboveCount * 14, LAYOUT.ink, 12);
      ctx.strokeStyle = LAYOUT.ink;
      ctx.lineWidth = 1.15;
      ctx.beginPath();
      ctx.moveTo(x + 4, midY);
      ctx.lineTo(x + w - 16, midY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + w - 28, midY - 5);
      ctx.lineTo(x + w - 12, midY);
      ctx.lineTo(x + w - 28, midY + 5);
      ctx.stroke();
      paintStack(ctx, item.conditions, cx, midY + 22, LAYOUT.mute, 11);
    } else {
      let drawn = null;
      if (item.smiles) {
        const svg = drawSpeciesSvg(item.smiles);
        if (svg) {
          try {
            drawn = await rasterizeSvg(svg);
          } catch {
            drawn = null;
          }
        }
      }
      if (drawn) {
        ctx.drawImage(
          drawn,
          x,
          midY - LAYOUT.speciesHeight / 2,
          LAYOUT.speciesWidth,
          LAYOUT.speciesHeight,
        );
      } else {
        paintLabel(ctx, item.label, cx, midY, LAYOUT.speciesWidth - 8);
      }
    }
    x += w + gap;
  }
}

function wrapLabel(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return [text];
  const chars = text.split("");
  const lines = [];
  let current = "";
  for (const ch of chars) {
    const next = current + ch;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = ch;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

export async function downloadPng(parsed) {
  const canvas = document.createElement("canvas");
  await paintSchemeCanvas(parsed, canvas);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("PNG export failed."));
        return;
      }
      saveBlob(blob, "scheme-1.png");
      resolve();
    }, "image/png");
  });
}

export function downloadCdxml(parsed) {
  const xml = toCdxml(parsed);
  saveBlob(new Blob([xml], { type: "chemical/x-cdxml" }), "scheme-1.cdxml");
}
