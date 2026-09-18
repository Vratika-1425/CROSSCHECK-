import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { detectCollisions, renderBriefText, renderRtiText, toBrief } from "../domain/collision.js";
import { fail, text } from "../lib/http.js";
import { listProjects } from "../lib/repository.js";
import { DEFAULT_DATASET_ID } from "../seed/projects.js";

/**
 * GET /collisions/{collisionId}/brief?format=brief|rti
 *
 * Returns the downloadable coordination brief or the RTI/records-request
 * draft for a single detected collision.
 */
export async function handler(event: APIGatewayProxyEventV2) {
  try {
    const collisionId = event.pathParameters?.collisionId;
    if (!collisionId) return fail(400, "collisionId is required");

    const datasetId = event.queryStringParameters?.datasetId || DEFAULT_DATASET_ID;
    const format = event.queryStringParameters?.format ?? "brief";

    const collision = detectCollisions(await listProjects(datasetId)).find(
      (c) => c.id === collisionId,
    );
    if (!collision) return fail(404, `No collision found with id ${collisionId}`);

    const brief = toBrief(collision);

    return format === "rti"
      ? text(renderRtiText(brief), `${brief.id}-RTI-draft.txt`)
      : text(renderBriefText(brief), `${brief.id}-collision-brief.txt`);
  } catch (error) {
    console.error("brief failed", error);
    return fail(500, "Could not generate brief");
  }
}
