#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { CrossCheckStack } from "../lib/crosscheck-stack";

const app = new cdk.App();

/**
 * Region is EXPLICIT and pinned to ap-south-1.
 * It deliberately does NOT read CDK_DEFAULT_REGION, because that is populated
 * from the local AWS profile and would silently move the stack.
 * Override intentionally with CROSSCHECK_REGION.
 */
const region = process.env.CROSSCHECK_REGION ?? "ap-south-1";
const account = process.env.CDK_DEFAULT_ACCOUNT;

const cloudfrontContext = app.node.tryGetContext("cloudfront");
const cloudfrontEnabled =
  cloudfrontContext !== false &&
  cloudfrontContext !== "false" &&
  cloudfrontContext !== "0" &&
  cloudfrontContext !== "off" &&
  cloudfrontContext !== "no";

console.error(
  `[CrossCheck] region=${region} account=${account ?? "(from credentials)"} cloudfront=${
    cloudfrontEnabled ? "enabled" : "DISABLED"
  }`,
);

new CrossCheckStack(app, "CrossCheckStack", {
  env: { account, region },
  bedrockModelId: process.env.BEDROCK_MODEL_ID,
  description: "CrossCheck — infrastructure collision detection for cities",
});

app.synth();
