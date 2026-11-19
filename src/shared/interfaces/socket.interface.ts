import { Socket as IOSocket } from 'socket.io';

import { type AuthenticatedUser } from '../../web/features/auth/auth.service.js';

export class Socket extends IOSocket {
  user?: AuthenticatedUser;
  roomType?: string;
  roomId?: string;
  room?: string;
}
