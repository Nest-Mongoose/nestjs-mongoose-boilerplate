import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';

import { User, UserDocument } from '@/shared/schemas/user.schema';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async validateUser({ email, password }: { email: string; password: string }): Promise<any> {
    const user = await this.findUserByEmail(email);

    if (!user) {
      return null;
    }

    if (!bcrypt.compareSync(password, user.password)) {
      return null;
    }

    delete user.password;

    return user;
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user.id };

    return {
      token: this.jwtService.sign(payload),
    };
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return (await this.userModel.findOne({ email }).exec())?.toObject() || null;
  }

  public async saveUser(data: {
    email: string;
    password: string;
    name: string;
    gender?: string;
  }): Promise<User> {
    data.password = bcrypt.hashSync(data.password, bcrypt.genSaltSync());
    try {
      const user = (await this.userModel.create(data)).toObject();
      delete user.password;

      return user;
    } catch (error) {
      if (error.code === 11000 && error.keyPattern?.email) {
        throw new BadRequestException('Email already in use. Please try a different email.');
      }
      throw error;
    }
  }
}
