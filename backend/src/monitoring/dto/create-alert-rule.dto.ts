import { IsString, IsEmail, IsOptional, IsBoolean, IsNumber, IsEnum } from 'class-validator';
import { ComparisonType } from '../alert-rule.entity';

export class CreateAlertRuleDto {
  @IsString()
  name: string;

  @IsString()
  metricName: string;

  @IsEnum(['above', 'below', 'change_rate'])
  comparisonType: ComparisonType;

  @IsNumber()
  threshold: number;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsEmail()
  @IsOptional()
  notificationEmail?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  severity?: string;
}
