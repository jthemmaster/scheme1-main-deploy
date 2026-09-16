import { parseIntake } from "./parse.js";
import { extractPreview, parseChemDraw, toSchemeIntake } from "./chemdraw.js";
import { downloadCdxml, downloadPng, renderScheme } from "./export.js";
import {
  EXPORT_KIND,
  createUsageLedger,
  decideExport,
  remainingFree,
} from "./entitlement.js";
import { Scheme } from "./scheme.js";
import { SchemeEditor } from "./editor.js";

const EXAMPLES = {
  fischer: {
    reaction: "PhCOOH + MeOH → PhCOOMe (H2SO4, reflux)",
    conditions: "",
  },
  text: {
    reaction: "PhCOOH + MeOH → PhCOOMe (H2SO4)",
    conditions: "reflux",
  },
  smiles: {
    reaction: "OC(=O)c1ccccc1.CO>H2SO4>COC(=O)c1ccccc1",
    conditions: "reflux",
  },
  redamin: {
    reaction: "PhCHO + MeNH2 → PhCH2NHMe (NaBH3CN)",
    conditions: "",
  },
  snar: {
    reaction: "1-fluoro-2-nitrobenzene + MeONa → 1-methoxy-2-nitrobenzene",
    conditions: "",
  },
  suzuki: {
    reaction: "PhB(OH)2 + PhBr → biphenyl",
    conditions: "Pd(PPh3)4, K2CO3",
  },
  acetyl: {
    reaction: "PhNH2 + Ac2O → PhNHAc (pyridine)",
    conditions: "",
  },
};

const reactionEl = document.getElementById("reaction");
const conditionsEl = document.getElementById("conditions");
const statusEl = document.getElementById("parse-status");
const stageEl = document.getElementById("scheme-stage");
const editorEl = document.getElementById("scheme-editor");
const drawBtn = document.getElementById("draw");
const pngBtn = document.getElementById("download-png");
const cdxmlBtn = document.getElementById("download-cdxml");
const afterEl = document.getElementById("after-download");
const dropEl = document.getElementById("chemdraw-drop");
const fileEl = document.getElementById("chemdraw-file");
const chemStatusEl = document.getElementById("chemdraw-status");
const extractEl = document.getElementById("extract-panel");
const extractCountsEl = document.getElementById("extract-counts");
const extractSpeciesEl = document.getElementById("extract-species");
const extractJsonEl = document.getElementById("extract-json");
const graphEl = document.getElementById("atom-graph");

const ledger = createUsageLedger(window.localStorage);
const scheme = Scheme.empty();
const pageEl = document.querySelector("main");

function currentParse() {
  return parseIntake(reactionEl.value, conditionsEl.value);
}

function growReactionField() {
  reactionEl.style.height = "auto";
  reactionEl.style.height = `${Math.max(40, reactionEl.scrollHeight)}px`;
}

function setStatus(state, message) {
  statusEl.textContent = message;
  statusEl.dataset.state = state;
}

function enableExports() {
  const ready = scheme.canDraw();
  pngBtn.disabled = !ready;
  cdxmlBtn.disabled = !ready;
  drawBtn.disabled = currentParse().status !== "ok" && !ready;
}

function redrawScheme({ keepArrow = false } = {}) {
  const layout = scheme.toLayout();
  const hasAny =
    layout.reactants.length ||
    layout.products.length ||
    layout.reagents.length ||
    layout.conditions.length;
  if (!hasAny) {
    stageEl.replaceChildren();
    stageEl.classList.add("empty");
    stageEl.textContent = "Add species or paste a reaction.";
    enableExports();
    return;
  }
  if (
    keepArrow &&
    (stageEl.querySelector(".arrow-conditions") ||
      stageEl.querySelector(".arrow-reagents"))
  ) {
    enableExports();
    return;
  }
  renderScheme(layout, stageEl);
  SchemeEditor.hydrateArrow(stageEl, scheme);
  enableExports();
}

function dispatch(action) {
  const result = SchemeEditor.apply(scheme, action);
  const fromArrow = action.type === "conditions" || action.type === "reagents";
  if (action.type !== "relabel") SchemeEditor.render(editorEl, scheme);
  redrawScheme({ keepArrow: fromArrow });
  if (action.type === "intake") {
    setStatus(action.parsed.status, action.parsed.message);
  } else {
    const status = Scheme.status(scheme);
    setStatus(status.state, status.message);
  }
  return result;
}

function applyIntakeIfOk() {
  growReactionField();
  const parsed = currentParse();
  if (parsed.status === "ok") {
    dispatch({ type: "intake", parsed });
    return;
  }
  setStatus(parsed.status, parsed.message);
  enableExports();
}

function speciesName(value) {
  if (value && typeof value === "object") return value.label || value.smiles || "";
  return String(value ?? "");
}

function renderAtomGraph(doc, svg) {
  svg.replaceChildren();
  const atoms = doc.atoms ?? [];
  const bonds = doc.bonds ?? [];
  if (!atoms.length) {
    svg.setAttribute("hidden", "");
    return;
  }
  svg.removeAttribute("hidden");
  const xs = atoms.map((atom) => atom.x);
  const ys = atoms.map((atom) => atom.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const pad = 24;
  const spanX = Math.max(maxX - minX, 8);
  const spanY = Math.max(maxY - minY, 8);
  const width = 320 - pad * 2;
  const height = 120 - pad * 2;
  const mapX = (x) => pad + ((x - minX) / spanX) * width;
  const mapY = (y) => pad + ((y - minY) / spanY) * height;
  const byId = new Map(atoms.map((atom) => [atom.id, atom]));
  const ns = "http://www.w3.org/2000/svg";
  for (const bond of bonds) {
    const a = byId.get(bond.begin);
    const b = byId.get(bond.end);
    if (!a || !b) continue;
    const line = document.createElementNS(ns, "line");
    line.setAttribute("x1", String(mapX(a.x)));
    line.setAttribute("y1", String(mapY(a.y)));
    line.setAttribute("x2", String(mapX(b.x)));
    line.setAttribute("y2", String(mapY(b.y)));
    line.setAttribute("stroke", "#1A1510");
    line.setAttribute("stroke-width", bond.order >= 2 ? "2.4" : "1.4");
    line.setAttribute("opacity", ".55");
    svg.appendChild(line);
  }
  for (const atom of atoms) {
    const circle = document.createElementNS(ns, "circle");
    circle.setAttribute("cx", String(mapX(atom.x)));
    circle.setAttribute("cy", String(mapY(atom.y)));
    circle.setAttribute("r", "9");
    circle.setAttribute("fill", "#ffffff");
    circle.setAttribute("stroke", "#1A1510");
    circle.setAttribute("stroke-width", "1.2");
    svg.appendChild(circle);
    const label = document.createElementNS(ns, "text");
    label.setAttribute("x", String(mapX(atom.x)));
    label.setAttribute("y", String(mapY(atom.y) + 3.5));
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("font-size", "9");
    label.setAttribute("font-family", "Inter, system-ui, sans-serif");
    label.setAttribute("fill", "#1A1510");
    label.textContent = atom.symbol;
    svg.appendChild(label);
  }
}

function showExtract(doc) {
  if (!extractEl) return;
  if (doc.status !== "ok") {
    extractEl.hidden = true;
    return;
  }
  extractEl.hidden = false;
  const preview = extractPreview(doc);
  extractCountsEl.textContent = doc.message.replace(/^ChemDraw \w+ · /, "");
  extractSpeciesEl.replaceChildren();
  const labels = [
    ...preview.species.reactants.map((name) => ({ name: speciesName(name), side: "reactant" })),
    ...preview.species.products.map((name) => ({ name: speciesName(name), side: "product" })),
    ...preview.species.reagents.map((name) => ({ name: speciesName(name), side: "reagent" })),
  ];
  for (const item of labels) {
    const li = document.createElement("li");
    li.textContent = `${item.side} ${item.name}`;
    extractSpeciesEl.appendChild(li);
  }
  extractJsonEl.textContent = JSON.stringify(preview, null, 2);
  if (graphEl) renderAtomGraph(doc, graphEl);
}

function applyChemDraw(doc, filename) {
  const label = filename ? `${doc.message} · ${filename}` : doc.message;
  if (chemStatusEl) {
    chemStatusEl.textContent = label;
    chemStatusEl.dataset.state = doc.status;
  }
  showExtract(doc);
  if (doc.status !== "ok") {
    setStatus("error", doc.message);
    enableExports();
    return;
  }
  document.querySelectorAll("[data-example]").forEach((button) => {
    button.classList.remove("active");
  });
  dispatch({ type: "intake", parsed: toSchemeIntake(doc) });
}

async function readChemDrawFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return parseChemDraw({ name: file.name, bytes });
}

function loadExample(key) {
  const example = EXAMPLES[key];
  if (!example) return;
  document.querySelectorAll("[data-example]").forEach((button) => {
    button.classList.toggle("active", button.dataset.example === key);
  });
  reactionEl.value = example.reaction;
  conditionsEl.value = example.conditions;
  applyIntakeIfOk();
}

function drawScheme() {
  const parsed = currentParse();
  if (parsed.status === "ok") {
    dispatch({ type: "intake", parsed });
    return;
  }
  redrawScheme();
  const status = scheme.canDraw()
    ? Scheme.status(scheme)
    : { state: parsed.status, message: parsed.message };
  setStatus(status.state, status.message);
}

function revealAfterDownload(kind, extra) {
  afterEl.hidden = false;
  const left = remainingFree(ledger.usedThisMonth());
  const allowance =
    left === 1
      ? "1 free CDXML or hi-res export left this month."
      : `${left} free CDXML or hi-res exports left this month.`;
  if (kind === "blocked") {
    afterEl.textContent = extra;
    return;
  }
  afterEl.textContent =
    kind === "png"
      ? `Downloaded scheme-1.png. Layout PNG is the first try and stays free. ${allowance} Email for updates comes after this, and never before.`
      : `Downloaded scheme-1.cdxml (text-layout). ${allowance} Email for updates comes after this, and never before.`;
}

async function onPng() {
  if (!scheme.canDraw()) return;
  await downloadPng(scheme.toLayout());
  revealAfterDownload("png");
}

function onCdxml() {
  if (!scheme.canDraw()) return;
  const decision = decideExport({
    kind: EXPORT_KIND.cdxml,
    usedThisMonth: ledger.usedThisMonth(),
    credits: ledger.credits(),
  });
  if (!decision.allowed) {
    revealAfterDownload(
      "blocked",
      "Free CDXML allowance used this month (2). Credits checkout is not wired.",
    );
    return;
  }
  downloadCdxml(scheme.toLayout());
  if (decision.consume) ledger.record(EXPORT_KIND.cdxml);
  revealAfterDownload("cdxml");
}

function setChemStatus(message, state) {
  if (!chemStatusEl) return;
  chemStatusEl.textContent = message;
  chemStatusEl.dataset.state = state;
}

function bindChemDraw() {
  if (!dropEl || !fileEl) return;

  function setDropOver(on) {
    dropEl.classList.toggle("over", on);
  }

  dropEl.addEventListener("dragenter", (event) => {
    event.preventDefault();
    setDropOver(true);
  });
  dropEl.addEventListener("dragover", (event) => {
    event.preventDefault();
    setDropOver(true);
  });
  dropEl.addEventListener("dragleave", (event) => {
    if (!dropEl.contains(event.relatedTarget)) setDropOver(false);
  });
  dropEl.addEventListener("drop", (event) => {
    event.preventDefault();
    setDropOver(false);
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    readChemDrawFile(file)
      .then((doc) => applyChemDraw(doc, file.name))
      .catch((err) => {
        setChemStatus(err.message || "Could not read that file.", "error");
      });
  });
  fileEl.addEventListener("change", () => {
    const file = fileEl.files?.[0];
    if (!file) return;
    readChemDrawFile(file)
      .then((doc) => applyChemDraw(doc, file.name))
      .catch((err) => {
        setChemStatus(err.message || "Could not load sample.", "error");
      });
  });

  document.querySelectorAll("[data-sample]").forEach((button) => {
    button.addEventListener("click", () => {
      const path = button.dataset.sample;
      fetch(path)
        .then((res) => {
          if (!res.ok) throw new Error(`Could not load ${path}.`);
          return res.arrayBuffer();
        })
        .then((buffer) => {
          const name = path.split("/").pop();
          applyChemDraw(parseChemDraw({ name, bytes: new Uint8Array(buffer) }), name);
        })
        .catch((err) => {
          setChemStatus(err.message || "Could not load sample.", "error");
        });
    });
  });
}

reactionEl.addEventListener("input", applyIntakeIfOk);
conditionsEl.addEventListener("input", applyIntakeIfOk);
drawBtn.addEventListener("click", drawScheme);
pngBtn.addEventListener("click", () => {
  onPng().catch((err) => {
    setStatus("error", err.message || "PNG export failed.");
  });
});
cdxmlBtn.addEventListener("click", onCdxml);

document.querySelectorAll("[data-example]").forEach((button) => {
  button.addEventListener("click", () => loadExample(button.dataset.example));
});

bindChemDraw();
SchemeEditor.bind(pageEl, dispatch);
SchemeEditor.render(editorEl, scheme);
applyIntakeIfOk();
