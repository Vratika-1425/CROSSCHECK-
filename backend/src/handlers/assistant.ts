import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { detectCollisions, summarize } from "../domain/collision.js";
import type { Collision, Project } from "../domain/types.js";
import { fail, ok } from "../lib/http.js";
import { listProjects } from "../lib/repository.js";
import { DEFAULT_DATASET_ID } from "../seed/projects.js";

const bedrock = new BedrockRuntimeClient({});
const MODEL_ID = process.env.BEDROCK_MODEL_ID ?? "";

/**
 * POST /assistant   Body: { question: string, datasetId?: string }
 *
 * Grounded question answering over the current dataset. The dataset summary is
 * computed first and passed to the model as context, so answers are derived
 * from the records rather than from model recall.
 *
 * If no model is configured, or Bedrock errors, the deterministic rule-based
 * responder answers instead. It is always grounded in the same numbers, so the
 * feature degrades rather than breaking.
 */
export async function handler(event: APIGatewayProxyEventV2) {
  try {
    const payload = event.body ? (JSON.parse(event.body) as { question?: string; datasetId?: string }) : {};
    const question = (payload.question ?? "").trim();
    if (!question) return fail(400, "question is required");

    const projects = await listProjects(payload.datasetId || DEFAULT_DATASET_ID);
    const collisions = detectCollisions(projects);

    if (MODEL_ID) {
      try {
        return ok({ answer: await askBedrock(question, projects, collisions), source: "bedrock" });
      } catch (error) {
        console.error("Bedrock call failed, falling back to rules", error);
      }
    }

    return ok({ answer: ruleBasedAnswer(question, projects, collisions), source: "rules" });
  } catch (error) {
    console.error("assistant failed", error);
    return fail(500, "Could not answer that question");
  }
}

async function askBedrock(question: string, projects: Project[], collisions: Collision[]) {
  const stats = summarize(projects, collisions);

  const context = [
    `Dataset: ${stats.projectCount} projects, ${stats.collisionCount} detected collisions, ${stats.agencyCount} agencies (${stats.agencies.join(", ")}).`,
    "Detected collisions:",
    ...collisions.map(
      (c) =>
        `- ${c.road}: ${c.projects.map((p) => `${p.name} [${p.agency}]`).join(" vs ")}; ` +
        `proximity ${c.spatial}; overlap ${c.schedule}; window ${c.start} to ${c.end}.`,
    ),
  ].join("\n");

  const response = await bedrock.send(
    new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 400,
        system:
          "You are CrossCheck, an infrastructure coordination analyst. Answer only from the " +
          "provided dataset context. Be concise and concrete, cite roads, agencies and dates. " +
          "If the context does not contain the answer, say so. CrossCheck detects scheduling " +
          "collisions early so agencies can coordinate; it does not prevent construction.",
        messages: [{ role: "user", content: `${context}\n\nQuestion: ${question}` }],
      }),
    }),
  );

  const parsed = JSON.parse(new TextDecoder().decode(response.body)) as {
    content?: { type: string; text?: string }[];
  };

  return (parsed.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("\n")
    .trim();
}

/** Deterministic fallback, grounded in the same computed numbers. */
function ruleBasedAnswer(question: string, projects: Project[], collisions: Collision[]) {
  const prompt = question.toLowerCase();
  const agencies = Array.from(new Set(projects.map((p) => p.agency)));

  if (prompt.includes("traffic") || prompt.includes("slow")) {
    const worst = [...projects].sort((a, b) => b.impact - a.impact)[0];
    return worst
      ? `${worst.road} is affected by ${worst.disruption}. Estimated traffic impact is ${worst.impact}/100, from ${worst.agency}'s ${worst.name}.`
      : "No projects are currently loaded.";
  }
  if (prompt.includes("route") || prompt.includes("construction")) {
    return `The dataset contains ${collisions.length} computed collision windows across ${projects.length} projects. Routes are ranked by how many of those disruption zones they pass through.`;
  }
  if (prompt.includes("agency") || prompt.includes("agencies")) {
    return `${agencies.length} agencies are represented: ${agencies.join(", ")}.`;
  }
  if (prompt.includes("collision") || prompt.includes("overlap") || prompt.includes("dig")) {
    const worst = [...collisions].sort(
      (a, b) => Number.parseInt(b.schedule, 10) - Number.parseInt(a.schedule, 10),
    )[0];
    return worst
      ? `${collisions.length} collisions were detected from spatial proximity plus schedule overlap. ${worst.road} is the highest priority: ${worst.projects.map((p) => p.agency).join(" and ")} overlap for ${worst.schedule} from ${worst.start}.`
      : "No collisions are detected in the current dataset.";
  }
  return `CrossCheck analysed ${projects.length} projects and found ${collisions.length} collision windows. Ask about traffic, routes, agencies, or overlaps.`;
}
