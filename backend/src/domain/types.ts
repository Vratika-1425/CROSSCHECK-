export type ProjectType =
  | "Water"
  | "Electrical"
  | "Telecom"
  | "Metro"
  | "Roadworks"
  | "Drainage";

/**
 * A single public-works project record.
 *
 * `x` / `y` are the planar canvas coordinates used by the original CrossCheck
 * client. They are preserved verbatim so that server-side detection produces
 * byte-identical results to the browser implementation, and are projected to
 * WGS84 by `toLatLng` for map rendering.
 */
export interface Project {
  id: string;
  name: string;
  type: ProjectType;
  agency: string;
  location: string;
  road: string;
  /** ISO date, YYYY-MM-DD */
  start: string;
  /** ISO date, YYYY-MM-DD */
  end: string;
  x: number;
  y: number;
  /** Traffic impact score, 0-100 */
  impact: number;
  disruption: string;
  color: string;
}

export interface Collision {
  id: string;
  projects: Project[];
  road: string;
  /** Start of the overlap window: max(start_a, start_b) */
  start: string;
  /** End of the overlap window: min(end_a, end_b) */
  end: string;
  /** Proximity label, e.g. "72m" */
  spatial: string;
  /** Overlap duration label, e.g. "75 days" */
  schedule: string;
}

/** Enriched collision, computed server-side only. */
export interface CollisionBrief extends Collision {
  agencies: string[];
  risk: "HIGH" | "MEDIUM";
  overlapDays: number;
  proximityMeters: number;
  recommendation: string;
}

export interface Dataset {
  datasetId: string;
  label: string;
  projectCount: number;
  createdAt: string;
  source: "seed" | "upload";
}
