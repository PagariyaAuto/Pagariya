// Run with the existing installed TypeScript dependency. No network or database calls.
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
for (const name of ["date-time-field", "keyboard-focus", "date-validation", "claim-date-integration"]) {
  const result = spawnSync(process.execPath, [path.join(__dirname, "tests/ui-inputs", name + ".cjs")], { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
