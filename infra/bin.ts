import * as cdk from 'aws-cdk-lib';
import { CloudTaskStack } from './lib/cloudtask-stack';
const app = new cdk.App();
new CloudTaskStack(app, `CloudTask-${process.env.STAGE ?? 'dev'}`, {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION ?? process.env.AWS_REGION ?? 'ap-south-1' },
  stage: process.env.STAGE ?? 'dev',
});
