import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import {
  JUPYTERLAB_EXECUTION_BUNDLES_CASE_ID,
  JUPYTERLAB_REPOSITORY_URL,
  JUPYTERLAB_UPSTREAM_COMMIT,
  JUPYTERLAB_UPSTREAM_TREE,
  gradeJupyterLabExecutionBundlesWorkspace,
  jupyterLabExecutionBundlesCase,
  materializeJupyterLabExecutionBundlesFixture,
} from "../src/project-cases/jupyterlab-execution-bundles.js";
import type { CommandRunner } from "../src/project-cases/h3.js";

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("JupyterLab reproducible execution-bundles case", () => {
  it("binds a safe immutable case snapshot to the pinned real repository", () => {
    expect(jupyterLabExecutionBundlesCase.definition.id).toBe(
      JUPYTERLAB_EXECUTION_BUNDLES_CASE_ID,
    );
    expect(jupyterLabExecutionBundlesCase.snapshot.authoringStatus).toBe(
      "candidate",
    );
    expect(
      jupyterLabExecutionBundlesCase.snapshot.artifacts.workspace,
    ).toMatchObject({
      source: JUPYTERLAB_REPOSITORY_URL,
      revision: `git-tree:${JUPYTERLAB_UPSTREAM_TREE}`,
    });
    expect(
      jupyterLabExecutionBundlesCase.snapshot.artifacts.verifier.mandatoryGates,
    ).toHaveLength(6);
    expect(jupyterLabExecutionBundlesCase.snapshotDigest).toMatch(
      /^sha256:[a-f0-9]{64}$/,
    );
    expect(
      JSON.stringify(jupyterLabExecutionBundlesCase.catalogSnapshot),
    ).not.toContain("sealedPath");
    expect(
      jupyterLabExecutionBundlesCase.definition.threads[0]?.prompts[0],
    ).toContain("will not inspect your source");
  });

  it("materializes only the pinned tree with the checked-in immutable Yarn runtime", async () => {
    const commands: string[] = [];
    const runCommand: CommandRunner = async (command, args) => {
      commands.push(`${command} ${args.join(" ")}`);
      if (command === "git" && args[0] === "rev-parse") {
        return {
          exitCode: 0,
          stdout:
            args[1] === "HEAD"
              ? `${JUPYTERLAB_UPSTREAM_COMMIT}\n`
              : `${JUPYTERLAB_UPSTREAM_TREE}\n`,
          stderr: "",
        };
      }
      if (command === "git" && args[0] === "status")
        return { exitCode: 0, stdout: "", stderr: "" };
      return { exitCode: 0, stdout: "", stderr: "" };
    };
    const root = await disposableDirectory();
    const cache = join(root, "cache");
    const workspace = join(root, "workspace");
    await mkdir(join(cache, "packages/notebook"), { recursive: true });
    await mkdir(join(cache, "jupyterlab/staging"), { recursive: true });
    await writeFile(
      join(cache, "packages/notebook/package.json"),
      JSON.stringify({ license: "BSD-3-Clause", version: "4.4.9" }),
    );
    await writeFile(
      join(cache, "LICENSE"),
      "Redistribution and use in source and binary forms\n",
    );
    await writeFile(join(cache, "yarn.lock"), "");
    await writeFile(join(cache, "jupyterlab/staging/yarn.js"), "");
    await writeFile(join(cache, ".yarnrc.yml"), "");

    await expect(
      materializeJupyterLabExecutionBundlesFixture({
        cacheDirectory: cache,
        workspaceDirectory: workspace,
        platform: "darwin",
        nodeVersion: "22.23.2",
        runCommand,
      }),
    ).rejects.toThrow("digest mismatch");
    expect(
      commands.some((command) => command.includes("install --immutable")),
    ).toBe(false);
  });

  it("content-addresses the complete two-solution reference collection", async () => {
    const paths = [
      "README.md",
      "green-recursive.patch",
      "green-normalized.patch",
    ];
    const hashes = await Promise.all(
      paths.map(async (path) =>
        createHash("sha256")
          .update(
            await readFile(
              join(
                process.cwd(),
                "eval-cases/jupyterlab-execution-bundles/solution",
                path,
              ),
            ),
          )
          .digest("hex"),
      ),
    );
    expect(
      `sha256:${createHash("sha256").update(hashes.join(":")).digest("hex")}`,
    ).toBe(
      jupyterLabExecutionBundlesCase.snapshot.artifacts.reference.contentDigest,
    );
  });

  it("keeps the untouched upstream baseline red and records every predicate independently", async () => {
    const checks = await gradeFixture("export {};\n");
    expect(
      checks
        .filter((check) => check.name.includes("workspace:bundle-"))
        .every((check) => !check.passed),
    ).toBe(true);
    expect(
      checks
        .filter((check) => check.name.includes("workspace:bundle-"))
        .map((check) => check.name),
    ).toHaveLength(12);
  });

  it("admits two materially different public implementations", async () => {
    const recursiveCanonicalizer = await gradeFixture(
      greenSolution("recursive"),
    );
    const normalizedJson = await gradeFixture(greenSolution("normalized"));
    expect(recursiveCanonicalizer.filter((check) => !check.passed)).toEqual([]);
    expect(normalizedJson.filter((check) => !check.passed)).toEqual([]);
    expect(greenSolution("recursive")).not.toBe(greenSolution("normalized"));
  }, 20_000);

  it("rejects candidate-forged verifier receipts", async () => {
    const forgedReceipts = Array.from({ length: 12 }, (_, index) => ({
      id: `forged-${index}`,
      passed: true,
      detail: "candidate-controlled",
    }));
    const checks = await gradeFixture(
      `process.stdout.write(${JSON.stringify(JSON.stringify(forgedReceipts))}); process.exit(0);`,
    );
    expect(
      checks
        .filter((check) => check.name.includes("workspace:bundle-"))
        .every((check) => !check.passed),
    ).toBe(true);
  });

  it.each([
    [
      "integrity omits executions",
      "const payload=value;",
      "const payload={...value,executions:[]};",
      "workspace:bundle-tamper-detection",
    ],
    [
      "missing files are accepted",
      "if(missing.length)return finish('missing-inputs',bundle,missing);",
      "",
      "workspace:bundle-missing-inputs",
    ],
    [
      "partial executions look verified",
      "const status=bundle.executions.some(x=>x.state!=='completed')?'partial':'verified';",
      "const status='verified';",
      "workspace:bundle-partial-execution",
    ],
    [
      "status becomes editable",
      "return {label,tone,readOnly:true,node};",
      "return {label,tone,readOnly:false,node};",
      "workspace:bundle-ui-status",
    ],
    [
      "status remains detached from its notebook host",
      "host.appendChild(node);",
      "",
      "workspace:bundle-ui-status",
    ],
  ])(
    "rejects the %s mutant",
    async (_name, needle, replacement, rejectedCheck) => {
      const mutant = greenSolution("recursive").replace(needle, replacement);
      expect(mutant).not.toBe(greenSolution("recursive"));
      const checks = await gradeFixture(mutant);
      expect(checks.find((check) => check.name === rejectedCheck)?.passed).toBe(
        false,
      );
    },
    20_000,
  );
});

async function disposableDirectory(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "relayer-jupyter-case-"));
  temporaryDirectories.push(path);
  return path;
}

async function gradeFixture(moduleSource: string) {
  const workspaceDirectory = await disposableDirectory();
  await mkdir(join(workspaceDirectory, "packages/notebook/lib"), {
    recursive: true,
  });
  await mkdir(join(workspaceDirectory, "packages/notebook/test"), {
    recursive: true,
  });
  await writeFile(
    join(workspaceDirectory, "packages/notebook/lib/executionbundle.js"),
    moduleSource,
  );
  await writeFile(
    join(workspaceDirectory, "package.json"),
    JSON.stringify({ type: "module" }),
  );
  await mkdir(join(workspaceDirectory, "node_modules/jsdom"), {
    recursive: true,
  });
  await writeFile(
    join(workspaceDirectory, "node_modules/jsdom/package.json"),
    JSON.stringify({ name: "jsdom", main: "index.js" }),
  );
  await writeFile(
    join(workspaceDirectory, "node_modules/jsdom/index.js"),
    `class Element { constructor(){this.textContent='';this.dataset={};this.attrs=new Map();this.children=[]} setAttribute(key,value){this.attrs.set(key,value)} getAttribute(key){return this.attrs.get(key)??null} appendChild(node){this.children.push(node);return node} contains(node){return this.children.includes(node)} }
class JSDOM { constructor(){const body=new Element();this.window={Node:Element,document:{body,createElement:()=>new Element()}}} }
module.exports={JSDOM};\n`,
  );
  const runCommand: CommandRunner = async (command, args, options) => {
    if (command === "node" && args[0]?.endsWith("yarn.js"))
      return { exitCode: 0, stdout: "built", stderr: "" };
    if (command === "git" && args[0] === "status")
      return { exitCode: 0, stdout: "", stderr: "" };
    if (command === "git" && args[0] === "rev-list")
      return { exitCode: 0, stdout: "candidate-commit\n", stderr: "" };
    if (command === "git" && args[0] === "merge-base")
      return { exitCode: 0, stdout: "", stderr: "" };
    try {
      const { stdout, stderr } = await execFileAsync(command, [...args], {
        cwd: options.cwd,
        encoding: "utf8",
      });
      return { exitCode: 0, stdout, stderr };
    } catch (error) {
      const failure = error as Error & {
        code?: number;
        stdout?: string;
        stderr?: string;
      };
      return {
        exitCode: typeof failure.code === "number" ? failure.code : 1,
        stdout: failure.stdout ?? "",
        stderr: failure.stderr ?? failure.message,
      };
    }
  };
  return gradeJupyterLabExecutionBundlesWorkspace({
    workspaceDirectory,
    runCommand,
    testOnlyUseCandidateWorkspace: true,
  });
}

function greenSolution(canonicalizer: "recursive" | "normalized"): string {
  const canonical =
    canonicalizer === "recursive"
      ? "const canonical=value=>Array.isArray(value)?'['+value.map(canonical).join(',')+']':value&&typeof value==='object'?'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}':JSON.stringify(value);"
      : "const normalize=value=>Array.isArray(value)?value.map(normalize):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,normalize(value[key])])):value;const canonical=value=>JSON.stringify(normalize(value));";
  return `const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',typeof value==='string'?new TextEncoder().encode(value):value)),x=>x.toString(16).padStart(2,'0')).join('');
${canonical}
const frozen=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))frozen(child)}return value};
const cloned=value=>structuredClone(value);
const encode=bytes=>{let value='';for(const byte of bytes)value+=String.fromCharCode(byte);return btoa(value)};
const fileRecord=async file=>({path:file.path,content:encode(file.bytes),hash:await digest(file.bytes)});
const executionRecord=({cellId,source,executionCount,state,outputs})=>cloned({cellId,source,executionCount,state,outputs});
const payloadHash=async value=>{const payload=value;return digest(canonical(payload))};
export async function exportExecutionBundle(input){const bundle={schemaVersion:1,environment:cloned(input.environment),executions:input.executions.map(executionRecord),referencedFiles:await Promise.all(input.referencedFiles.map(fileRecord))};return {...bundle,integrity:{algorithm:'SHA-256',hash:await payloadHash(bundle)}}}
const finish=(status,bundle,missingInputs=[])=>({status,readOnly:true,bundle:frozen(cloned(bundle)),missingInputs});
const currentFiles=async files=>new Map(await Promise.all(files.map(async file=>[file.path,await digest(file.bytes)])));
export async function importExecutionBundle(serialized,availableFiles){let bundle;try{bundle=JSON.parse(serialized)}catch{return finish('tampered',{})}if(!bundle||typeof bundle!=='object'||Array.isArray(bundle)||!bundle.integrity||bundle.integrity.hash!==await payloadHash({schemaVersion:bundle.schemaVersion,environment:bundle.environment,executions:bundle.executions,referencedFiles:bundle.referencedFiles}))return finish('tampered',bundle??{});const actual=await currentFiles(availableFiles);const missing=bundle.referencedFiles.filter(file=>actual.get(file.path)!==file.hash).map(file=>file.path);if(missing.length)return finish('missing-inputs',bundle,missing);const status=bundle.executions.some(x=>x.state!=='completed')?'partial':'verified';return finish(status,bundle)}
export async function compareExecutionBundle(bundle,rerun,availableFiles){const imported=await importExecutionBundle(JSON.stringify(bundle),availableFiles);if(imported.status==='tampered'||imported.status==='missing-inputs')return {status:imported.status,differences:imported.missingInputs??[]};const differences=[];if(canonical(bundle.environment)!==canonical(rerun.environment))differences.push('environment');if(canonical(bundle.executions)!==canonical(rerun.executions.map(executionRecord)))differences.push('executions');return {status:differences.length?'rerun-different':'rerun-match',differences}}
export function executionBundleStatus(status,host){const labels={verified:'Verified',partial:'Partial execution','missing-inputs':'Missing inputs',tampered:'Tampered','rerun-match':'Rerun matches','rerun-different':'Rerun differs'};const tones={verified:'positive',partial:'warning','missing-inputs':'negative',tampered:'negative','rerun-match':'positive','rerun-different':'warning'};const label=labels[status],tone=tones[status]??'neutral';const node=document.createElement('span');node.textContent=label;node.dataset.tone=tone;node.setAttribute('aria-readonly','true');host.appendChild(node);return {label,tone,readOnly:true,node};}
`;
}
