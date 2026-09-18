import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { Project, ProjectType } from "../domain/types.js";

const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "*";

const baseHeaders = {
  "content-type": "application/json",
  "access-control-allow-origin": CORS_ORIGIN,
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "GET,POST,OPTIONS",
};

export function ok(body: unknown, extraHeaders: Record<string, string> = {}) {
  return {
    statusCode: 200,
    headers: { ...baseHeaders, ...extraHeaders },
    body: JSON.stringify(body),
  } satisfies APIGatewayProxyStructuredResultV2;
}

export function text(body: string, filename?: string) {
  return {
    statusCode: 200,
    headers: {
      ...baseHeaders,
      "content-type": "text/plain; charset=utf-8",
      ...(filename ? { "content-disposition": `attachment; filename="${filename}"` } : {}),
    },
    body,
  } satisfies APIGatewayProxyStructuredResultV2;
}

export function fail(statusCode: number, message: string) {
  return {
    statusCode,
    headers: baseHeaders,
    body: JSON.stringify({ error: message }),
  } satisfies APIGatewayProxyStructuredResultV2;
}

const VALID_TYPES: ProjectType[] = [
  "Water",
  "Electrical",
  "Telecom",
  "Metro",
  "Roadworks",
  "Drainage",
];

/**
 * Accepts the same shapes the browser upload accepted: a JSON array, a
 * `{ projects: [...] }` envelope, or CSV with a header row of
 * name, agency, type, start, end, location, road.
 */
export function parseDataset(raw: string, filename = ""): Record<string, string>[] {
  const trimmed = raw.trim();
  const looksJson = filename.endsWith(".json") || trimmed.startsWith("[") || trimmed.startsWith("{");

  if (looksJson) {
    const parsed = JSON.parse(trimmed);
    const rows = Array.isArray(parsed) ? parsed : parsed.projects;
    if (!Array.isArray(rows)) throw new Error("Expected an array of projects");
    return rows;
  }

  const lines = trimmed.split(/\r?\n/);
  const header = (lines[0] ?? "").split(",").map((h) => h.trim().toLowerCase());

  return lines.slice(1).filter(Boolean).map((line) => {
    const cells = line.split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    header.forEach((key, index) => {
      row[key] = cells[index] ?? "";
    });
    return row;
  });
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Fills in the derived fields the collision engine needs and drops any record
 * missing the six fields that make a project checkable.
 */
export function normalizeProjects(rows: Record<string, string>[]): Project[] {
  return rows
    .map((row, index) => {
      const type = (row.type ?? row.category) as ProjectType;

      return {
        id: row.id ?? `UPLOAD-${index + 1}`,
        name: row.name ?? row.projectName,
        type,
        agency: row.agency,
        location: row.location ?? "Bengaluru",
        road: row.road ?? row.location ?? "Demo Road",
        start: row.start ?? row.startDate,
        end: row.end ?? row.endDate,
        x: Number(row.x ?? 300 + index * 37),
        y: Number(row.y ?? 180 + index * 23),
        impact: Number(row.impact ?? 50),
        disruption: row.disruption ?? `${type ?? "Infrastructure"} work`,
        color: row.color ?? "#d6c87c",
      } as Project;
    })
    .filter(
      (project) =>
        Boolean(project.name) &&
        Boolean(project.agency) &&
        VALID_TYPES.includes(project.type) &&
        ISO_DATE.test(project.start ?? "") &&
        ISO_DATE.test(project.end ?? "") &&
        Boolean(project.location) &&
        Number.isFinite(project.x) &&
        Number.isFinite(project.y),
    );
}
