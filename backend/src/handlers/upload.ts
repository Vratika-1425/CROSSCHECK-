import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { randomUUID } from "node:crypto";
import { detectCollisions, summarize, toBrief } from "../domain/collision.js";
import { fail, normalizeProjects, ok, parseDataset } from "../lib/http.js";
import { putProjects } from "../lib/repository.js";

const s3 = new S3Client({});
const UPLOAD_BUCKET = process.env.UPLOAD_BUCKET!;

/**
 * POST /datasets
 * Body: { filename?: string, content: string }  (CSV or JSON)
 *
 * Archives the raw upload to S3 for auditability, normalises the rows, writes
 * them to DynamoDB under a fresh datasetId, and returns the recomputed
 * collisions so the client can re-render in a single round trip.
 */
export async function handler(event: APIGatewayProxyEventV2) {
  try {
    if (!event.body) return fail(400, "Request body is required");

    const payload = JSON.parse(
      event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body,
    ) as { filename?: string; content?: string };

    if (!payload.content) return fail(400, "content is required");

    const datasetId = `upload-${randomUUID().slice(0, 8)}`;
    const filename = payload.filename ?? "dataset.csv";

    // Keep the raw file exactly as submitted — the normalised rows are a
    // lossy view, and provenance matters for a civic dataset.
    await s3.send(
      new PutObjectCommand({
        Bucket: UPLOAD_BUCKET,
        Key: `raw/${datasetId}/${filename}`,
        Body: payload.content,
        ContentType: filename.endsWith(".json") ? "application/json" : "text/csv",
      }),
    );

    let projects;
    try {
      projects = normalizeProjects(parseDataset(payload.content, filename));
    } catch {
      return fail(
        422,
        "Upload failed validation. Use JSON or CSV with name, agency, type, start, end and location fields.",
      );
    }

    if (!projects.length) {
      return fail(422, "No valid project records found in the upload.");
    }

    await putProjects(datasetId, projects);
    const collisions = detectCollisions(projects);

    return ok({
      datasetId,
      accepted: projects.length,
      projects,
      collisions: collisions.map(toBrief),
      summary: summarize(projects, collisions),
    });
  } catch (error) {
    console.error("upload failed", error);
    return fail(500, "Could not process dataset upload");
  }
}
