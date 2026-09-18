import assert from "node:assert/strict";
import { test } from "node:test";
import { SEED_PROJECTS } from "../seed/projects.js";
import {
  dateOverlap,
  detectCollisions,
  spatialOverlap,
  summarize,
  toBrief,
} from "./collision.js";

const byId = (id: string) => SEED_PROJECTS.find((p) => p.id === id)!;

test("space and time are both required for a collision", () => {
  const water = byId("BW-104");        // Richmond Road, Jun-Dec 2024
  const resurface = byId("BBMP-221");  // Richmond Road, Aug-Oct 2024
  const cubbon = byId("BBMP-241");     // Kasturba Road, far away

  assert.ok(spatialOverlap(water, resurface) && dateOverlap(water, resurface));
  // Same city, overlapping dates, but too far apart to be a re-dig.
  assert.equal(spatialOverlap(water, cubbon), false);
  assert.equal(detectCollisions([water, cubbon]).length, 0);
});

test("the seeded dataset yields the four known collisions", () => {
  const collisions = detectCollisions(SEED_PROJECTS);
  assert.equal(collisions.length, 4);

  const richmond = collisions.find((c) => c.id === "BW-104-BBMP-221")!;
  assert.equal(richmond.road, "Richmond Road");
  assert.equal(richmond.spatial, "72m");
  assert.equal(richmond.schedule, "75 days");
  // Window is the intersection, not the union, of the two schedules.
  assert.equal(richmond.start, "2024-08-01");
  assert.equal(richmond.end, "2024-10-15");
});

test("each pair is reported at most once", () => {
  const ids = detectCollisions(SEED_PROJECTS).map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("overlaps longer than 60 days are flagged HIGH risk", () => {
  const collisions = detectCollisions(SEED_PROJECTS);
  assert.equal(toBrief(collisions.find((c) => c.id === "BW-104-BBMP-221")!).risk, "HIGH");
  // 80 Feet Road overlaps for 51 days.
  assert.equal(toBrief(collisions.find((c) => c.id === "BW-122-BESCOM-090")!).risk, "MEDIUM");
});

test("summary aggregates match the dataset", () => {
  const stats = summarize(SEED_PROJECTS, detectCollisions(SEED_PROJECTS));
  assert.equal(stats.projectCount, 12);
  assert.equal(stats.collisionCount, 4);
  assert.equal(stats.agencyCount, 6);
  assert.equal(stats.overlapMeters, 356);
  assert.equal(stats.overlapDays, 273);
});

test("an empty dataset produces no collisions", () => {
  assert.deepEqual(detectCollisions([]), []);
});
