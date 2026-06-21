import { IsString, IsEmail, IsOptional, IsBoolean, IsNumber, IsEnum } from 'class-validator';
import { ComparisonType } from '../alert-rule.entity';

export class UpdateAlertRuleDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  metricName?: string;

  @IsEnum(['above', 'below', 'change_rate'])
  @IsOptional()
  comparisonType?: ComparisonType;

  @IsNumber()
  @IsOptional()
  threshold?: number;

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
