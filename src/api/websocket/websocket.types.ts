import { type AuthenticatedUser } from '@/domain/auth/auth.service.js';
import { Socket as IOSocket } from 'socket.io';

export class Socket extends IOSocket {
  user?: AuthenticatedUser;
  roomType?: string;
  roomId?: string;
  room?: string;
}
