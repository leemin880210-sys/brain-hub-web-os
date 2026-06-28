export const EXTERNAL_BRAIN_API_BASE =
  (process.env.BRAIN_API_BASE || process.env.NEXT_PUBLIC_BRAIN_API_BASE || "https://your-brain-api-domain.com/api").replace(
    /\/$/,
    ""
  );

export async function externalBrainApi(path: string, init?: RequestInit) {
  const response = await fetch(`${EXTERNAL_BRAIN_API_BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(process.env.BRAIN_API_TOKEN ? { Authorization: `Bearer ${process.env.BRAIN_API_TOKEN}` } : {}),
      ...(init?.headers ?? {})
    }
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : typeof payload?.message === "string"
          ? payload.message
          : response.statusText;
    throw new Error(message);
  }

  return payload;
}
