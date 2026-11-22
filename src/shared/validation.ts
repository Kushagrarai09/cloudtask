import { JobType } from './types';
const types: JobType[] = ['IMAGE_RESIZE', 'REPORT_GENERATION', 'DATA_EXPORT'];
export const validateCreateJob = (value: any): { ok: true; value: { type: JobType; payload: Record<string, unknown> } } | { ok: false; message: string } => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, message: 'Body must be an object' };
  if (!types.includes(value.type)) return { ok: false, message: `type must be one of: ${types.join(', ')}` };
  if (!value.payload || typeof value.payload !== 'object' || Array.isArray(value.payload)) return { ok: false, message: 'payload must be an object' };
  return { ok: true, value: { type: value.type, payload: value.payload } };
};
