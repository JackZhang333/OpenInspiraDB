import { writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import pkg from "../package.json" with { type: "json" };
import { makeBuildVersion } from "./build-version.cjs";

const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const releaseDir = path.join(rootDir, "release");
const targetArch = "universal";
const appPath = path.join(releaseDir, `mas-${targetArch}`, `${pkg.build.productName}.app`);
const pkgPath = path.join(releaseDir, `${pkg.build.productName}-${pkg.version}-${targetArch}.pkg`);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    encoding: "utf8",
    ...options,
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  return result;
}

function runQuiet(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: rootDir,
    encoding: "utf8",
    ...options,
  });
}

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

function requireSuccess(result, message) {
  if (result.status !== 0) {
    fail(message, result.status ?? 1);
  }
}

function readStdout(result, message) {
  requireSuccess(result, message);
  return (result.stdout || "").trim();
}

async function main() {
  const buildVersion = process.env.BUILD_BUNDLE_VERSION || makeBuildVersion();
  const buildResult = run("npm", ["run", "dist:mas"], {
    env: {
      ...process.env,
      BUILD_BUNDLE_VERSION: buildVersion,
    },
  });
  requireSuccess(buildResult, "MAS build failed.");

  const appArchs = readStdout(
    runQuiet("lipo", ["-archs", path.join(appPath, "Contents/MacOS", pkg.build.productName)]),
    "Failed to read app executable architectures.",
  );
  const frameworkArchs = readStdout(
    runQuiet("lipo", [
      "-archs",
      path.join(
        appPath,
        "Contents/Frameworks/Electron Framework.framework/Versions/A/Electron Framework",
      ),
    ]),
    "Failed to read Electron Framework architectures.",
  );
  const pkgSignature = readStdout(
    runQuiet("pkgutil", ["--check-signature", pkgPath]),
    "Failed to verify the final MAS installer signature.",
  );

  const summary = [
    `Product: ${pkg.build.productName}`,
    `Marketing version: ${pkg.version}`,
    `Build version: ${buildVersion}`,
    `App path: ${appPath}`,
    `Pkg path: ${pkgPath}`,
    `App architectures: ${appArchs}`,
    `Framework architectures: ${frameworkArchs}`,
    "",
    "pkgutil --check-signature:",
    pkgSignature,
    "",
    "Upload this file with Transporter:",
    pkgPath,
  ].join("\n");

  const summaryPath = path.join(releaseDir, "mas-upload-summary.txt");
  await writeFile(summaryPath, `${summary}\n`, "utf8");

  console.log("");
  console.log(summary);
  console.log("");
  console.log(`Saved upload summary: ${summaryPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
