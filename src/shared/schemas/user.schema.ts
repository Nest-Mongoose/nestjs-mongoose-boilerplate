import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';
import { HydratedDocument } from 'mongoose';

import { GENDER } from '@/shared/enums';

export type UserDocument = HydratedDocument<User>;

@Schema({
  collection: 'users',
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class User {
  @IsMongoId()
  @IsOptional()
  @ApiProperty({ description: 'ID', default: '66e1c5a0809bae0741157574' })
  id?: string;

  @Prop({ type: String, required: true, unique: true })
  @IsEmail()
  @MaxLength(100)
  @ApiProperty({ description: 'Email', default: 'john@nest.com' })
  email: string;

  @Prop({ type: String, required: true })
  @IsString()
  @MaxLength(100)
  @ApiProperty({ description: 'Password' })
  password: string;

  @Prop({ type: String, required: true })
  @IsString()
  @MaxLength(100)
  @ApiProperty({ description: 'Name', default: 'John' })
  name: string;

  @Prop({ type: String, required: false })
  @IsEnum(GENDER)
  @IsOptional()
  @ApiProperty({ description: 'Gender', enum: GENDER })
  gender?: GENDER;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.virtual('id').get(function () {
  return this._id?.toString();
});
