import { NextResponse } from "next/server";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(message: string, status = 500, details?: unknown) {
  const detailMessage = details instanceof Error ? details.message : details;

  return NextResponse.json(
    {
      error: message,
      details: detailMessage
    },
    { status }
  );
}

export function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }

  return value.trim();
}
