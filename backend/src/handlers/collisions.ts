import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { detectCollisions, summarize, toBrief } from "../domain/collision.js";
import { fail, ok } from "../lib/http.js";
import { listProjects } from "../lib/repository.js";
import { DEFAULT_DATASET_ID } from "../seed/projects.js";

/**
 * GET /collisions?datasetId=
 *
 * Runs the pairwise space+time scan server-side and returns enriched briefs,
 * sorted longest-overlap first so the worst collision leads.
 */
export async function handler(event: APIGatewayProxyEventV2) {
  try {
    const datasetId = event.queryStringParameters?.datasetId || DEFAULT_DATASET_ID;
    const projects = await listProjects(datasetId);
    const collisions = detectCollisions(projects);

    return ok({
      datasetId,
      collisions: collisions.map(toBrief).sort((a, b) => b.overlapDays - a.overlapDays),
      summary: summarize(projects, collisions),
    });
  } catch (error) {
    console.error("detectCollisions failed", error);
    return fail(500, "Could not compute collisions");
  }
}
