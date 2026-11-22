import { describe, expect, it } from 'vitest';
import { validateCreateJob } from '../src/shared/validation';
describe('validateCreateJob', () => {
  it('accepts a supported job and object payload', () => { expect(validateCreateJob({ type: 'DATA_EXPORT', payload: { format: 'csv' } }).ok).toBe(true); });
  it('rejects unsupported job types', () => { expect(validateCreateJob({ type: 'UNKNOWN', payload: {} }).ok).toBe(false); });
  it('rejects array payloads', () => { expect(validateCreateJob({ type: 'IMAGE_RESIZE', payload: [] }).ok).toBe(false); });
});
