import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const localesRoot = process.env.NEGARLAB_I18N_DIR ?? "apps/web/src/i18n/locales";
const locales = ["fa", "en"];

function flatten(value, prefix = "", out = new Map()) {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
    }
  } else {
    out.set(prefix, value);
  }
  return out;
}

function loadLocale(locale) {
  const dir = join(localesRoot, locale);
  let files;
  try {
    files = readdirSync(dir).filter((file) => file.endsWith(".json"));
  } catch {
    throw new Error(`i18n: missing locale directory ${dir}`);
  }
  const keys = new Map();
  for (const file of files.sort()) {
    const json = JSON.parse(readFileSync(join(dir, file), "utf8"));
    for (const [key, value] of flatten(json)) {
      if (keys.has(key)) {
        throw new Error(`i18n: duplicate key "${key}" in ${locale}/${file}`);
      }
      keys.set(key, value);
    }
  }
  return keys;
}

let available;
try {
  available = readdirSync(localesRoot);
} catch {
  console.log(`i18n: no locales yet at ${localesRoot}, skipping`);
  process.exit(0);
}

let failed = false;
const catalogs = new Map();

for (const locale of locales) {
  if (!available.includes(locale)) {
    console.error(`i18n: missing locale "${locale}" in ${localesRoot}`);
    failed = true;
    continue;
  }
  try {
    catalogs.set(locale, loadLocale(locale));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    failed = true;
  }
}

if (!failed && catalogs.size === locales.length) {
  const allKeys = new Set();
  for (const keys of catalogs.values()) {
    for (const key of keys.keys()) allKeys.add(key);
  }
  for (const [locale, keys] of catalogs) {
    for (const key of allKeys) {
      if (!keys.has(key)) {
        console.error(`i18n: "${key}" missing in ${locale}`);
        failed = true;
      }
    }
    for (const key of keys.keys()) {
      if (!allKeys.has(key)) {
        console.error(`i18n: "${key}" in ${locale} is unused`);
        failed = true;
      }
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log(`i18n: catalogs in sync (${catalogs.get("fa").size} keys)`);
