import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const script = resolve(import.meta.dirname, "i18n-check.mjs");

function fixture(fa, en) {
  const dir = mkdtempSync(join(tmpdir(), "negarlab-i18n-"));
  for (const [locale, catalog] of [
    ["fa", fa],
    ["en", en],
  ]) {
    mkdirSync(join(dir, locale), { recursive: true });
    writeFileSync(join(dir, locale, "common.json"), JSON.stringify(catalog));
  }
  return dir;
}

function run(dir) {
  return spawnSync(process.execPath, [script], {
    env: { ...process.env, NEGARLAB_I18N_DIR: dir },
    encoding: "utf8",
  });
}

test("matching catalogs pass", () => {
  const dir = fixture({ app: { name: "نگارلب" } }, { app: { name: "NegarLab" } });
  try {
    const result = run(dir);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("missing key fails", () => {
  const dir = fixture({ app: { name: "نگارلب", tagline: "x" } }, { app: { name: "NegarLab" } });
  try {
    const result = run(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /"app\.tagline" missing in en/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
