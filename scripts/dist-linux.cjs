const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = process.cwd();
const releaseDir = path.join(rootDir, "dist", "release");
const supportedArchitectures = ["x64", "arm64"];
const linuxArtifactAliasesByArchitecture = {
  x64: ["x64", "x86_64", "amd64"],
  arm64: ["arm64", "aarch64"]
};
const elfMachineByArchitecture = {
  x64: 0x3e,
  arm64: 0xb7
};
const archLabelByMachine = {
  0x3e: "x64",
  0xb7: "arm64"
};

const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
const electronBuilderExecutable =
  process.platform === "win32" ? "electron-builder.cmd" : "electron-builder";

function runCommand(command, args) {
  console.log(`[dist-linux] > ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: "inherit",
    shell: false
  });

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

function parseRequestedArchitectures(argv) {
  let requestedArchitecture;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument.startsWith("--arch=")) {
      requestedArchitecture = argument.slice("--arch=".length);
      continue;
    }

    if (argument === "--arch") {
      const nextArgument = argv[index + 1];
      if (!nextArgument || nextArgument.startsWith("-")) {
        throw new Error("Missing value for --arch. Use --arch=x64 or --arch=arm64.");
      }
      requestedArchitecture = nextArgument;
      index += 1;
    }
  }

  if (requestedArchitecture === undefined) {
    return supportedArchitectures;
  }

  if (!supportedArchitectures.includes(requestedArchitecture)) {
    throw new Error(
      `Unsupported architecture "${requestedArchitecture}". Supported architectures: ${supportedArchitectures.join(
        ", "
      )}.`
    );
  }

  return [requestedArchitecture];
}

function getAppImagePath(version, architecture) {
  return path.join(releaseDir, `BudgetIT-${version}-linux-${architecture}.AppImage`);
}

function getDebPath(version, architecture) {
  return path.join(releaseDir, `BudgetIT-${version}-linux-${architecture}.deb`);
}

function getUnpackedDirectory(architecture) {
  return architecture === "x64" ? "linux-unpacked" : `linux-${architecture}-unpacked`;
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

function readElfMachineType(filePath) {
  const binary = fs.readFileSync(filePath);
  if (binary.length < 20) {
    throw new Error(`File is too small to be an ELF binary: ${filePath}`);
  }

  if (
    binary[0] !== 0x7f ||
    binary[1] !== 0x45 ||
    binary[2] !== 0x4c ||
    binary[3] !== 0x46
  ) {
    throw new Error(`File is not an ELF binary: ${filePath}`);
  }

  const endianIndicator = binary[5];
  if (endianIndicator === 1) {
    return binary.readUInt16LE(18);
  }
  if (endianIndicator === 2) {
    return binary.readUInt16BE(18);
  }
  throw new Error(`Unsupported ELF endian value ${endianIndicator} in file: ${filePath}`);
}

function assertFileExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} missing: ${filePath}`);
  }
}

function resolveLinuxArtifactPath(version, architecture, extension) {
  const aliases = linuxArtifactAliasesByArchitecture[architecture];
  for (const alias of aliases) {
    const candidate = path.join(releaseDir, `BudgetIT-${version}-linux-${alias}.${extension}`);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Unable to find Linux ${extension} artifact for architecture ${architecture} in ${releaseDir}.`
  );
}

function normalizeLinuxArtifactNames(version, architecture) {
  const canonicalAppImagePath = getAppImagePath(version, architecture);
  const canonicalDebPath = getDebPath(version, architecture);

  const builtAppImagePath = resolveLinuxArtifactPath(version, architecture, "AppImage");
  const builtDebPath = resolveLinuxArtifactPath(version, architecture, "deb");

  if (builtAppImagePath !== canonicalAppImagePath) {
    fs.renameSync(builtAppImagePath, canonicalAppImagePath);
  }

  const builtAppImageBlockMapPath = `${builtAppImagePath}.blockmap`;
  const canonicalAppImageBlockMapPath = `${canonicalAppImagePath}.blockmap`;
  if (fs.existsSync(builtAppImageBlockMapPath)) {
    if (builtAppImageBlockMapPath !== canonicalAppImageBlockMapPath) {
      fs.renameSync(builtAppImageBlockMapPath, canonicalAppImageBlockMapPath);
    }
  }

  if (builtDebPath !== canonicalDebPath) {
    fs.renameSync(builtDebPath, canonicalDebPath);
  }
}

function assertNativeModuleArchitecture(architecture) {
  const nativeModulePath = getNativeModulePath(architecture);
  assertFileExists(nativeModulePath, "Native module binary");

  const expectedMachine = elfMachineByArchitecture[architecture];
  const actualMachine = readElfMachineType(nativeModulePath);
  if (actualMachine !== expectedMachine) {
    const expectedLabel = archLabelByMachine[expectedMachine] || `0x${expectedMachine.toString(16)}`;
    const actualLabel = archLabelByMachine[actualMachine] || `0x${actualMachine.toString(16)}`;
    throw new Error(
      `Native module architecture mismatch for ${architecture}: expected ${expectedLabel}, got ${actualLabel} (${nativeModulePath}).`
    );
  }

  console.log(`[dist-linux] verified native module architecture: ${architecture}`);
}

function packageArchitecture(version, architecture) {
  const aliases = linuxArtifactAliasesByArchitecture[architecture];
  const unpackedDirectoryPath = path.join(releaseDir, getUnpackedDirectory(architecture));

  for (const alias of aliases) {
    const appImagePath = path.join(releaseDir, `BudgetIT-${version}-linux-${alias}.AppImage`);
    const appImageBlockMapPath = `${appImagePath}.blockmap`;
    const debPath = path.join(releaseDir, `BudgetIT-${version}-linux-${alias}.deb`);
    removeIfExists(appImagePath);
    removeIfExists(appImageBlockMapPath);
    removeIfExists(debPath);
  }

  removeIfExists(unpackedDirectoryPath);

  runCommand(npmExecutable, ["run", "rebuild:native:electron", "--", `--arch=${architecture}`]);
  runCommand(electronBuilderExecutable, [
    "--config",
    "electron-builder.yml",
    "--config.npmRebuild=false",
    "--linux",
    "AppImage",
    "deb",
    `--${architecture}`,
    "--publish",
    "never"
  ]);

  normalizeLinuxArtifactNames(version, architecture);
  assertFileExists(getAppImagePath(version, architecture), "AppImage artifact");
  assertFileExists(getDebPath(version, architecture), "Deb artifact");
  assertNativeModuleArchitecture(architecture);
}

function run() {
  const architectures = parseRequestedArchitectures(process.argv.slice(2));
  const version = getPackageVersion();

  console.log(
    `[dist-linux] packaging BudgetIT ${version} for ${architectures.join(", ")}`
  );

  runCommand(npmExecutable, ["run", "build"]);

  for (const architecture of architectures) {
    packageArchitecture(version, architecture);
  }

  for (const architecture of architectures) {
    assertFileExists(getAppImagePath(version, architecture), "AppImage artifact");
    assertFileExists(getDebPath(version, architecture), "Deb artifact");
  }

  console.log("[dist-linux] packaging complete");
}

try {
  run();
} catch (error) {
  console.error("[dist-linux] failed", error);
  process.exitCode = 1;
}
