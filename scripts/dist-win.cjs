const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = process.cwd();
const releaseDir = path.join(rootDir, "dist", "release");
const supportedArchitectures = ["x64", "arm64"];
const peMachineByArchitecture = {
  x64: 0x8664,
  arm64: 0xaa64
};
const archLabelByMachine = {
  0x8664: "x64",
  0xaa64: "arm64",
  0x14c: "x86"
};

const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
const electronBuilderExecutable =
  process.platform === "win32" ? "electron-builder.cmd" : "electron-builder";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function quoteWindowsArgument(argument) {
  if (argument.length === 0) {
    return "\"\"";
  }

  if (!/[\s"]/u.test(argument)) {
    return argument;
  }

  const escapedArgument = argument
    .replace(/(\\*)"/g, "$1$1\\\"")
    .replace(/(\\+)$/g, "$1$1");
  return `"${escapedArgument}"`;
}

function runCommand(command, args) {
  console.log(`[dist-win] > ${command} ${args.join(" ")}`);
  const options = {
    cwd: rootDir,
    stdio: "inherit",
    shell: false
  };

  const result =
    process.platform === "win32"
      ? spawnSync(
          process.env.ComSpec || "cmd.exe",
          [
            "/d",
            "/s",
            "/c",
            [command, ...args].map((argument) => quoteWindowsArgument(argument)).join(" ")
          ],
          options
        )
      : spawnSync(command, args, options);

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Command failed with exit code ${result.status}: ${command}`);
  }
}

function removeIfExists(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return;
  }

  const stat = fs.statSync(targetPath);
  if (stat.isDirectory()) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  } else {
    fs.rmSync(targetPath, { force: true });
  }
}

function getPackageVersion() {
  const packageJsonPath = path.join(rootDir, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  if (typeof packageJson.version !== "string" || packageJson.version.trim() === "") {
    throw new Error(`Invalid package version in ${packageJsonPath}`);
  }
  return packageJson.version.trim();
}

function getInstallerPath(version, architecture) {
  return path.join(releaseDir, `BudgetIT-Setup-${version}-${architecture}.exe`);
}

function getInstallerBlockMapPath(version, architecture) {
  return `${getInstallerPath(version, architecture)}.blockmap`;
}

function listMatchingInstallerFiles(architecture) {
  if (!fs.existsSync(releaseDir)) {
    return [];
  }

  const suffix = `-${architecture}.exe`;
  const matcher = new RegExp(
    `^BudgetIT-Setup-.+${escapeRegExp(suffix)}$`,
    "u"
  );

  return fs
    .readdirSync(releaseDir)
    .filter((entry) => matcher.test(entry))
    .map((entry) => path.join(releaseDir, entry));
}

function resolveInstallerPath(version, architecture) {
  const canonicalPath = getInstallerPath(version, architecture);
  if (fs.existsSync(canonicalPath)) {
    return canonicalPath;
  }

  const candidates = listMatchingInstallerFiles(architecture);
  if (candidates.length === 1) {
    return candidates[0];
  }

  if (candidates.length === 0) {
    throw new Error(`Installer missing: ${canonicalPath}`);
  }

  throw new Error(
    `Ambiguous installer candidates for ${architecture}: ${candidates.join(", ")}`
  );
}

function normalizeInstallerNames(version, architecture) {
  const canonicalInstallerPath = getInstallerPath(version, architecture);
  const builtInstallerPath = resolveInstallerPath(version, architecture);

  if (builtInstallerPath !== canonicalInstallerPath) {
    fs.renameSync(builtInstallerPath, canonicalInstallerPath);
  }

  const builtBlockMapPath = `${builtInstallerPath}.blockmap`;
  const canonicalBlockMapPath = getInstallerBlockMapPath(version, architecture);
  if (fs.existsSync(builtBlockMapPath) && builtBlockMapPath !== canonicalBlockMapPath) {
    fs.renameSync(builtBlockMapPath, canonicalBlockMapPath);
  }
}

function getUnpackedDirectory(architecture) {
  return architecture === "x64" ? "win-unpacked" : `win-${architecture}-unpacked`;
}

function getNativeModulePath(architecture) {
  return path.join(
    releaseDir,
    getUnpackedDirectory(architecture),
    "resources",
    "app.asar.unpacked",
    "node_modules",
    "better-sqlite3-multiple-ciphers",
    "build",
    "Release",
    "better_sqlite3.node"
  );
}

function readPeMachineType(filePath) {
  const binary = fs.readFileSync(filePath);

  if (binary.length < 64 || binary.toString("ascii", 0, 2) !== "MZ") {
    throw new Error(`File is not a PE binary: ${filePath}`);
  }

  // Parse PE header to confirm the compiled machine architecture.
  const peHeaderOffset = binary.readUInt32LE(0x3c);
  if (peHeaderOffset + 6 >= binary.length) {
    throw new Error(`Invalid PE header in file: ${filePath}`);
  }
  if (binary.toString("ascii", peHeaderOffset, peHeaderOffset + 4) !== "PE\u0000\u0000") {
    throw new Error(`Missing PE signature in file: ${filePath}`);
  }

  return binary.readUInt16LE(peHeaderOffset + 4);
}

function assertFileExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} missing: ${filePath}`);
  }
}

function assertNativeModuleArchitecture(architecture) {
  const nativeModulePath = getNativeModulePath(architecture);
  assertFileExists(nativeModulePath, "Native module binary");

  const expectedMachine = peMachineByArchitecture[architecture];
  const actualMachine = readPeMachineType(nativeModulePath);
  if (actualMachine !== expectedMachine) {
    const expectedLabel = archLabelByMachine[expectedMachine] || `0x${expectedMachine.toString(16)}`;
    const actualLabel = archLabelByMachine[actualMachine] || `0x${actualMachine.toString(16)}`;
    throw new Error(
      `Native module architecture mismatch for ${architecture}: expected ${expectedLabel}, got ${actualLabel} (${nativeModulePath}).`
    );
  }

  console.log(`[dist-win] verified native module architecture: ${architecture}`);
}

function packageArchitecture(version, architecture) {
  const installerPath = getInstallerPath(version, architecture);
  const installerBlockMapPath = getInstallerBlockMapPath(version, architecture);
  const unpackedDirectoryPath = path.join(releaseDir, getUnpackedDirectory(architecture));

  removeIfExists(installerPath);
  removeIfExists(installerBlockMapPath);
  removeIfExists(unpackedDirectoryPath);

  runCommand(npmExecutable, ["run", "rebuild:native:electron", "--", `--arch=${architecture}`]);
  runCommand(electronBuilderExecutable, [
    "--config",
    "electron-builder.yml",
    "--config.npmRebuild=false",
    "--win",
    "nsis",
    `--${architecture}`,
    "--publish",
    "never"
  ]);

  normalizeInstallerNames(version, architecture);
  assertFileExists(installerPath, "Installer");
  assertNativeModuleArchitecture(architecture);
}

function run() {
  const version = getPackageVersion();

  console.log(`[dist-win] packaging BudgetIT ${version} for ${supportedArchitectures.join(", ")}`);

  runCommand(npmExecutable, ["run", "build"]);

  for (const architecture of supportedArchitectures) {
    packageArchitecture(version, architecture);
  }

  for (const architecture of supportedArchitectures) {
    const installerPath = getInstallerPath(version, architecture);
    assertFileExists(installerPath, "Installer");
  }

  console.log("[dist-win] dual-architecture packaging complete");
}

try {
  run();
} catch (error) {
  console.error("[dist-win] failed", error);
  process.exitCode = 1;
}
