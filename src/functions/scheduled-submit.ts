import { randomUUID } from 'node:crypto';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { docClient, sqsClient } from '../shared/aws';
import { env } from '../shared/config';
import { Job } from '../shared/types';
export const handler = async () => {
  const jobId = randomUUID();
  const now = new Date().toISOString();
  const job: Job = { jobId, type: 'REPORT_GENERATION', payload: { report: 'scheduled-daily' }, status: 'QUEUED', createdAt: now, updatedAt: now, attempts: 0 };
  await docClient.send(new PutCommand({ TableName: env.JOBS_TABLE, Item: job }));
  await sqsClient.send(new SendMessageCommand({ QueueUrl: env.JOBS_QUEUE_URL, MessageBody: JSON.stringify({ jobId }) }));
  return { jobId, status: 'QUEUED' };
};
