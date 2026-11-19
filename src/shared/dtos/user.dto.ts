import { OmitType } from '@nestjs/swagger';

import { User } from '../schemas/index.js';

export class UserDto extends OmitType(User, ['password'] as const) {}
export class CreateUserDto extends OmitType(User, ['id']) {}
