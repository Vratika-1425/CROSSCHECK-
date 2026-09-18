import type { Collision, CollisionBrief, Project } from "./types.js";

/**
 * CrossCheck collision engine.
 *
 * A "collision" is two projects that overlap in SPACE **and** in TIME.
 * Both conditions must hold — neither alone is a collision. Two crews on the
 * same road six months apart is sequencing; two crews on the same road in the
 * same week is a re-dig.
 *
 * This is a direct port of the original client-side implementation. The
 * thresholds and label formulas are preserved exactly so results are identical
 * whether computed in the browser or in Lambda.
 */

/** Planar proximity threshold, in canvas units. */
export const SPATIAL_THRESHOLD = 38;

/** Metres of road corridor considered "affected" around a route point. */
export const ROUTE_BUFFER_METERS = 550;

const MS_PER_DAY = 86_400_000;

/** Two date ranges intersect if each starts before the other ends. */
export function dateOverlap(a: Project, b: Project): boolean {
  return new Date(a.start) <= new Date(b.end) && new Date(b.start) <= new Date(a.end);
}

/** Euclidean distance between two projects in canvas units. */
export function distanceBetween(a: Project, b: Project): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Projects are spatially in conflict when they fall inside the threshold. */
export function spatialOverlap(a: Project, b: Project): boolean {
  return distanceBetween(a, b) < SPATIAL_THRESHOLD;
}

/**
 * Pairwise upper-triangular scan over the dataset: every project is compared
 * against every project after it, so each pair is evaluated exactly once.
 * O(n²) on project count, which is trivial at city-ward scale.
 */
export function detectCollisions(source: Project[]): Collision[] {
  return source.flatMap((project, index) =>
    source.slice(index + 1).flatMap((other) => {
      if (!spatialOverlap(project, other) || !dateOverlap(project, other)) return [];

      // The collision window is the intersection of the two schedules.
      const start = new Date(project.start) > new Date(other.start) ? project.start : other.start;
      const end = new Date(project.end) < new Date(other.end) ? project.end : other.end;
      const distance = distanceBetween(project, other);

      return [
        {
          id: `${project.id}-${other.id}`,
          projects: [project, other],
          road: project.road === other.road ? project.road : `${project.road} / ${other.road}`,
          start,
          end,
          spatial: `${Math.round(100 - distance * 1.2)}m`,
          schedule: `${Math.max(
            1,
            Math.round((new Date(end).getTime() - new Date(start).getTime()) / MS_PER_DAY),
          )} days`,
        },
      ];
    }),
  );
}

/** Days in the overlap window. */
export function overlapDays(collision: Collision): number {
  return Math.max(
    1,
    Math.round(
      (new Date(collision.end).getTime() - new Date(collision.start).getTime()) / MS_PER_DAY,
    ),
  );
}

/**
 * Adds the fields the coordination brief needs. Risk mirrors the client rule:
 * an overlap longer than 60 days is HIGH.
 */
export function toBrief(collision: Collision): CollisionBrief {
  const days = overlapDays(collision);
  const agencies = Array.from(new Set(collision.projects.map((p) => p.agency)));

  return {
    ...collision,
    agencies,
    overlapDays: days,
    proximityMeters: Number.parseInt(collision.spatial, 10),
    risk: days > 60 ? "HIGH" : "MEDIUM",
    recommendation:
      "Sequence utility works before resurfacing, align lane closures, and publish one shared public notice.",
  };
}

/** Renders the downloadable plain-text brief. */
export function renderBriefText(brief: CollisionBrief): string {
  return [
    "CROSSCHECK COLLISION BRIEF",
    `Collision ID: ${brief.id}`,
    `Location: ${brief.road}`,
    `Projects: ${brief.projects.map((p) => p.name).join("; ")}`,
    `Agencies: ${brief.agencies.join("; ")}`,
    `Spatial overlap: ${brief.spatial}`,
    `Schedule overlap: ${brief.schedule}`,
    `Intervention window: ${brief.start} → ${brief.end}`,
    `Risk: ${brief.risk}`,
    `Recommended coordination: ${brief.recommendation}`,
  ].join("\n");
}

/** Renders an RTI / coordination-records request draft. */
export function renderRtiText(brief: CollisionBrief): string {
  return [
    `To: ${brief.agencies.join(" and ")}`,
    `Subject: Request for coordination records — ${brief.road}`,
    "",
    `Please clarify how ${brief.projects.map((p) => p.name).join(" and ")} were scheduled `,
    `concurrently between ${brief.start} and ${brief.end}. CrossCheck detected `,
    `${brief.spatial} spatial proximity and ${brief.schedule} schedule overlap. `,
    "Please provide the coordination record, traffic management plan, and intervention window.",
  ].join("");
}

/** Projects canvas coordinates to WGS84, anchored on Bengaluru. */
export function toLatLng(project: Project): [number, number] {
  return [12.9716 + (240 - project.y) / 2500, 77.5946 + (project.x - 500) / 2500];
}

/**
 * Returns the projects whose footprint falls within ROUTE_BUFFER_METERS of any
 * point on a route geometry (GeoJSON [lon, lat] order).
 */
export function routeDisruptions(
  geometry: [number, number][],
  source: Project[],
): Project[] {
  return source.filter((project) => {
    const [lat, lon] = toLatLng(project);
    return geometry.some(
      ([routeLon, routeLat]) =>
        Math.hypot((routeLat - lat) * 85000, (routeLon - lon) * 100000) < ROUTE_BUFFER_METERS,
    );
  });
}

/** Aggregate statistics used by the impact and intelligence panels. */
export function summarize(projects: Project[], collisions: Collision[]) {
  const overlapMeters = collisions.reduce((t, c) => t + Number.parseInt(c.spatial, 10), 0);
  const overlapDaysTotal = collisions.reduce((t, c) => t + Number.parseInt(c.schedule, 10), 0);

  return {
    projectCount: projects.length,
    collisionCount: collisions.length,
    agencyCount: new Set(projects.map((p) => p.agency)).size,
    agencies: Array.from(new Set(projects.map((p) => p.agency))),
    overlapMeters,
    overlapDays: overlapDaysTotal,
    // ₹1.25 Cr per km of resurfacing plus a flat coordination cost per collision.
    avoidableCrore: Number(((overlapMeters / 1000) * 1.25 + collisions.length * 0.4).toFixed(2)),
  };
}
