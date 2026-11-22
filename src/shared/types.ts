export type JobType = 'IMAGE_RESIZE' | 'REPORT_GENERATION' | 'DATA_EXPORT';
export type JobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export interface Job { jobId: string; type: JobType; payload: Record<string, unknown>; status: JobStatus; createdAt: string; updatedAt: string; attempts: number; resultKey?: string; error?: string; }
export interface QueueMessage { jobId: string; }
