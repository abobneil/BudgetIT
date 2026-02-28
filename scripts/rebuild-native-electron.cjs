const { rebuild } = require("@electron/rebuild");
const electronVersion = require("electron/package.json").version;

async function run() {
  console.log(
    `[rebuild-native] rebuilding better-sqlite3-multiple-ciphers for Electron ${electronVersion}`
  );

  await rebuild({
    buildPath: process.cwd(),
    electronVersion,
    force: true,
    onlyModules: ["better-sqlite3-multiple-ciphers"]
  });

  console.log("[rebuild-native] native module rebuild complete");
}

run().catch((error) => {
  console.error("[rebuild-native] failed", error);
  process.exitCode = 1;
});
