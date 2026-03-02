const path = require("node:path");
const { spawnSync } = require("node:child_process");

const scriptPath = path.join(__dirname, "help-tools.cjs");
const result = spawnSync(process.execPath, [scriptPath, "check"], {
  stdio: "inherit"
});

if (typeof result.status === "number") {
  process.exitCode = result.status;
} else {
  process.exitCode = 1;
}
