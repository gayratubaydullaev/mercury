import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

const HEADER = 'x-request-id';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const incoming = req.header(HEADER);
  const id = typeof incoming === 'string' && incoming.trim().length > 0 ? incoming.trim().slice(0, 128) : randomUUID();
  (req as Request & { requestId?: string }).requestId = id;
  res.setHeader(HEADER, id);
  next();
}
