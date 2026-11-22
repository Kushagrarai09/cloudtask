import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { SQSClient } from '@aws-sdk/client-sqs';
import { S3Client } from '@aws-sdk/client-s3';
const config = process.env.AWS_ENDPOINT_URL ? { endpoint: process.env.AWS_ENDPOINT_URL, region: process.env.AWS_REGION ?? 'ap-south-1' } : {};
export const docClient = DynamoDBDocumentClient.from(new DynamoDBClient(config));
export const sqsClient = new SQSClient(config);
export const s3Client = new S3Client(config);
