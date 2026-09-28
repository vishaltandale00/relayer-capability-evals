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
const streets = new Map(scenario.streets.map((street) => [street.id, street]));
const priorityIndex = new Map([["critical", 0], ["high", 1], ["standard", 2]]);

function paths(start, end) {
  const found = [];
  const visit = (node, seen, edgeIds, minutes) => {
    if (node === end) { found.push({ edgeIds, minutes }); return; }
    for (const street of scenario.streets) {
      if (closed.has(street.id)) continue;
      const next = street.a === node ? street.b : street.b === node ? street.a : null;
      if (next === null || seen.has(next)) continue;
      visit(next, new Set([...seen, next]), [...edgeIds, street.id], minutes + street.minutes);
    }
  };
  visit(start, new Set([start]), [], 0);
  return found.sort((left, right) => left.minutes - right.minutes || left.edgeIds.join("|").localeCompare(right.edgeIds.join("|")));
}

function tripOptions(pickup) {
  const options = [];
  for (const vehicle of scenario.vehicles) {
    if (pickup.people > vehicle.capacity || pickup.wheelchairUsers > vehicle.wheelchairCapacity) continue;
    for (const shelter of scenario.shelters) {
      if (pickup.people > shelter.capacity || pickup.wheelchairUsers > shelter.wheelchairCapacity) continue;
      const combinations = [];
      for (const first of paths(vehicle.startNodeId, pickup.nodeId).slice(0, 4)) {
        for (const second of paths(pickup.nodeId, shelter.nodeId).slice(0, 4)) {
          const pickupAt = Math.max(vehicle.availableAt + first.minutes, pickup.readyAt);
          const arriveAt = pickupAt + scenario.boardingMinutes + second.minutes;
          if (arriveAt <= pickup.deadline) combinations.push({ pickup, vehicle, shelter, first, second, arriveAt });
        }
      }
      combinations.sort((left, right) => left.arriveAt - right.arriveAt || JSON.stringify(left).localeCompare(JSON.stringify(right)));
      options.push(...combinations.slice(0, 3));
    }
  }
  return options;
}

function schedule(selection) {
  const selected = new Map(selection.map((option) => [option.pickup.id, option]));
  if (selection.some((option) => option.pickup.dependsOn.some((id) => !selected.has(id)))) return null;
  const shelterLoads = new Map();
  for (const option of selection) {
    const load = shelterLoads.get(option.shelter.id) ?? { people: 0, wheelchair: 0 };
    load.people += option.pickup.people; load.wheelchair += option.pickup.wheelchairUsers;
    if (load.people > option.shelter.capacity || load.wheelchair > option.shelter.wheelchairCapacity) return null;
    shelterLoads.set(option.shelter.id, load);
  }
  const times = new Map();
  for (let pass = 0; pass <= selection.length; pass += 1) {
    let changed = false;
    for (const option of selection) {
      const dependencyArrivals = option.pickup.dependsOn.map((id) => times.get(id)?.arriveAt);
      if (dependencyArrivals.some((value) => value === undefined)) continue;
      const pickupAt = Math.max(option.vehicle.availableAt + option.first.minutes, option.pickup.readyAt, ...dependencyArrivals);
      const startAt = pickupAt - option.first.minutes;
      const arriveAt = pickupAt + scenario.boardingMinutes + option.second.minutes;
      if (arriveAt > option.pickup.deadline) return null;
      const prior = times.get(option.pickup.id);
      if (!prior || prior.startAt !== startAt || prior.arriveAt !== arriveAt) { times.set(option.pickup.id, { startAt, pickupAt, arriveAt }); changed = true; }
    }
    if (!changed) break;
  }
  if (times.size !== selection.length) return null;
  return selection.map((option) => ({
    pickupId: option.pickup.id,
    vehicleId: option.vehicle.id,
    shelterId: option.shelter.id,
    ...times.get(option.pickup.id),
    toPickupStreetIds: option.first.edgeIds,
    toShelterStreetIds: option.second.edgeIds,
  })).sort((left, right) => left.pickupId.localeCompare(right.pickupId));
}

const pickups = [...scenario.pickups].sort((left, right) => priorityIndex.get(left.priority) - priorityIndex.get(right.priority) || left.id.localeCompare(right.id));
const options = new Map(pickups.map((pickup) => [pickup.id, tripOptions(pickup)]));
const candidates = [];
function enumerate(index, selection, usedVehicles) {
  if (index === pickups.length) {
    const assignments = schedule(selection);
    if (!assignments) return;
    const assigned = new Set(assignments.map(({ pickupId }) => pickupId));
    const counts = ["critical", "high", "standard"].map((priority) => scenario.pickups.filter((pickup) => pickup.priority === priority && assigned.has(pickup.id)).length);
    const signature = JSON.stringify(assignments);
    candidates.push({ assignments, counts, signature });
    return;
  }
  const pickup = pickups[index];
  for (const option of options.get(pickup.id)) {
    if (usedVehicles.has(option.vehicle.id)) continue;
    enumerate(index + 1, [...selection, option], new Set([...usedVehicles, option.vehicle.id]));
  }
  enumerate(index + 1, selection, usedVehicles);
}
enumerate(0, [], new Set());
candidates.sort((left, right) => {
  for (let index = 0; index < 3; index += 1) if (left.counts[index] !== right.counts[index]) return right.counts[index] - left.counts[index];
  return left.signature.localeCompare(right.signature);
});
const best = candidates[0]?.counts ?? [0, 0, 0];
const chosen = candidates.filter(({ counts }) => counts.every((count, index) => count === best[index])).filter((candidate, index, values) => values.findIndex(({ signature }) => signature === candidate.signature) === index).slice(0, scenario.requiredAlternatives);
const allPickupIds = scenario.pickups.map(({ id }) => id);
const output = {
  scenarioId: scenario.id,
  plans: chosen.map((candidate, index) => ({
    id: `exhaustive-${index + 1}`,
    assignments: candidate.assignments,
    unassignedPickupIds: allPickupIds.filter((id) => !candidate.assignments.some(({ pickupId }) => pickupId === id)).sort(),
  })),
};
process.stdout.write(`${JSON.stringify(output)}\n`);
