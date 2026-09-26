import type { IncomingMessage, ServerResponse } from 'http';
import { routesFromProcessEnv } from '../server/routes.js';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return routesFromProcessEnv()['/api/ai'](req, res);
}
