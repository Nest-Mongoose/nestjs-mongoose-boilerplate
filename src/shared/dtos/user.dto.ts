import { OmitType } from '@nestjs/swagger';

import { User } from '../schemas';

export class UserDto extends User {}
export class CreateUserDto extends OmitType(User, ['id']) {}
