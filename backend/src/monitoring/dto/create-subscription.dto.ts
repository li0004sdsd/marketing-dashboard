import { IsString, IsEmail, IsOptional, IsBoolean, IsInt } from 'class-validator';

export class CreateSubscriptionDto {
  @IsString()
  name: string;

  @IsString()
  cronExpression: string;

  @IsEmail()
  email: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsInt()
  userId: number;
}
