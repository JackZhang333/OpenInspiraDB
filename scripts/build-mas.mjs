import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import pkg from "../package.json" with { type: "json" };

const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const releaseDir = path.join(rootDir, "release");
const targetArch = "universal";
const appPath = path.join(releaseDir, `mas-${targetArch}`, `${pkg.build.productName}.app`);
const pkgPath = path.join(releaseDir, `${pkg.build.productName}-${pkg.version}-${targetArch}.pkg`);
const fallbackInstallerError = 'Cannot find valid "3rd Party Mac Developer Installer" identity';

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

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

function findInstallerIdentity() {
  const result = run("security", ["find-identity", "-v", "-p", "basic"]);
  if (result.status !== 0) {
    fail("Failed to read code signing identities from Keychain.", result.status ?? 1);
  }

  const match = result.stdout.match(/"([^"]*3rd Party Mac Developer Installer:[^"]*)"/);
  if (!match) {
    fail('Could not find a valid "3rd Party Mac Developer Installer" identity in Keychain.');
  }

  return match[1];
}

async function main() {
  const buildResult = run("npm", ["run", "build"]);
  if (buildResult.status !== 0) {
    process.exit(buildResult.status ?? 1);
  }

  await mkdir(releaseDir, { recursive: true });
  await rm(pkgPath, { force: true });

  const builderResult = run("./node_modules/.bin/electron-builder", ["--config", "electron-builder.mas.cjs"]);

  if (builderResult.status === 0) {
    process.exit(0);
  }

  const combinedOutput = `${builderResult.stdout ?? ""}\n${builderResult.stderr ?? ""}`;
  if (!combinedOutput.includes(fallbackInstallerError)) {
    process.exit(builderResult.status ?? 1);
  }

  if (!existsSync(appPath)) {
    fail(`MAS app bundle was not produced at ${appPath}`);
  }

  const verifyResult = run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appPath]);
  if (verifyResult.status !== 0) {
    fail("Signed MAS app bundle failed verification, so the fallback .pkg build was not attempted.", verifyResult.status ?? 1);
  }

  const installerIdentity = findInstallerIdentity();
  const pkgBuildResult = run("productbuild", [
    "--sign",
    installerIdentity,
    "--component",
    appPath,
    "/Applications",
    pkgPath,
  ]);

  if (pkgBuildResult.status !== 0) {
    process.exit(pkgBuildResult.status ?? 1);
  }

  const signatureCheck = run("pkgutil", ["--check-signature", pkgPath]);
  if (signatureCheck.status !== 0) {
    process.exit(signatureCheck.status ?? 1);
  }

  console.log(`Created MAS installer: ${pkgPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
