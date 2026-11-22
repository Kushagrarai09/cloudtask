import { randomUUID } from 'node:crypto';
import { PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { docClient, sqsClient } from '../shared/aws';
import { env } from '../shared/config';
import { json, parseBody } from '../shared/http';
import { Job, JobType } from '../shared/types';
import { validateCreateJob } from '../shared/validation';

export const handler = async (event: any) => {
  const parsed = parseBody(event);
  if (!parsed.ok) return json(400, { message: 'Request body must be valid JSON.' });
  const validation = validateCreateJob(parsed.value);
  if (!validation.ok) return json(400, { message: validation.message });
  const key = event.headers?.['Idempotency-Key'] ?? event.headers?.['idempotency-key'];
  if (key) {
    const existing = await docClient.send(new GetCommand({ TableName: env.IDEMPOTENCY_TABLE, Key: { idempotencyKey: key } }));
    if (existing.Item?.jobId) return json(202, { jobId: existing.Item.jobId, status: 'QUEUED', deduplicated: true });
  }
  const jobId = randomUUID();
  const job: Job = { jobId, type: validation.value.type as JobType, payload: validation.value.payload, status: 'QUEUED', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), attempts: 0 };
  await docClient.send(new PutCommand({ TableName: env.JOBS_TABLE, Item: job, ConditionExpression: 'attribute_not_exists(jobId)' }));
  if (key) await docClient.send(new PutCommand({ TableName: env.IDEMPOTENCY_TABLE, Item: { idempotencyKey: key, jobId, ttl: Math.floor(Date.now()/1000) + 86400 }, ConditionExpression: 'attribute_not_exists(idempotencyKey)' }));
  await sqsClient.send(new SendMessageCommand({ QueueUrl: env.JOBS_QUEUE_URL, MessageBody: JSON.stringify({ jobId }) }));
  return json(202, { jobId, status: 'QUEUED' });
};
