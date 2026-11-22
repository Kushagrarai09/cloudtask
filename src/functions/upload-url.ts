import { randomUUID } from 'node:crypto';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../shared/config';
import { json, parseBody } from '../shared/http';
import { s3Client } from '../shared/aws';
export const handler = async (event: any) => {
  const body = parseBody(event);
  if (!body.ok || typeof body.value.fileName !== 'string' || typeof body.value.contentType !== 'string') return json(400, { message: 'fileName and contentType are required' });
  const safeName = body.value.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `uploads/${randomUUID()}-${safeName}`;
  const command = new PutObjectCommand({ Bucket: env.RESULTS_BUCKET, Key: key, ContentType: body.value.contentType });
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
  return json(200, { uploadUrl, objectKey: key, expiresIn: 300 });
};
