import type { Project } from "../domain/types.js";

/**
 * Canonical CrossCheck demo dataset: 12 synthetic Bengaluru public-works
 * records across 6 agencies. These are the records shipped with the live demo
 * and are loaded into DynamoDB by the seed handler on first deploy.
 */
export const SEED_PROJECTS: Project[] = [
  { id: "BW-104", name: "Richmond Road Water Main Renewal", type: "Water", agency: "BWSSB", location: "Richmond Road", road: "Richmond Road", start: "2024-06-12", end: "2024-12-08", x: 405, y: 237, impact: 72, disruption: "Water pipeline work + lane closure", color: "#78a6a3" },
  { id: "BBMP-221", name: "Richmond Road Resurfacing", type: "Roadworks", agency: "BBMP", location: "Richmond Road", road: "Richmond Road", start: "2024-08-01", end: "2024-10-15", x: 428, y: 235, impact: 84, disruption: "Road construction + lane closure", color: "#d47f58" },
  { id: "BESCOM-071", name: "Central Grid Reliability Upgrade", type: "Electrical", agency: "BESCOM", location: "Magrath Road", road: "Magrath Road", start: "2024-09-04", end: "2025-01-18", x: 515, y: 198, impact: 48, disruption: "Electrical work", color: "#dfc26a" },
  { id: "BLR-039", name: "Purple Line East Extension", type: "Metro", agency: "BMRCL", location: "MG Road / Ulsoor", road: "MG Road", start: "2024-07-18", end: "2025-04-22", x: 650, y: 288, impact: 91, disruption: "Metro construction + multiple lane closures", color: "#c5a2c9" },
  { id: "BBMP-198", name: "Indiranagar Storm Drain Renewal", type: "Drainage", agency: "BBMP", location: "12th Main, Indiranagar", road: "12th Main", start: "2024-10-01", end: "2024-12-20", x: 760, y: 180, impact: 56, disruption: "Drainage work", color: "#93a46e" },
  { id: "ACT-140", name: "Fiber Backbone Phase 4", type: "Telecom", agency: "ACT Fibernet", location: "100 Feet Road", road: "100 Feet Road", start: "2024-08-20", end: "2024-11-05", x: 650, y: 292, impact: 43, disruption: "Telecom work", color: "#9d9bb8" },
  { id: "BW-122", name: "Koramangala Trunk Sewer", type: "Drainage", agency: "BWSSB", location: "80 Feet Road", road: "80 Feet Road", start: "2024-11-14", end: "2025-03-15", x: 845, y: 335, impact: 64, disruption: "Drainage work + lane closure", color: "#93a46e" },
  { id: "BESCOM-090", name: "Koramangala Feeder Diversion", type: "Electrical", agency: "BESCOM", location: "80 Feet Road", road: "80 Feet Road", start: "2024-12-02", end: "2025-01-22", x: 845, y: 340, impact: 59, disruption: "Electrical work", color: "#dfc26a" },
  { id: "BBMP-241", name: "Cubbon Park Edge Mobility Works", type: "Roadworks", agency: "BBMP", location: "Kasturba Road", road: "Kasturba Road", start: "2024-06-27", end: "2024-09-29", x: 242, y: 220, impact: 38, disruption: "Road construction", color: "#d47f58" },
  { id: "BLR-044", name: "Airport Link Utility Shift", type: "Metro", agency: "BMRCL", location: "Hebbal Flyover", road: "Bellary Road", start: "2025-01-10", end: "2025-06-11", x: 350, y: 410, impact: 76, disruption: "Metro construction", color: "#c5a2c9" },
  { id: "JIO-062", name: "North Corridor Fiber Route", type: "Telecom", agency: "Jio Digital Life", location: "Bellary Road", road: "Bellary Road", start: "2025-02-05", end: "2025-04-16", x: 350, y: 414, impact: 41, disruption: "Telecom work", color: "#9d9bb8" },
  { id: "BW-133", name: "Ulsoor Lake Outfall Works", type: "Water", agency: "BWSSB", location: "Ulsoor", road: "Halasuru Road", start: "2024-08-14", end: "2024-11-28", x: 604, y: 72, impact: 33, disruption: "Water pipeline work", color: "#78a6a3" },
];

export const DEFAULT_DATASET_ID = "bengaluru-demo";
