const { rebuild } = require("@electron/rebuild");
const electronVersion = require("electron/package.json").version;
const supportedArchitectures = new Set(["x64", "arm64"]);

function parseArchitecture(argv) {
  let architecture = process.arch;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument.startsWith("--arch=")) {
      architecture = argument.slice("--arch=".length);
      continue;
    }

    if (argument === "--arch") {
      const nextArgument = argv[index + 1];
      if (!nextArgument || nextArgument.startsWith("-")) {
        throw new Error("Missing value for --arch. Use --arch=x64 or --arch=arm64.");
      }
      architecture = nextArgument;
      index += 1;
    }
  }

  if (!supportedArchitectures.has(architecture)) {
    throw new Error(
      `Unsupported architecture "${architecture}". Supported architectures: ${Array.from(
        supportedArchitectures
      ).join(", ")}.`
    );
  }

  return architecture;
}

async function run() {
  const arch = parseArchitecture(process.argv.slice(2));

  console.log(
    `[rebuild-native] rebuilding better-sqlite3-multiple-ciphers for Electron ${electronVersion} (${arch})`
  );

  await rebuild({
    buildPath: process.cwd(),
    electronVersion,
    arch,
    force: true,
    onlyModules: ["better-sqlite3-multiple-ciphers"]
  });

  console.log(`[rebuild-native] native module rebuild complete (${arch})`);
}

run().catch((error) => {
  console.error("[rebuild-native] failed", error);
  process.exitCode = 1;
});
