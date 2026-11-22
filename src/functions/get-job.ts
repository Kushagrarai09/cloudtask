import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../shared/aws';
import { env } from '../shared/config';
import { json } from '../shared/http';
export const handler = async (event: any) => {
  const jobId = event.pathParameters?.jobId;
  if (!jobId) return json(400, { message: 'jobId is required' });
  const result = await docClient.send(new GetCommand({ TableName: env.JOBS_TABLE, Key: { jobId } }));
  return result.Item ? json(200, result.Item) : json(404, { message: 'Job not found' });
};
