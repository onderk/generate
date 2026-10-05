"use strict";

// Legacy debt that predates this suite is allowlisted in test/baseline.json
// rather than fixed in one sweep. Both directions fail: something new is fresh
// debt, something fixed but still listed is a stale exemption. That keeps the
// allowlist a shrinking ledger instead of a permanent amnesty.

const assert = require("node:assert/strict");

const REGEN = "run `npm run test:baseline` to update test/baseline.json";

// found/allowed: { "path/to/file.md": <count> }
function assertCountRatchet(found, allowed, label) {
  const added = [];
  const stale = [];

  for (const [file, count] of Object.entries(found)) {
    const permitted = allowed[file] || 0;
    if (count > permitted) added.push(`${file}: found ${count}, allowed ${permitted}`);
    if (count < permitted) stale.push(`${file}: found ${count}, allowed ${permitted}`);
  }
  for (const [file, count] of Object.entries(allowed)) {
    if (!found[file]) stale.push(`${file}: found 0, allowed ${count}`);
  }

  report(added, stale, label);
}

// found/allowed: { "path/to/file.md": ["href", ...] }
function assertSetRatchet(found, allowed, label) {
  const added = [];
  const stale = [];
  const files = new Set([...Object.keys(found), ...Object.keys(allowed)]);

  for (const file of files) {
    const now = new Set(found[file] || []);
    const permitted = new Set(allowed[file] || []);
    for (const item of now) {
      if (!permitted.has(item)) added.push(`${file} -> ${item}`);
    }
    for (const item of permitted) {
      if (!now.has(item)) stale.push(`${file} -> ${item}`);
    }
  }

  report(added, stale, label);
}

function report(added, stale, label) {
  assert.deepEqual(added, [], `new ${label}:\n  ${added.join("\n  ")}`);
  assert.deepEqual(
    stale,
    [],
    `${label} no longer present but still allowlisted -- ${REGEN}:\n  ${stale.join("\n  ")}`
  );
}

module.exports = { assertCountRatchet, assertSetRatchet };
