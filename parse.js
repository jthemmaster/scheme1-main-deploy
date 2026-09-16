const TEXT_ARROW = /\s*(?:→|->|⇒|⟶)\s*/;
const COND_TOKEN =
  /^(reflux|rt|r\.?t\.?|heat|Δ|hv|n2|ar|air|overnight|\d+\s*°?\s*c|0\s*°?\s*c)$/i;

function emptyResult(message) {
  return {
    status: "empty",
    kind: "empty",
    reactants: [],
    products: [],
    reagents: [],
    conditions: [],
    message,
  };
}

function errorResult(message) {
  return {
    status: "error",
    kind: "empty",
    reactants: [],
    products: [],
    reagents: [],
    conditions: [],
    message,
  };
}

function splitList(value, separator) {
  return value
    .split(separator)
    .map((part) => part.trim())
    .filter(Boolean);
}

function classifyParenParts(raw) {
  const reagents = [];
  const conditions = [];
  for (const part of splitList(raw, /[,;]/)) {
    if (COND_TOKEN.test(part)) conditions.push(part);
    else reagents.push(part);
  }
  return { reagents, conditions };
}

function countPhrase(n, word) {
  return n === 1 ? `1 ${word}` : `${n} ${word}s`;
}

function okMessage(kind, reactants, products) {
  const label = kind === "smiles" ? "reaction SMILES" : "reaction text";
  return `Parsed as ${label} · ${countPhrase(reactants.length, "reactant")} → ${countPhrase(products.length, "product")}`;
}

function mergeConditions(parsed, extra) {
  const extraTrim = extra.trim();
  if (!extraTrim) return parsed;
  return [...parsed, extraTrim];
}

function looksLikeSmiles(reaction) {
  if (TEXT_ARROW.test(reaction)) return false;
  if (reaction.includes(">>")) return true;
  const parts = reaction.split(">");
  return parts.length >= 3 && parts[0].trim() && parts[parts.length - 1].trim();
}

function parseText(reaction) {
  let core = reaction;
  let reagents = [];
  let conditions = [];
  const paren = reaction.match(/\(([^)]+)\)\s*$/);
  if (paren) {
    core = reaction.slice(0, paren.index).trim();
    const classified = classifyParenParts(paren[1]);
    reagents = classified.reagents;
    conditions = classified.conditions;
  }

  const sides = core.split(TEXT_ARROW);
  if (sides.length < 2) {
    return errorResult("No arrow found. Use → or A>>B.");
  }

  const reactants = splitList(sides[0], /\s*\+\s*/);
  const products = splitList(sides.slice(1).join(" → "), /\s*\+\s*/);
  return { reactants, products, reagents, conditions };
}

function parseSmiles(reaction) {
  const parts = reaction.split(">");
  const reactants = splitList(parts[0] || "", ".");
  const products = splitList(parts[parts.length - 1] || "", ".");
  const reagentChunks = parts.slice(1, -1).filter((part) => part.trim());
  const reagents = reagentChunks.flatMap((chunk) => splitList(chunk, "."));
  return { reactants, products, reagents, conditions: [] };
}

export function parseIntake(reaction, conditions) {
  const text = String(reaction ?? "").trim();
  const extra = String(conditions ?? "");
  if (!text) return emptyResult("Paste a reaction.");

  const kind = looksLikeSmiles(text) ? "smiles" : "text";
  const parsed = kind === "smiles" ? parseSmiles(text) : parseText(text);
  if (parsed.status === "error") return parsed;

  parsed.conditions = mergeConditions(parsed.conditions, extra);

  if (!parsed.reactants.length) {
    return errorResult("No reactants. Use → or A>>B.");
  }
  if (!parsed.products.length) {
    return errorResult("No products. Use → or A>>B.");
  }

  return {
    status: "ok",
    kind,
    reactants: parsed.reactants,
    products: parsed.products,
    reagents: parsed.reagents,
    conditions: parsed.conditions,
    message: okMessage(kind, parsed.reactants, parsed.products),
  };
}
