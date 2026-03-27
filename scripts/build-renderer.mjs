import path from "node:path";
import { spawnSync } from "node:child_process";
import { quarantineBuildPathIfBlocked } from "./quarantine-build-path.mjs";

const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const outDir = path.join(rootDir, "dist", "renderer");
const quarantineRoot = path.join(rootDir, ".build-quarantine");
const viteBin = path.join(rootDir, "node_modules", "vite", "bin", "vite.js");

async function main() {
  await quarantineBuildPathIfBlocked({
    rootDir,
    targetPath: outDir,
    quarantineRoot,
  });

  const result = spawnSync(process.execPath, [viteBin, "build"], {
    cwd: rootDir,
    stdio: "inherit",
    env: process.env,
  });

  if (typeof result.status === "number") {
    process.exit(result.status);
  }

  if (result.error) {
    throw result.error;
  }

  process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
