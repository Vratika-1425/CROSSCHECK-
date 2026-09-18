import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { detectCollisions, summarize } from "../domain/collision.js";
import { fail, ok } from "../lib/http.js";
import { listProjects } from "../lib/repository.js";
import { DEFAULT_DATASET_ID } from "../seed/projects.js";

/**
 * GET /projects?datasetId=&type=&agency=&q=
 *
 * Returns the project records plus a summary block. Filtering happens here so
 * the client ships less data over the wire on large datasets.
 */
export async function handler(event: APIGatewayProxyEventV2) {
  try {
    const params = event.queryStringParameters ?? {};
    const datasetId = params.datasetId || DEFAULT_DATASET_ID;

    let projects = await listProjects(datasetId);

    if (params.type && params.type !== "ALL") {
      const types = params.type.split(",").map((t) => t.trim().toLowerCase());
      projects = projects.filter((p) => types.includes(p.type.toLowerCase()));
    }
    if (params.agency) {
      projects = projects.filter((p) => p.agency.toLowerCase() === params.agency!.toLowerCase());
    }
    if (params.q) {
      const needle = params.q.toLowerCase();
      projects = projects.filter((p) =>
        `${p.name} ${p.location} ${p.agency} ${p.road}`.toLowerCase().includes(needle),
      );
    }

    return ok({
      datasetId,
      projects,
      summary: summarize(projects, detectCollisions(projects)),
    });
  } catch (error) {
    console.error("listProjects failed", error);
    return fail(500, "Could not load projects");
  }
}
