const LIST_IDS = {
  reactant: "editor-reactants",
  product: "editor-products",
  reagent: "editor-reagents",
};

export class SchemeEditor {
  static apply(scheme, action) {
    switch (action.type) {
      case "intake":
        scheme.replaceFromParsed(action.parsed);
        return scheme;
      case "add":
        return scheme.add(action.role, action.label ?? "");
      case "remove":
        scheme.remove(action.id);
        return scheme;
      case "move":
        scheme.move(action.id, action.delta);
        return scheme;
      case "relabel":
        scheme.setLabel(action.id, action.label);
        return scheme;
      case "reagents":
        scheme.setReagentsText(action.text);
        return scheme;
      case "conditions":
        scheme.setConditionsText(action.text);
        return scheme;
      default:
        throw new Error(`Unknown editor action: ${action.type}`);
    }
  }

  static row(item) {
    const row = document.createElement("div");
    row.className = "editor-row";
    row.dataset.id = item.id;
    row.dataset.role = item.role;

    const input = document.createElement("input");
    input.type = "text";
    input.value = item.label;
    input.dataset.action = "relabel";
    input.setAttribute("aria-label", `${item.role} label`);
    row.appendChild(input);

    const controls = [
      ["move-up", "↑", `Move ${item.role} up`],
      ["move-down", "↓", `Move ${item.role} down`],
      ["remove", "×", `Remove ${item.role}`],
    ];
    for (const [action, symbol, label] of controls) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ghost editor-icon";
      button.dataset.action = action;
      button.setAttribute("aria-label", label);
      button.textContent = symbol;
      row.appendChild(button);
    }
    return row;
  }

  static render(root, scheme) {
    for (const role of Object.keys(LIST_IDS)) {
      const list = root.querySelector(`#${LIST_IDS[role]}`);
      if (!list) continue;
      list.replaceChildren();
      for (const item of scheme.species(role)) {
        list.appendChild(SchemeEditor.row(item));
      }
    }
  }

  static bind(root, dispatch) {
    root.addEventListener("click", (event) => {
      const add = event.target.closest("[data-add]");
      if (add) {
        dispatch({ type: "add", role: add.dataset.add, label: "" });
        return;
      }
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const row = button.closest("[data-id]");
      if (!row) return;
      const id = row.dataset.id;
      if (button.dataset.action === "remove") {
        dispatch({ type: "remove", id });
      } else if (button.dataset.action === "move-up") {
        dispatch({ type: "move", id, delta: -1 });
      } else if (button.dataset.action === "move-down") {
        dispatch({ type: "move", id, delta: 1 });
      }
    });
    root.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.dataset.action === "relabel") {
        const row = target.closest("[data-id]");
        if (row) dispatch({ type: "relabel", id: row.dataset.id, label: target.value });
        return;
      }
      if (target.dataset.action === "reagents") {
        dispatch({ type: "reagents", text: target.value });
        return;
      }
      if (target.dataset.action === "conditions") {
        dispatch({ type: "conditions", text: target.value });
      }
    });
  }

  static arrowField(action, value, label, placeholder, className) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = className;
    input.dataset.action = action;
    input.value = value;
    input.setAttribute("aria-label", label);
    input.placeholder = placeholder;
    return input;
  }

  static hydrateArrow(stageEl, scheme) {
    const above = stageEl.querySelector(".arrow-block .above");
    const below = stageEl.querySelector(".arrow-block .below");
    if (above) {
      above.replaceWith(
        SchemeEditor.arrowField(
          "reagents",
          scheme.reagentsText(),
          "Reagents above arrow",
          "H2SO4",
          "arrow-reagents",
        ),
      );
    }
    if (below) {
      below.replaceWith(
        SchemeEditor.arrowField(
          "conditions",
          scheme.conditionsText(),
          "Conditions below arrow",
          "3 h, rt",
          "arrow-conditions",
        ),
      );
    }
  }
}
