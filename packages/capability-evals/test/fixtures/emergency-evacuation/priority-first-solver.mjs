import { readFile } from "node:fs/promises";

const scenario = JSON.parse(await readFile(process.argv[2], "utf8"));
function validateScenario(value) {
  if (!value || !Array.isArray(value.nodes) || !Array.isArray(value.streets) || !Array.isArray(value.closedStreetIds) || !Array.isArray(value.vehicles) || !Array.isArray(value.pickups) || !Array.isArray(value.shelters) || !Number.isInteger(value.requiredAlternatives) || value.requiredAlternatives <= 0) throw new Error("Invalid scenario");
  const unique = (items) => items.every((item, index) => typeof item.id === "string" && items.findIndex(({ id }) => id === item.id) === index);
  if (!unique(value.streets) || !unique(value.vehicles) || !unique(value.pickups) || !unique(value.shelters)) throw new Error("Duplicate entity ID");
  const nodeIds = new Set(value.nodes);
  const streetIds = new Set(value.streets.map(({ id }) => id));
  const pickupIds = new Set(value.pickups.map(({ id }) => id));
  if (value.streets.some(({ a, b, minutes }) => !nodeIds.has(a) || !nodeIds.has(b) || !Number.isInteger(minutes) || minutes <= 0)) throw new Error("Invalid street");
  if (value.closedStreetIds.some((id) => !streetIds.has(id))) throw new Error("Unknown closure");
  if (value.vehicles.some(({ startNodeId, capacity, wheelchairCapacity, availableAt }) => !nodeIds.has(startNodeId) || !Number.isInteger(capacity) || capacity < 0 || !Number.isInteger(wheelchairCapacity) || wheelchairCapacity < 0 || !Number.isInteger(availableAt) || availableAt < 0)) throw new Error("Invalid vehicle");
  if (value.pickups.some(({ nodeId, people, wheelchairUsers, priority, readyAt, deadline, dependsOn }) => !nodeIds.has(nodeId) || !Number.isInteger(people) || people <= 0 || !Number.isInteger(wheelchairUsers) || wheelchairUsers < 0 || wheelchairUsers > people || !["critical", "high", "standard"].includes(priority) || !Number.isInteger(readyAt) || readyAt < 0 || !Number.isInteger(deadline) || deadline < 0 || !Array.isArray(dependsOn) || dependsOn.some((id) => !pickupIds.has(id)))) throw new Error("Invalid pickup");
  if (value.shelters.some(({ nodeId, capacity, wheelchairCapacity }) => !nodeIds.has(nodeId) || !Number.isInteger(capacity) || capacity < 0 || !Number.isInteger(wheelchairCapacity) || wheelchairCapacity < 0)) throw new Error("Invalid shelter");
}
validateScenario(scenario);

const closed = new Set(scenario.closedStreetIds);
const priorities = { critical: 0, high: 1, standard: 2 };

function rankedPaths(start, goal) {
  const queue = [{ node: start, visited: [start], edges: [], minutes: 0 }];
  const results = [];
  while (queue.length) {
    queue.sort((a, b) => a.minutes - b.minutes || a.edges.join("/").localeCompare(b.edges.join("/")));
    const state = queue.shift();
    if (state.node === goal) { results.push(state); if (results.length === 4) break; continue; }
    for (const edge of scenario.streets) {
      if (closed.has(edge.id)) continue;
      const next = edge.a === state.node ? edge.b : edge.b === state.node ? edge.a : null;
      if (next === null || state.visited.includes(next)) continue;
      queue.push({ node: next, visited: [...state.visited, next], edges: [...state.edges, edge.id], minutes: state.minutes + edge.minutes });
    }
  }
  return results;
}

const pickups = [...scenario.pickups].sort((a, b) => priorities[a.priority] - priorities[b.priority] || a.id.localeCompare(b.id));
const choices = new Map();
for (const pickup of pickups) {
  const values = [];
  for (const vehicle of scenario.vehicles) {
    if (vehicle.capacity < pickup.people || vehicle.wheelchairCapacity < pickup.wheelchairUsers) continue;
    for (const shelter of scenario.shelters) {
      if (shelter.capacity < pickup.people || shelter.wheelchairCapacity < pickup.wheelchairUsers) continue;
      for (const first of rankedPaths(vehicle.startNodeId, pickup.nodeId)) {
        for (const second of rankedPaths(pickup.nodeId, shelter.nodeId)) {
          const optimisticArrival = Math.max(vehicle.availableAt + first.minutes, pickup.readyAt) + scenario.boardingMinutes + second.minutes;
          if (optimisticArrival <= pickup.deadline) values.push({ pickup, vehicle, shelter, first, second, optimisticArrival });
        }
      }
    }
  }
  values.sort((a, b) => a.optimisticArrival - b.optimisticArrival || a.vehicle.id.localeCompare(b.vehicle.id) || a.shelter.id.localeCompare(b.shelter.id) || a.first.edges.join("/").localeCompare(b.first.edges.join("/")) || a.second.edges.join("/").localeCompare(b.second.edges.join("/")));
  choices.set(pickup.id, values);
}

function finish(selection) {
  const byPickup = new Map(selection.map((choice) => [choice.pickup.id, choice]));
  if (selection.some((choice) => choice.pickup.dependsOn.some((dependency) => !byPickup.has(dependency)))) return null;
  const loads = new Map();
  for (const choice of selection) {
    const load = loads.get(choice.shelter.id) ?? { people: 0, wheelchair: 0 };
    load.people += choice.pickup.people; load.wheelchair += choice.pickup.wheelchairUsers;
    if (load.people > choice.shelter.capacity || load.wheelchair > choice.shelter.wheelchairCapacity) return null;
    loads.set(choice.shelter.id, load);
  }
  const completed = new Map();
  while (completed.size < selection.length) {
    let progressed = false;
    for (const choice of selection) {
      if (completed.has(choice.pickup.id)) continue;
      const dependencyTimes = choice.pickup.dependsOn.map((dependency) => completed.get(dependency)?.arriveAt);
      if (dependencyTimes.some((time) => time === undefined)) continue;
      const pickupAt = Math.max(choice.vehicle.availableAt + choice.first.minutes, choice.pickup.readyAt, ...dependencyTimes);
      const arriveAt = pickupAt + scenario.boardingMinutes + choice.second.minutes;
      if (arriveAt > choice.pickup.deadline) return null;
      completed.set(choice.pickup.id, { startAt: pickupAt - choice.first.minutes, pickupAt, arriveAt });
      progressed = true;
    }
    if (!progressed) return null;
  }
  return selection.map((choice) => ({ pickupId: choice.pickup.id, vehicleId: choice.vehicle.id, shelterId: choice.shelter.id, ...completed.get(choice.pickup.id), toPickupStreetIds: choice.first.edges, toShelterStreetIds: choice.second.edges })).sort((a, b) => a.pickupId.localeCompare(b.pickupId));
}

function firstPriorityPlan(bannedSignatures, targetCounts = null) {
  let result = null;
  const search = (index, selection, vehicles) => {
    if (result) return;
    if (index === pickups.length) {
      const assignments = finish(selection);
      if (!assignments) return;
      const assignedIds = new Set(assignments.map(({ pickupId }) => pickupId));
      const counts = ["critical", "high", "standard"].map((priority) => scenario.pickups.filter((pickup) => pickup.priority === priority && assignedIds.has(pickup.id)).length);
      if (targetCounts && counts.some((count, countIndex) => count !== targetCounts[countIndex])) return;
      const signature = JSON.stringify(assignments);
      if (!bannedSignatures.has(signature)) result = { assignments, signature, counts };
      return;
    }
    const pickup = pickups[index];
    for (const choice of choices.get(pickup.id)) {
      if (vehicles.has(choice.vehicle.id)) continue;
      search(index + 1, [...selection, choice], new Set([...vehicles, choice.vehicle.id]));
      if (result) return;
    }
    search(index + 1, selection, vehicles);
  };
  search(0, [], new Set());
  return result;
}

const picked = [];
const banned = new Set();
let targetCounts = null;
while (picked.length < scenario.requiredAlternatives) {
  const next = firstPriorityPlan(banned, targetCounts);
  if (!next) break;
  picked.push(next);
  banned.add(next.signature);
  targetCounts ??= next.counts;
}
const all = scenario.pickups.map(({ id }) => id);
process.stdout.write(`${JSON.stringify({
  scenarioId: scenario.id,
  plans: picked.map((candidate, index) => ({ id: `priority-first-${index + 1}`, assignments: candidate.assignments, unassignedPickupIds: all.filter((id) => !candidate.assignments.some(({ pickupId }) => pickupId === id)).sort() })),
})}\n`);
