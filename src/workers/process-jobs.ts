import { SQSEvent, SQSBatchResponse } from 'aws-lambda';
import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { docClient, s3Client } from '../shared/aws';
import { env } from '../shared/config';
import { Job } from '../shared/types';

async function processOne(jobId: string): Promise<void> {
  const found = await docClient.send(new GetCommand({ TableName: env.JOBS_TABLE, Key: { jobId } }));
  if (!found.Item) throw new Error(`Job ${jobId} was not found`);
  const job = found.Item as Job;
  await docClient.send(new UpdateCommand({ TableName: env.JOBS_TABLE, Key: { jobId }, UpdateExpression: 'SET #status = :processing, updatedAt = :now, attempts = if_not_exists(attempts, :zero) + :one', ExpressionAttributeNames: { '#status': 'status' }, ExpressionAttributeValues: { ':processing': 'PROCESSING', ':now': new Date().toISOString(), ':zero': 0, ':one': 1 } }));
  try {
    const result = { jobId, type: job.type, processedAt: new Date().toISOString(), output: { message: `${job.type} demonstration handler completed`, input: job.payload } };
    const key = `results/${jobId}.json`;
    await s3Client.send(new PutObjectCommand({ Bucket: env.RESULTS_BUCKET, Key: key, Body: JSON.stringify(result), ContentType: 'application/json' }));
    await docClient.send(new UpdateCommand({ TableName: env.JOBS_TABLE, Key: { jobId }, UpdateExpression: 'SET #status = :completed, resultKey = :key, updatedAt = :now REMOVE #error', ExpressionAttributeNames: { '#status': 'status', '#error': 'error' }, ExpressionAttributeValues: { ':completed': 'COMPLETED', ':key': key, ':now': new Date().toISOString() } }));
  } catch (error) {
    await docClient.send(new UpdateCommand({ TableName: env.JOBS_TABLE, Key: { jobId }, UpdateExpression: 'SET #status = :failed, #error = :error, updatedAt = :now', ExpressionAttributeNames: { '#status': 'status', '#error': 'error' }, ExpressionAttributeValues: { ':failed': 'FAILED', ':error': error instanceof Error ? error.message : 'Unknown error', ':now': new Date().toISOString() } }));
    throw error;
  }
}
export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const failures: SQSBatchResponse['batchItemFailures'] = [];
  for (const record of event.Records) {
    try { const body = JSON.parse(record.body); await processOne(body.jobId); }
    catch { failures.push({ itemIdentifier: record.messageId }); }
  }
  return { batchItemFailures: failures };
};
