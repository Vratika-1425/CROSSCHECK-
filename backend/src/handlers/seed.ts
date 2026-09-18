import { detectCollisions } from "../domain/collision.js";
import { putProjects } from "../lib/repository.js";
import { DEFAULT_DATASET_ID, SEED_PROJECTS } from "../seed/projects.js";

/**
 * Invoked once by a CDK custom resource after the table is created. Idempotent:
 * BatchWrite puts overwrite by key, so re-running restores the demo dataset to
 * its pristine state.
 */
export async function handler() {
  const written = await putProjects(DEFAULT_DATASET_ID, SEED_PROJECTS);
  const collisions = detectCollisions(SEED_PROJECTS);

  console.log(`Seeded ${written} projects, ${collisions.length} collisions detected.`);

  return {
    PhysicalResourceId: `crosscheck-seed-${DEFAULT_DATASET_ID}`,
    Data: { projects: written, collisions: collisions.length },
  };
}
