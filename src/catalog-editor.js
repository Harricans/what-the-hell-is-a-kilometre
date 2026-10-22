import {
  fetchRepositoryCatalog,
  loadCatalog,
  parseCatalog,
  saveCatalog,
} from "./catalog-store.js";

const table = document.getElementById("catalog-table");
const status = document.getElementById("editor-status");
const fileInput = document.getElementById("import-file");
let catalog;
let dirty = false;

function makeInput({ value = "", type = "text", field, itemId, property, label, placeholder = "" }) {
  const input = document.createElement("input");
  input.className = "catalog-input";
  input.type = type;
  input.value = value ?? "";
  input.dataset.field = field;
  if (itemId) input.dataset.itemId = itemId;
  if (property) input.dataset.property = property;
  input.setAttribute("aria-label", label);
  if (placeholder) input.placeholder = placeholder;
  if (type === "number") {
    input.min = "0";
    input.step = "any";
  }
  if (type === "url") input.placeholder = "https://…";
  return input;
}

function renderTable() {
  const head = document.createElement("thead");
  const headingRow = document.createElement("tr");
  for (const title of ["Item details", ...catalog.properties.map((property) => `${property.label} (${property.unit})`)] ) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = title;
    headingRow.append(cell);
  }
  head.append(headingRow);

  const body = document.createElement("tbody");
  for (const item of catalog.items) {
    const row = document.createElement("tr");
    const details = document.createElement("td");
    for (const [field, label, type] of [
      ["id", "ID", "text"],
      ["name", "Name", "text"],
      ["plural", "Plural", "text"],
      ["emoji", "Emoji", "text"],
      ["category", "Category", "text"],
      ["note", "Fact or caveat", "text"],
    ]) {
      const wrapper = document.createElement("label");
      wrapper.textContent = label;
      wrapper.append(makeInput({
        value: item[field],
        field,
        itemId: item.id,
        label: `${label} for ${item.name}`,
        type,
      }));
      details.append(wrapper);
    }
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "delete-item";
    remove.textContent = "Remove item";
    remove.dataset.removeItem = item.id;
    details.append(remove);
    row.append(details);

    for (const property of catalog.properties) {
      const cell = document.createElement("td");
      cell.className = "property-cell";
      const valueLabel = document.createElement("label");
      valueLabel.textContent = `Value (${property.unit})`;
      valueLabel.append(makeInput({
        value: item.props[property.id],
        type: "number",
        field: "value",
        itemId: item.id,
        property: property.id,
        label: `${property.label} value for ${item.name}`,
      }));
      const sourceLabel = document.createElement("label");
      sourceLabel.textContent = "Source URL";
      sourceLabel.append(makeInput({
        value: item.sources[property.id],
        type: "url",
        field: "source",
        itemId: item.id,
        property: property.id,
        label: `${property.label} source URL for ${item.name}`,
      }));
      cell.append(valueLabel, sourceLabel);
      row.append(cell);
    }
    body.append(row);
  }

  table.replaceChildren(head, body);
}

function findItem(id) {
  return catalog.items.find((item) => item.id === id);
}

function markDirty(message = "Unsaved changes. Save this catalog on the device when ready.") {
  dirty = true;
  status.textContent = message;
}

function updateInput(input) {
  const item = findItem(input.dataset.itemId);
  if (!item) return;
  const { field, property } = input.dataset;
  if (field === "value") {
    const raw = input.value.trim();
    if (!raw) {
      delete item.props[property];
      delete item.sources[property];
    } else {
      const value = Number(raw);
      if (!Number.isFinite(value) || value <= 0) {
        input.setCustomValidity("Enter a positive finite number.");
        input.reportValidity();
        return;
      }
      input.setCustomValidity("");
      item.props[property] = value;
    }
  } else if (field === "source") {
    const source = input.value.trim();
    if (source) item.sources[property] = source;
    else delete item.sources[property];
  } else if (field === "id") {
    const nextId = input.value.trim();
    if (!nextId || catalog.items.some((candidate) => candidate !== item && candidate.id === nextId)) {
      input.setCustomValidity("Item IDs must be unique and non-empty.");
      input.reportValidity();
      return;
    }
    input.setCustomValidity("");
    item.id = nextId;
    for (const fieldInput of table.querySelectorAll(`[data-item-id="${CSS.escape(input.dataset.itemId)}"]`)) {
      fieldInput.dataset.itemId = nextId;
    }
  } else {
    item[field] = input.value.trim();
  }
  markDirty();
}

table.addEventListener("change", (event) => {
  if (event.target.matches("[data-field]")) updateInput(event.target);
});

table.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-item]");
  if (!button) return;
  const item = findItem(button.dataset.removeItem);
  if (!item) return;
  if (!confirm(`Remove "${item.name}" from this catalog?`)) return;
  catalog.items = catalog.items.filter((candidate) => candidate !== item);
  renderTable();
  markDirty("Item removed from the draft. Save to keep the change.");
});

document.getElementById("add-item").addEventListener("click", () => {
  let index = catalog.items.length + 1;
  let id = `new_item_${index}`;
  while (catalog.items.some((item) => item.id === id)) {
    index += 1;
    id = `new_item_${index}`;
  }
  catalog.items.unshift({
    id,
    name: "New item",
    plural: "New items",
    emoji: "📦",
    category: "other",
    props: {},
    note: "",
    sources: {},
  });
  renderTable();
  markDirty("New blank item added. Fill in its details and sourced measurements.");
  table.querySelector(`[data-item-id="${CSS.escape(id)}"][data-field="name"]`)?.focus();
});

document.getElementById("property-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const definition = Object.fromEntries(form.entries());
  definition.id = definition.id.trim();
  if (catalog.properties.some((property) => property.id === definition.id)) {
    status.textContent = `Column "${definition.id}" already exists.`;
    return;
  }
  catalog.properties.push(definition);
  for (const item of catalog.items) {
    item.props ??= {};
    item.sources ??= {};
  }
  event.currentTarget.reset();
  event.currentTarget.elements.questionTemplate.value =
    "How many {aPlural} equal one {bName} by this measure?";
  renderTable();
  markDirty(`Added column "${definition.label}". Enter its measurements and source links where available.`);
});

document.getElementById("save-catalog").addEventListener("click", () => {
  catalog.version = `${catalog.version.split("-edit-")[0]}-edit-${Date.now()}`;
  try {
    saveCatalog(catalog);
    dirty = false;
    status.textContent = "Catalog saved in this browser. It will be used by the game on this device.";
  } catch (error) {
    status.textContent = `Cannot save yet: ${error.message}`;
  }
});

document.getElementById("export-catalog").addEventListener("click", () => {
  try {
    const validated = parseCatalog(JSON.stringify(catalog));
    const blob = new Blob([`${JSON.stringify(validated, null, 2)}\n`], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "items.json";
    link.click();
    URL.revokeObjectURL(link.href);
    status.textContent = "Catalog exported. Replace data/items.json in the repository to publish it for everyone.";
  } catch (error) {
    status.textContent = `Cannot export yet: ${error.message}`;
  }
});

document.getElementById("import-catalog").addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  if (!file) return;
  try {
    catalog = parseCatalog(await file.text());
    renderTable();
    markDirty("Catalog imported into the draft. Save on this device to use it in the game.");
  } catch (error) {
    status.textContent = `Import failed: ${error.message}`;
  } finally {
    fileInput.value = "";
  }
});

document.getElementById("restore-catalog").addEventListener("click", async () => {
  if (dirty && !confirm("Discard unsaved changes and restore the repository catalog?")) return;
  try {
    catalog = await fetchRepositoryCatalog();
    renderTable();
    saveCatalog(catalog);
    dirty = false;
    status.textContent = "Repository catalog restored and saved in this browser.";
  } catch (error) {
    status.textContent = `Could not restore the repository catalog: ${error.message}`;
  }
});

try {
  catalog = await loadCatalog();
  renderTable();
  status.textContent = "Catalog ready. Changes are a draft until you save them.";
} catch (error) {
  status.textContent = `Could not load catalog: ${error.message}`;
}

window.addEventListener("beforeunload", (event) => {
  if (dirty) {
    event.preventDefault();
    event.returnValue = "";
  }
});
