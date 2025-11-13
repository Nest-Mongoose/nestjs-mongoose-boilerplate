import { Socket as IOSocket } from 'socket.io';

import { type User } from '@/shared/schemas/user.schema';

type SocketId = string;

export class Socket extends IOSocket {
  id: SocketId;
  user?: User;
  roomType?: string;
  roomId?: string;
  room?: string;
}
