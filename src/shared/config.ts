const required = (key: string) => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
};
export const env = {
  JOBS_TABLE: required('JOBS_TABLE'),
  IDEMPOTENCY_TABLE: required('IDEMPOTENCY_TABLE'),
  JOBS_QUEUE_URL: required('JOBS_QUEUE_URL'),
  RESULTS_BUCKET: required('RESULTS_BUCKET'),
  MAX_ATTEMPTS: Number(process.env.MAX_ATTEMPTS ?? 3),
};
