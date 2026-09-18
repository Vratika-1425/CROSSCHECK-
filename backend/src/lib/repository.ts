import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import type { Project } from "../domain/types.js";

/**
 * Single-table design.
 *
 *   PK = DATASET#<datasetId>   SK = PROJECT#<projectId>
 *
 * Every project in a dataset shares a partition, so the whole dataset is a
 * single Query — no scans, and one round trip per collision run.
 */
const TABLE_NAME = process.env.PROJECTS_TABLE ?? "crosscheck-projects";

// Instantiated at module scope so the connection is reused across warm
// invocations rather than rebuilt on every request.
const client = new DynamoDBClient({});

export const documents = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const partitionKey = (datasetId: string) => `DATASET#${datasetId}`;
const sortKey = (projectId: string) => `PROJECT#${projectId}`;

/** Reads every project in a dataset, following pagination to the end. */
export async function listProjects(datasetId: string): Promise<Project[]> {
  const projects: Project[] = [];
  let cursor: Record<string, unknown> | undefined;

  do {
    const page = await documents.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues: { ":pk": partitionKey(datasetId), ":sk": "PROJECT#" },
        ExclusiveStartKey: cursor,
      }),
    );

    for (const item of page.Items ?? []) {
      const { pk: _pk, sk: _sk, ...project } = item as Record<string, unknown>;
      projects.push(project as unknown as Project);
    }
    cursor = page.LastEvaluatedKey;
  } while (cursor);

  return projects;
}

/** Writes projects in batches of 25, the DynamoDB BatchWrite limit. */
export async function putProjects(datasetId: string, projects: Project[]): Promise<number> {
  for (let offset = 0; offset < projects.length; offset += 25) {
    const chunk = projects.slice(offset, offset + 25);

    await documents.send(
      new BatchWriteCommand({
        RequestItems: {
          [TABLE_NAME]: chunk.map((project) => ({
            PutRequest: {
              Item: {
                pk: partitionKey(datasetId),
                sk: sortKey(project.id),
                datasetId,
                updatedAt: new Date().toISOString(),
                ...project,
              },
            },
          })),
        },
      }),
    );
  }

  return projects.length;
}
