export const json = (statusCode: number, body: unknown) => ({ statusCode, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
export const parseBody = (event: any): { ok: true; value: any } | { ok: false } => {
  try { return { ok: true, value: event.body ? JSON.parse(event.body) : {} }; }
  catch { return { ok: false }; }
};
