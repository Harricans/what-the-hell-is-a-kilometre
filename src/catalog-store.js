import { validateCatalog } from "./questions.js";

export const CATALOG_STORAGE_KEY = "wthk.catalog.v1";

export async function fetchRepositoryCatalog(fetcher = fetch) {
  const response = await fetcher("./data/items.json");
  if (!response.ok) throw new Error("Could not load the repository catalog.");
  return validateCatalog(await response.json());
}

export async function loadCatalog({ fetcher = fetch, storage } = {}) {
  let saved;
  try {
    saved = (storage ?? globalThis.localStorage).getItem(CATALOG_STORAGE_KEY);
  } catch {
    saved = null;
  }
  if (saved) {
    try {
      return validateCatalog(JSON.parse(saved));
    } catch {
      // Fall back to the committed catalog if the local copy is invalid.
    }
  }
  return fetchRepositoryCatalog(fetcher);
}

export function saveCatalog(catalog, storage) {
  validateCatalog(catalog);
  (storage ?? globalThis.localStorage).setItem(CATALOG_STORAGE_KEY, JSON.stringify(catalog));
  return catalog;
}

export function parseCatalog(text) {
  return validateCatalog(JSON.parse(text));
}
