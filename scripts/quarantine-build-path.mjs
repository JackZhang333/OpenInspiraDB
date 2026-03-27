import { constants } from "node:fs";
import { access, mkdir, readdir, rename } from "node:fs/promises";
import path from "node:path";

function toRelativePath(rootDir, targetPath) {
  return path.relative(rootDir, targetPath) || ".";
}

async function pathExists(targetPath) {
  try {
    await access(targetPath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function findFirstBlockedDirectory(dirPath) {
  try {
    await access(dirPath, constants.W_OK | constants.X_OK);
  } catch (error) {
    return {
      blockedPath: dirPath,
      error,
    };
  }

  const entries = await readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const nestedResult = await findFirstBlockedDirectory(path.join(dirPath, entry.name));
    if (nestedResult) {
      return nestedResult;
    }
  }

  return null;
}

function buildQuarantineName(rootDir, targetPath) {
  const relativePath = toRelativePath(rootDir, targetPath);
  return relativePath.replace(/[\\/]+/g, "-");
}

export async function quarantineBuildPathIfBlocked({
  rootDir,
  targetPath,
  quarantineRoot,
}) {
  if (!(await pathExists(targetPath))) {
    return null;
  }

  const blockedDirectory = await findFirstBlockedDirectory(targetPath);
  if (!blockedDirectory) {
    return null;
  }

  await mkdir(quarantineRoot, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const quarantineDir = path.join(
    quarantineRoot,
    `${buildQuarantineName(rootDir, targetPath)}-${stamp}`,
  );

  try {
    await rename(targetPath, quarantineDir);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      [
        `Failed to move ${toRelativePath(rootDir, targetPath)} out of the way before rebuilding.`,
        `Blocked directory: ${toRelativePath(rootDir, blockedDirectory.blockedPath)}`,
        `Move attempt failed: ${message}`,
        "This usually means a previous build created root-owned files.",
      ].join("\n"),
    );
  }

  console.warn(
    [
      `Detected stale build output that cannot be cleaned normally: ${toRelativePath(rootDir, blockedDirectory.blockedPath)}`,
      `Moved ${toRelativePath(rootDir, targetPath)} to ${toRelativePath(rootDir, quarantineDir)} and continuing with a fresh build.`,
      "A previous build was likely run with sudo or another elevated account.",
    ].join("\n"),
  );

  return quarantineDir;
}
