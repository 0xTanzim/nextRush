import { Method } from './Method';
import { Request } from './Request';
import { Response } from './Response';

export type Path = string | RegExp;

export type Handler = (req: Request, res: Response) => void | Promise<void>;

export interface Route {
  method: Method;
  path: Path;
  handler: Handler;
}
