import * as cdk from "aws-cdk-lib";
import * as apigw from "aws-cdk-lib/aws-apigatewayv2";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as deployment from "aws-cdk-lib/aws-s3-deployment";
import * as logs from "aws-cdk-lib/aws-logs";
import * as customresources from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import * as path from "node:path";

export interface CrossCheckStackProps extends cdk.StackProps {
  readonly bedrockModelId?: string;
}

const REPO_ROOT = path.join(__dirname, "..", "..");
const BACKEND = path.join(REPO_ROOT, "backend");
const FRONTEND_DIST = path.join(REPO_ROOT, "frontend", "dist", "public");

export class CrossCheckStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CrossCheckStackProps = {}) {
    super(scope, id, props);

    const projectsTable = new dynamodb.Table(this, "ProjectsTable", {
      tableName: "crosscheck-projects",
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const uploadBucket = new s3.Bucket(this, "UploadBucket", {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: true,
      lifecycleRules: [{ expiration: cdk.Duration.days(365) }],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const commonEnv: Record<string, string> = {
      PROJECTS_TABLE: projectsTable.tableName,
      UPLOAD_BUCKET: uploadBucket.bucketName,
      NODE_OPTIONS: "--enable-source-maps",
    };
    if (props.bedrockModelId) commonEnv.BEDROCK_MODEL_ID = props.bedrockModelId;

    const makeFunction = (name: string, entry: string, timeoutSeconds = 10) =>
      new NodejsFunction(this, name, {
        entry: path.join(BACKEND, "src", "handlers", entry),
        projectRoot: REPO_ROOT,
        depsLockFilePath: path.join(BACKEND, "package-lock.json"),
        handler: "handler",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        memorySize: 512,
        timeout: cdk.Duration.seconds(timeoutSeconds),
        environment: commonEnv,
        logGroup: new logs.LogGroup(this, `${name}Logs`, {
          retention: logs.RetentionDays.ONE_MONTH,
          removalPolicy: cdk.RemovalPolicy.DESTROY,
        }),
        bundling: {
          minify: true,
          sourceMap: true,
          format: OutputFormat.ESM,
          target: "node22",
          banner:
            "import{createRequire}from'module';const require=createRequire(import.meta.url);",
        },
      });

    const projectsFn = makeFunction("ProjectsFunction", "projects.ts");
    const collisionsFn = makeFunction("CollisionsFunction", "collisions.ts");
    const briefFn = makeFunction("BriefFunction", "brief.ts");
    const uploadFn = makeFunction("UploadFunction", "upload.ts", 30);
    const assistantFn = makeFunction("AssistantFunction", "assistant.ts", 30);
    const seedFn = makeFunction("SeedFunction", "seed.ts", 60);

    for (const fn of [projectsFn, collisionsFn, briefFn, assistantFn]) {
      projectsTable.grantReadData(fn);
    }
    projectsTable.grantReadWriteData(uploadFn);
    projectsTable.grantWriteData(seedFn);
    uploadBucket.grantPut(uploadFn);

    if (props.bedrockModelId) {
      assistantFn.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["bedrock:InvokeModel"],
          resources: [
            `arn:aws:bedrock:${this.region}::foundation-model/${props.bedrockModelId}`,
            `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/${props.bedrockModelId}`,
          ],
        }),
      );
    }

    const httpApi = new apigw.HttpApi(this, "CrossCheckApi", {
      apiName: "crosscheck-api",
      corsPreflight: {
        allowOrigins: ["*"],
        allowMethods: [apigw.CorsHttpMethod.GET, apigw.CorsHttpMethod.POST, apigw.CorsHttpMethod.OPTIONS],
        allowHeaders: ["content-type"],
      },
    });

    const route = (
      routePath: string,
      method: apigw.HttpMethod,
      fn: NodejsFunction,
      integrationId: string,
    ) =>
      httpApi.addRoutes({
        path: routePath,
        methods: [method],
        integration: new integrations.HttpLambdaIntegration(integrationId, fn),
      });

    route("/projects", apigw.HttpMethod.GET, projectsFn, "ProjectsIntegration");
    route("/collisions", apigw.HttpMethod.GET, collisionsFn, "CollisionsIntegration");
    route("/collisions/{collisionId}/brief", apigw.HttpMethod.GET, briefFn, "BriefIntegration");
    route("/datasets", apigw.HttpMethod.POST, uploadFn, "UploadIntegration");
    route("/assistant", apigw.HttpMethod.POST, assistantFn, "AssistantIntegration");

    // CloudFront is OPTIONAL. Disable with `-c cloudfront=false`.
    const cloudfrontContext = this.node.tryGetContext("cloudfront");
    const cloudfrontEnabled =
      cloudfrontContext !== false &&
      cloudfrontContext !== "false" &&
      cloudfrontContext !== "0" &&
      cloudfrontContext !== "off" &&
      cloudfrontContext !== "no";

    cdk.Annotations.of(this).addInfo(
      cloudfrontEnabled
        ? "CloudFront ENABLED"
        : "CloudFront DISABLED - no AWS::CloudFront::Distribution will be created.",
    );

    const siteBucket = cloudfrontEnabled
      ? new s3.Bucket(this, "SiteBucket", {
          encryption: s3.BucketEncryption.S3_MANAGED,
          blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
          enforceSSL: true,
          removalPolicy: cdk.RemovalPolicy.DESTROY,
          autoDeleteObjects: true,
        })
      : new s3.Bucket(this, "SiteBucket", {
          websiteIndexDocument: "index.html",
          websiteErrorDocument: "index.html",
          publicReadAccess: true,
          blockPublicAccess: new s3.BlockPublicAccess({
            blockPublicAcls: false,
            blockPublicPolicy: false,
            ignorePublicAcls: false,
            restrictPublicBuckets: false,
          }),
          encryption: s3.BucketEncryption.S3_MANAGED,
          removalPolicy: cdk.RemovalPolicy.DESTROY,
          autoDeleteObjects: true,
        });

    let distribution: cloudfront.Distribution | undefined;

    if (cloudfrontEnabled) {
      const apiDomain = cdk.Fn.select(2, cdk.Fn.split("/", httpApi.apiEndpoint));

      distribution = new cloudfront.Distribution(this, "SiteDistribution", {
        defaultRootObject: "index.html",
        defaultBehavior: {
          origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        additionalBehaviors: {
          "/api/*": {
            origin: new origins.HttpOrigin(apiDomain, {
              originPath: "",
              protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
            }),
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
            cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
            originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_CUSTOM_ORIGIN,
          },
        },
        errorResponses: [
          { httpStatus: 403, responseHttpStatus: 200, responsePagePath: "/index.html" },
          { httpStatus: 404, responseHttpStatus: 200, responsePagePath: "/index.html" },
        ],
      });
    }

    new deployment.BucketDeployment(this, "DeploySite", {
      sources: [deployment.Source.asset(FRONTEND_DIST)],
      destinationBucket: siteBucket,
      ...(distribution ? { distribution, distributionPaths: ["/*"] } : {}),
    });

    const seeder = new customresources.AwsCustomResource(this, "SeedDataset", {
      onCreate: {
        service: "Lambda",
        action: "invoke",
        parameters: { FunctionName: seedFn.functionName, InvocationType: "RequestResponse" },
        physicalResourceId: customresources.PhysicalResourceId.of("crosscheck-seed"),
      },
      onUpdate: {
        service: "Lambda",
        action: "invoke",
        parameters: { FunctionName: seedFn.functionName, InvocationType: "RequestResponse" },
        physicalResourceId: customresources.PhysicalResourceId.of(`crosscheck-seed-${Date.now()}`),
      },
      installLatestAwsSdk: false,
      policy: customresources.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({ actions: ["lambda:InvokeFunction"], resources: [seedFn.functionArn] }),
      ]),
    });
    seeder.node.addDependency(projectsTable, seedFn);

    new cdk.CfnOutput(this, "ApiUrl", { value: httpApi.apiEndpoint });
    new cdk.CfnOutput(this, "SiteBucketName", { value: siteBucket.bucketName });
    new cdk.CfnOutput(this, "ProjectsTableName", { value: projectsTable.tableName });

    if (distribution) {
      new cdk.CfnOutput(this, "SiteUrl", { value: `https://${distribution.distributionDomainName}` });
      new cdk.CfnOutput(this, "DistributionId", { value: distribution.distributionId });
    } else {
      new cdk.CfnOutput(this, "SiteUrl", { value: siteBucket.bucketWebsiteUrl });
      new cdk.CfnOutput(this, "CloudFrontStatus", { value: "Disabled via -c cloudfront=false" });
    }
  }
}
