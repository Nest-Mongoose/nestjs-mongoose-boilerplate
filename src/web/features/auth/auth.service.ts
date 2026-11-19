import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { type HashOptions, argon2id, hash, verify } from 'argon2';
import { Model } from 'mongoose';

import { type CreateUserDto } from '../../../shared/dtos/index.js';
import { User, type UserDocument } from '../../../shared/schemas/user.schema.js';

type PersistedUser = User & { id: string };
export type AuthenticatedUser = Omit<PersistedUser, 'password'>;

const ARGON2_OPTIONS: HashOptions = {
  type: argon2id,
  memoryCost: 19 * 1024,
  timeCost: 2,
  parallelism: 1,
};

type MongoDuplicateKeyError = {
  code: number;
  keyPattern: Record<string, unknown>;
};

function isEmailDuplicateKeyError(error: unknown): error is MongoDuplicateKeyError {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const candidate = error as Record<string, unknown>;
  return (
    candidate.code === 11000 &&
    typeof candidate.keyPattern === 'object' &&
    candidate.keyPattern !== null &&
    'email' in candidate.keyPattern
  );
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async validateUser({
    email,
    password,
  }: {
    email: string;
    password: string;
  }): Promise<AuthenticatedUser | null> {
    const user = await this.findUserByEmail(email);

    if (!user) {
      return null;
    }

    if (!(await verify(user.password, password))) {
      return null;
    }

    const { password: _password, ...authenticatedUser } = user;
    return authenticatedUser;
  }

  async login(user: Pick<PersistedUser, 'email' | 'id'>): Promise<{ token: string }> {
    const payload = { email: user.email, sub: user.id };
    return {
      token: this.jwtService.sign(payload),
    };
  }

  async findUserByEmail(email: string): Promise<PersistedUser | null> {
    const user = await this.userModel.findOne({ email }).exec();
    return user ? (user.toObject({ virtuals: true }) as PersistedUser) : null;
  }

  async findAuthenticatedUserByEmail(email: string): Promise<AuthenticatedUser | null> {
    const user = await this.findUserByEmail(email);
    if (!user) {
      return null;
    }

    const { password: _password, ...authenticatedUser } = user;
    return authenticatedUser;
  }

  async deleteUser(id: string): Promise<void> {
    await this.userModel.deleteOne({ _id: id }).exec();
  }

  public async saveUser(data: CreateUserDto): Promise<AuthenticatedUser> {
    const password = await hash(data.password, ARGON2_OPTIONS);
    try {
      const document = await this.userModel.create({ ...data, password });
      const user = document.toObject({ virtuals: true }) as PersistedUser;
      const { password: _password, ...registeredUser } = user;
      return registeredUser;
    } catch (error) {
      if (isEmailDuplicateKeyError(error)) {
        throw new BadRequestException('Email already in use. Please try a different email.');
      }
      throw error;
    }
  }
}
