import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../shared/aws';
import { env } from '../shared/config';
import { json } from '../shared/http';
export const handler = async (event: any) => {
  const limit = Math.min(Math.max(Number(event.queryStringParameters?.limit ?? 20), 1), 100);
  const result = await docClient.send(new ScanCommand({ TableName: env.JOBS_TABLE, Limit: limit }));
  return json(200, { items: result.Items ?? [], count: result.Count ?? 0 });
};
