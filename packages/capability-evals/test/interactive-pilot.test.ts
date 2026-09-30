import { createHash } from "node:crypto";
import { afterEach, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveCapabilitySuite, validateEvalCatalogV1 } from "@relayer/eval-runner";
import { interactiveEverydayCases, interactiveEverydayRegistrations, interactiveHumanExplorationManifest } from "../src/interactive-pilot.js";
import { tournamentOperationsCase } from "../src/project-cases/tournament-operations-case.js";
import { nodeRedisCommandQueueRaceCase } from "../src/project-cases/node-redis.js";
// @ts-expect-error Native inference-free fixture intentionally ships as executable JS.
import { startRestaurantServer } from "../fixtures/restaurant-server.mjs";
const directories: string[] = [];
afterEach(async()=>{for(const p of directories.splice(0)) await rm(p,{recursive:true,force:true});});
it("packages ten exploratory members without changing the coding contracts or exposing participant facts", async()=>{
  const cases = [tournamentOperationsCase,nodeRedisCommandQueueRaceCase,...interactiveEverydayCases.map(c=>c.boundCase)];
  const suite = resolveCapabilitySuite(interactiveHumanExplorationManifest,cases);
  expect(suite.members).toHaveLength(10);
  expect(suite.members.slice(0,2).map(m=>m.expectedCaseSnapshotDigest)).toEqual([tournamentOperationsCase.snapshotDigest,nodeRedisCommandQueueRaceCase.snapshotDigest]);
  expect(suite.identity.status).toBe("candidate");
  const { createEvalCatalog } = await import("../interactive-catalog.mjs");
  const catalog = validateEvalCatalogV1(await createEvalCatalog());
  expect(catalog.cases).toHaveLength(18);
  expect(catalog.suites).toHaveLength(2);
  const publicText = JSON.stringify(catalog.cases.map(c=>c.definition));
  for(const c of interactiveEverydayCases) {
    expect(publicText).not.toContain(c.boundCase.snapshot.interactive!.participantBrief);
    for (const artifact of [c.boundCase.snapshot.artifacts.reference, c.boundCase.snapshot.artifacts.verifier]) {
      const bytes = await readFile(join(import.meta.dirname, "../../..", artifact.sealedPath));
      expect(`sha256:${createHash("sha256").update(bytes).digest("hex")}`).toBe(artifact.contentDigest);
    }
    for (const criterion of c.boundCase.snapshot.interactive!.reviewerRubric.criteria) expect(publicText).not.toContain(criterion);
  }
  expect(publicText).not.toContain('participantBrief');
  expect(publicText).not.toContain('reviewerRubric');
  const path=await mkdtemp(join(tmpdir(),'interactive-pilot-'));directories.push(path);
  const registration=interactiveEverydayRegistrations[0]!;
  const fixture=await registration.materialize({caseId:registration.definition.id,workspaceDirectory:path,cacheDirectory:path,platform:process.platform});
  const context={caseId:registration.definition.id,workspaceDirectory:path,fixture,threadDefinition:registration.definition.threads[0]};
  expect((await registration.grade(context))[0]?.passed).toBe(false);
  await writeFile(join(path,'deliverable.md'),'A concrete draft for human review.');
  expect((await registration.grade(context))[0]?.passed).toBe(true);
  expect(await readFile(join(path,'README.md'),'utf8')).not.toContain(registration.boundCase.snapshot.interactive!.participantBrief);
});
it("reservation fixture persists booking, rejects overbooking, modifies, cancels and reopens inspectable records", async()=>{
  const path=await mkdtemp(join(tmpdir(),'interactive-restaurant-'));directories.push(path);
  const statePath=join(path,'state.json');
  let server=await startRestaurantServer({statePath});
  const request=async(method:string,path:string,body?:unknown)=>fetch(server.origin+path,{method,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  try {
    expect(await (await request('GET','/')).text()).toContain('Check availability');
    const data={restaurantId:'garden',partySize:6,date:'2026-11-12',time:'19:00',name:'Alex'};
    const booked=await (await request('POST','/api/bookings',data)).json();
    expect(booked.status).toBe('confirmed');
    expect((await request('POST','/api/bookings',data)).status).toBe(409);
    const available=await (await request('GET','/api/availability?restaurantId=garden&date=2026-11-12&time=19:00')).json();expect(available.available).toBe(2);
    expect((await request('PATCH','/api/bookings/'+booked.id,{...data,time:'20:30'})).status).toBe(200);
    await server.close();server=await startRestaurantServer({statePath});
    const persisted=await (await request('GET','/api/bookings')).json();expect(persisted.bookings[0].time).toBe('20:30');
    expect((await request('DELETE','/api/bookings/'+booked.id)).status).toBe(200);
    const final=await (await request('GET','/api/bookings')).json();expect(final.events.map((e:{kind:string})=>e.kind)).toEqual(['booked','modified','cancelled']);expect(final.bookings[0].status).toBe('cancelled');
  } finally {await server.close();}
});
