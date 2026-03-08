import { NextRequest, NextResponse } from 'next/server';

const FORWARD_HEADERS = [
  'authorization',
  'content-type',
  'accept',
  'x-cart-session',
  'x-csrf-token',
  'cookie',
] as const;

function getBackendUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  let url = raw.includes(',') ? raw.split(',')[0].trim() : raw;
  if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
  return url.replace(/\/$/, '');
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  return proxy(request, params, 'GET');
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  return proxy(request, params, 'POST');
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  return proxy(request, params, 'PATCH');
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  return proxy(request, params, 'DELETE');
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  return proxy(request, params, 'PUT');
}

async function proxy(
  request: NextRequest,
  params: Promise<{ path?: string[] }>,
  method: string
): Promise<NextResponse> {
  const { path } = await params;
  const pathSegments = path ?? [];
  const pathStr = pathSegments.join('/');
  const backendUrl = getBackendUrl();
  const url = `${backendUrl}/${pathStr}${request.nextUrl.search}`;

  const headers = new Headers();
  for (const name of FORWARD_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  let body: string | undefined;
  try {
    const text = await request.text();
    if (text) body = text;
  } catch {
    // no body
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ?? undefined,
  });

  const resHeaders = new Headers();
  const contentType = res.headers.get('content-type');
  if (contentType) resHeaders.set('content-type', contentType);
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) resHeaders.set('set-cookie', setCookie);

  const resBody = await res.text();
  return new NextResponse(resBody, {
    status: res.status,
    statusText: res.statusText,
    headers: resHeaders,
  });
}
