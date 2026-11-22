import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as stepfunctionsTasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';

export interface CloudTaskStackProps extends cdk.StackProps { stage: string; }
export class CloudTaskStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CloudTaskStackProps) {
    super(scope, id, props);
    const { stage } = props;
    const jobs = new dynamodb.Table(this, 'JobsTable', { tableName: `cloudtask-jobs-${stage}`, partitionKey: { name: 'jobId', type: dynamodb.AttributeType.STRING }, billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, pointInTimeRecovery: true, encryption: dynamodb.TableEncryption.AWS_MANAGED, removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY });
    const idempotency = new dynamodb.Table(this, 'IdempotencyTable', { tableName: `cloudtask-idempotency-${stage}`, partitionKey: { name: 'idempotencyKey', type: dynamodb.AttributeType.STRING }, billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, timeToLiveAttribute: 'ttl', encryption: dynamodb.TableEncryption.AWS_MANAGED, removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY });
    const bucket = new s3.Bucket(this, 'ResultsBucket', { bucketName: `cloudtask-results-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}-${stage}`, encryption: s3.BucketEncryption.S3_MANAGED, blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, enforceSSL: true, versioned: true, lifecycleRules: [{ expiration: cdk.Duration.days(90) }], removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY, autoDeleteObjects: stage !== 'prod' });
    const dlq = new sqs.Queue(this, 'JobsDLQ', { queueName: `cloudtask-jobs-dlq-${stage}`, retentionPeriod: cdk.Duration.days(14), encryption: sqs.QueueEncryption.SQS_MANAGED });
    const queue = new sqs.Queue(this, 'JobsQueue', { queueName: `cloudtask-jobs-${stage}`, visibilityTimeout: cdk.Duration.seconds(180), retentionPeriod: cdk.Duration.days(4), encryption: sqs.QueueEncryption.SQS_MANAGED, deadLetterQueue: { queue: dlq, maxReceiveCount: 3 } });
    const env = { JOBS_TABLE: jobs.tableName, IDEMPOTENCY_TABLE: idempotency.tableName, JOBS_QUEUE_URL: queue.queueUrl, RESULTS_BUCKET: bucket.bucketName, MAX_ATTEMPTS: '3' };
    const common = { runtime: lambda.Runtime.NODEJS_22_X, bundling: { minify: true, sourceMap: true, target: 'node22' }, environment: env };
    const createJob = new nodejs.NodejsFunction(this, 'CreateJobFunction', { ...common, entry: '../src/functions/create-job.ts', handler: 'handler', timeout: cdk.Duration.seconds(10) });
    const getJob = new nodejs.NodejsFunction(this, 'GetJobFunction', { ...common, entry: '../src/functions/get-job.ts', handler: 'handler', timeout: cdk.Duration.seconds(10) });
    const listJobs = new nodejs.NodejsFunction(this, 'ListJobsFunction', { ...common, entry: '../src/functions/list-jobs.ts', handler: 'handler', timeout: cdk.Duration.seconds(10) });
    const uploadUrl = new nodejs.NodejsFunction(this, 'UploadUrlFunction', { ...common, entry: '../src/functions/upload-url.ts', handler: 'handler', timeout: cdk.Duration.seconds(10) });
    const worker = new nodejs.NodejsFunction(this, 'WorkerFunction', { ...common, entry: '../src/workers/process-jobs.ts', handler: 'handler', timeout: cdk.Duration.seconds(120), memorySize: 1024 });
    const scheduled = new nodejs.NodejsFunction(this, 'ScheduledSubmitFunction', { ...common, entry: '../src/functions/scheduled-submit.ts', handler: 'handler', timeout: cdk.Duration.seconds(10) });
    jobs.grantReadWriteData(createJob); jobs.grantReadData(getJob); jobs.grantReadData(listJobs); jobs.grantReadWriteData(worker);
    idempotency.grantReadWriteData(createJob);
    queue.grantSendMessages(createJob); queue.grantSendMessages(scheduled); queue.grantConsumeMessages(worker);
    bucket.grantReadWrite(worker); bucket.grantPut(uploadUrl);
    const mapping = new lambda.EventSourceMapping(this, 'QueueEventSource', { target: worker, eventSourceArn: queue.queueArn, batchSize: 5, reportBatchItemFailures: true, maxConcurrency: 5 });
    void mapping;
    const api = new apigateway.RestApi(this, 'CloudTaskApi', { restApiName: `cloudtask-api-${stage}`, deployOptions: { stageName: stage, metricsEnabled: true, loggingLevel: apigateway.MethodLoggingLevel.ERROR, dataTraceEnabled: false }, defaultCorsPreflightOptions: { allowOrigins: apigateway.Cors.ALL_ORIGINS, allowMethods: apigateway.Cors.ALL_METHODS, allowHeaders: ['Content-Type', 'Idempotency-Key'] } });
    const jobsResource = api.root.addResource('jobs');
    jobsResource.addMethod('POST', new apigateway.LambdaIntegration(createJob));
    jobsResource.addMethod('GET', new apigateway.LambdaIntegration(listJobs));
    jobsResource.addResource('{jobId}').addMethod('GET', new apigateway.LambdaIntegration(getJob));
    api.root.addResource('uploads').addResource('presign').addMethod('POST', new apigateway.LambdaIntegration(uploadUrl));
    const rule = new events.Rule(this, 'DailySchedule', { enabled: false, schedule: events.Schedule.cron({ minute: '0', hour: '2' }) });
    rule.addTarget(new targets.LambdaFunction(scheduled));
    const definition = new stepfunctionsTasks.LambdaInvoke(this, 'SubmitScheduledJob', { lambdaFunction: scheduled, outputPath: '$.Payload' });
    const stateMachine = new stepfunctions.StateMachine(this, 'ScheduledWorkflow', { stateMachineName: `cloudtask-workflow-${stage}`, definitionBody: stepfunctions.DefinitionBody.fromChainable(definition), timeout: cdk.Duration.minutes(5) });
    void stateMachine;
    worker.metricErrors().createAlarm(this, 'WorkerErrorsAlarm', { threshold: 3, evaluationPeriods: 1 });
    new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
    new cdk.CfnOutput(this, 'JobsQueueUrl', { value: queue.queueUrl });
    new cdk.CfnOutput(this, 'ResultsBucketName', { value: bucket.bucketName });
    new cdk.CfnOutput(this, 'WorkflowArn', { value: stateMachine.stateMachineArn });
  }
}
