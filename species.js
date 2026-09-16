const ABBREV = new Map([
  ["phcooh", "OC(=O)c1ccccc1"],
  ["phco2h", "OC(=O)c1ccccc1"],
  ["meoh", "CO"],
  ["phcoome", "COC(=O)c1ccccc1"],
  ["phco2me", "COC(=O)c1ccccc1"],
]);

const SMILES_HINT = /[=#[\]@]|[cnos]\d|[A-Z][a-z]?\(/;

function readToken(token) {
  if (token && typeof token === "object") {
    const smiles = String(token.smiles ?? "").trim();
    const label = String(token.label ?? smiles).trim();
    return { label, smiles };
  }
  return { label: String(token ?? "").trim(), smiles: "" };
}

export function resolveSpecies(token, source) {
  const raw = readToken(token);
  if (!raw.label && !raw.smiles) {
    return { label: "", smiles: null };
  }
  if (raw.smiles) {
    return { label: raw.label || raw.smiles, smiles: raw.smiles };
  }
  if (source === "smiles") {
    return { label: raw.label, smiles: raw.label };
  }
  const mapped = ABBREV.get(raw.label.toLowerCase().replaceAll(/\s+/g, ""));
  if (mapped) return { label: raw.label, smiles: mapped };
  if (SMILES_HINT.test(raw.label)) return { label: raw.label, smiles: raw.label };
  return { label: raw.label, smiles: null };
}

const COND_LINE =
  /^(reflux|rt|r\.?t\.?|heat|Δ|hv|n2|ar|air|overnight|thf|dce|dcm|meoh|etoh|phme|toluene|mecn|ch3cn|h2o|\d+\s*°?\s*c|0\s*°?\s*c)$/i;

function splitParts(values) {
  return (values ?? []).flatMap((value) =>
    String(value)
      .split(/[,;]\s*/)
      .map((part) => part.trim())
      .filter(Boolean),
  );
}

export function stackArrow(reagents, conditions) {
  const above = [];
  const below = [];
  for (const part of [...splitParts(reagents), ...splitParts(conditions)]) {
    if (COND_LINE.test(part)) below.push(part);
    else above.push(part);
  }
  return {
    type: "arrow",
    reagents: above.join(", "),
    conditions: below.join(", "),
  };
}

export function arrowLines(text) {
  return String(text || "")
    .split(", ")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function schemeItems(parsed) {
  const source = parsed.kind === "smiles" ? "smiles" : "text";
  const items = [];

  function addSide(tokens) {
    (tokens ?? []).forEach((token, index) => {
      if (index) items.push({ type: "plus" });
      const species = resolveSpecies(token, source);
      items.push({
        type: "species",
        label: species.label,
        smiles: species.smiles,
      });
    });
  }

  addSide(parsed.reactants);
  items.push(stackArrow(parsed.reagents, parsed.conditions));
  addSide(parsed.products);
  return items;
}

export const LAYOUT = {
  speciesWidth: 168,
  speciesHeight: 128,
  plusWidth: 22,
  arrowWidth: 150,
  gap: 20,
  paper: "#ffffff",
  ink: "#111111",
  mute: "#444444",
};
