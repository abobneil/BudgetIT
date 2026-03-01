const { execFileSync } = require("node:child_process");

function run() {
  const moduleName = "better-sqlite3-multiple-ciphers";
  console.log(`[rebuild-native] rebuilding ${moduleName} for local Node runtime`);
  execFileSync("npm", ["rebuild", moduleName], {
    stdio: "inherit",
    shell: process.platform === "win32"
  });
  console.log("[rebuild-native] node-native module rebuild complete");
}

try {
  run();
} catch (error) {
  console.error("[rebuild-native] failed", error);
  process.exitCode = 1;
}
