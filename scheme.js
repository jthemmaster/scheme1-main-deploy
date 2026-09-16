const ROLES = ["reactant", "product", "reagent"];

function readSpeciesInput(value) {
  if (value && typeof value === "object") {
    return {
      label: String(value.label ?? value.smiles ?? ""),
      smiles: String(value.smiles ?? "").trim(),
    };
  }
  return { label: String(value ?? ""), smiles: "" };
}

export class Scheme {
  constructor() {
    this._nextId = 1;
    this._byRole = {
      reactant: [],
      product: [],
      reagent: [],
    };
    this._conditions = [];
  }

  static empty() {
    return new Scheme();
  }

  static fromParsed(parsed) {
    const scheme = new Scheme();
    scheme.replaceFromParsed(parsed);
    return scheme;
  }

  static roleKey(role) {
    return role === "reagent" ? "reagents" : `${role}s`;
  }

  static layoutLabels(items) {
    return items.map((item) => item.label.trim()).filter(Boolean);
  }

  static layoutTokens(items) {
    return items
      .map((item) => {
        const label = item.label.trim();
        if (!label) return null;
        if (item.smiles) return { label, smiles: item.smiles };
        return label;
      })
      .filter(Boolean);
  }

  replaceFromParsed(parsed) {
    if (!parsed || parsed.status !== "ok") return this;
    this._nextId = 1;
    this._byRole = { reactant: [], product: [], reagent: [] };
    for (const role of ROLES) {
      const labels = parsed[Scheme.roleKey(role)] ?? [];
      for (const label of labels) this.add(role, label);
    }
    this._conditions = [...(parsed.conditions ?? [])];
    return this;
  }

  add(role, label = "") {
    if (!this._byRole[role]) {
      throw new Error(`Unknown role: ${role}`);
    }
    const token = readSpeciesInput(label);
    const species = {
      id: `s${this._nextId}`,
      role,
      label: token.label,
    };
    if (token.smiles) species.smiles = token.smiles;
    this._nextId += 1;
    this._byRole[role].push(species);
    return species;
  }

  species(role) {
    return [...(this._byRole[role] ?? [])];
  }

  find(id) {
    for (const role of ROLES) {
      const found = this._byRole[role].find((item) => item.id === id);
      if (found) return found;
    }
    return null;
  }

  remove(id) {
    for (const role of ROLES) {
      const list = this._byRole[role];
      const index = list.findIndex((item) => item.id === id);
      if (index >= 0) {
        list.splice(index, 1);
        return true;
      }
    }
    return false;
  }

  move(id, delta) {
    for (const role of ROLES) {
      const list = this._byRole[role];
      const index = list.findIndex((item) => item.id === id);
      if (index < 0) continue;
      const next = index + Number(delta);
      if (next < 0 || next >= list.length) return false;
      const [item] = list.splice(index, 1);
      list.splice(next, 0, item);
      return true;
    }
    return false;
  }

  setLabel(id, label) {
    const found = this.find(id);
    if (!found) return false;
    found.label = String(label);
    return true;
  }

  reagentsText() {
    return Scheme.layoutLabels(this._byRole.reagent).join(", ");
  }

  setReagentsText(text) {
    const labels = String(text ?? "")
      .split(/[,;]\s*/)
      .map((part) => part.trim())
      .filter(Boolean);
    this._byRole.reagent = [];
    for (const label of labels) this.add("reagent", label);
    return this;
  }

  conditionsText() {
    return this._conditions.join(", ");
  }

  setConditionsText(text) {
    const trimmed = String(text ?? "").trim();
    this._conditions = trimmed ? [trimmed] : [];
    return this;
  }

  toLayout() {
    return {
      reactants: Scheme.layoutTokens(this._byRole.reactant),
      products: Scheme.layoutTokens(this._byRole.product),
      reagents: Scheme.layoutTokens(this._byRole.reagent),
      conditions: [...this._conditions],
    };
  }

  canDraw() {
    const layout = this.toLayout();
    return layout.reactants.length > 0 && layout.products.length > 0;
  }

  static status(scheme) {
    const layout = scheme.toLayout();
    if (scheme.canDraw()) {
      const reactants =
        layout.reactants.length === 1
          ? "1 reactant"
          : `${layout.reactants.length} reactants`;
      const products =
        layout.products.length === 1
          ? "1 product"
          : `${layout.products.length} products`;
      return { state: "ok", message: `Scheme · ${reactants} → ${products}` };
    }
    if (!layout.reactants.length && !layout.products.length) {
      return {
        state: "empty",
        message: "Add a reactant and a product, or paste a reaction.",
      };
    }
    if (!layout.reactants.length) {
      return { state: "error", message: "Add a reactant." };
    }
    return { state: "error", message: "Add a product." };
  }
}
