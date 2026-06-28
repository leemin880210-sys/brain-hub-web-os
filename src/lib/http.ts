import { NextResponse } from "next/server";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400"
};

function withCors(init?: ResponseInit): ResponseInit {
  const headers = new Headers(init?.headers);

  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }

  return {
    ...init,
    headers
  };
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, withCors(init));
}

export function fail(message: string, status = 500, details?: unknown) {
  const detailMessage = details instanceof Error ? details.message : details;

  return NextResponse.json(
    {
      error: message,
      details: detailMessage
    },
    withCors({ status })
  );
}

export function preflight() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders
  });
}

export function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }

  return value.trim();
}
