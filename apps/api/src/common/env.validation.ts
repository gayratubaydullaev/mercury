export function validateEnv(): Record<string, unknown> {
  const required: { key: string; minLength?: number }[] = [
    { key: 'DATABASE_URL' },
    { key: 'JWT_SECRET', minLength: 32 },
    ...(process.env.NODE_ENV === 'production'
      ? [{ key: 'CSRF_SECRET', minLength: 32 } as { key: string; minLength?: number }]
      : []),
  ];
  const missing: string[] = [];
  for (const { key, minLength } of required) {
    const val = process.env[key];
    if (!val?.trim()) missing.push(key);
    else if (minLength != null && val.length < minLength) {
      missing.push(`${key} (min ${minLength} chars)`);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing or invalid required env: ${missing.join(', ')}. Check .env and .env.example.`,
    );
  }
  return process.env as Record<string, unknown>;
}
