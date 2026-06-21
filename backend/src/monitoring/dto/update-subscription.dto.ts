import { IsString, IsEmail, IsOptional, IsBoolean } from 'class-validator';

export class UpdateSubscriptionDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  cronExpression?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}
