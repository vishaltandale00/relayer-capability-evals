import { lstat, mkdir, readFile, realpath, rm, symlink } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";

const runnerIndex = process.argv.indexOf("--runner");
const checkout = runnerIndex >= 0 ? process.argv[runnerIndex + 1] : undefined;
if (!checkout || !isAbsolute(checkout)) {
  throw new Error("Usage: npm run setup -- --runner /absolute/path/to/built/relayer-graphcomplete");
}
const packageRoot = resolve(checkout, "packages/eval-runner");
const manifest = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));
if (manifest.name !== "@relayer/eval-runner") throw new Error(`${packageRoot} is not @relayer/eval-runner.`);
await lstat(join(packageRoot, "dist/index.js"));
const target = resolve("node_modules/@relayer/eval-runner");
await mkdir(dirname(target), { recursive: true });
await rm(target, { recursive: true, force: true });
await symlink(await realpath(packageRoot), target, "dir");
console.log(`Linked @relayer/eval-runner to ${await realpath(packageRoot)}`);
