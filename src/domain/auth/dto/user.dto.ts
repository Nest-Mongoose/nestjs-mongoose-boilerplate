import { User } from '@/data-access/schemas/user.schema.js';
import { OmitType } from '@nestjs/swagger';

export class UserDto extends OmitType(User, ['password'] as const) {}
export class CreateUserDto extends OmitType(User, ['id']) {}
