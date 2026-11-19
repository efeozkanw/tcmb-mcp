export class TcmbError extends Error {
  override name = 'TcmbError';
}

export class UpstreamError extends TcmbError {
  override name = 'UpstreamError';

  constructor(
    message: string,
    readonly retryable = false,
  ) {
    super(message);
  }
}
