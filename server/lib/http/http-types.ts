export interface RequestLike {
  body?: unknown;
  query?: Record<string, unknown>;
  headers?: Record<string, unknown>;
  method: string;
  path: string;
  originalUrl?: string;
  protocol?: string;
  secure?: boolean;
  ip?: string;
  hostname?: string;
  get?(name: string): string | undefined;
}

export interface ResponseLike {
  status(code: number): ResponseLike;
  json(payload: unknown): ResponseLike;
  setHeader?(name: string, value: string): void;
  header?(name: string, value: string): ResponseLike;
  redirect?(statusOrUrl: number | string, url?: string): ResponseLike;
}

export type NextLike = (error?: unknown) => void;

export type RequestHandlerLike = (
  req: RequestLike,
  res: ResponseLike,
  next: NextLike
) => unknown;

export type ErrorRequestHandlerLike = (
  err: unknown,
  req: RequestLike,
  res: ResponseLike,
  next: NextLike
) => unknown;

export interface AppLike {
  get(path: string, handler: RequestHandlerLike): void;
  post(path: string, handler: RequestHandlerLike): void;
  use(handler: RequestHandlerLike | ErrorRequestHandlerLike): void;
  set?(name: string, value: unknown): void;
  disable?(name: string): void;
}

export interface ServerLike {
  on(event: 'error', handler: (error: NodeJS.ErrnoException | Error) => void): void;
}

export interface ListenableAppLike extends AppLike {
  listen(port: number, host: string, callback: () => void): ServerLike;
}
