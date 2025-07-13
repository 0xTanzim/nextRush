import { ServerResponse } from 'node:http';
import { ContentType } from './ContentType';

// Branded type to indicate response is finished
export type FinishedResponse = Response & { __finished: true };

export interface Response extends ServerResponse {
  json: (data: unknown, status?: number) => FinishedResponse;
  send: (
    data: string,
    status?: number,
    contentType?: ContentType
  ) => FinishedResponse;
  status: (code: number) => Response;
  serveHtmlFile: (
    relativePath: string,
    status?: number
  ) => Promise<FinishedResponse>;
}
