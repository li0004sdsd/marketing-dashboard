import { IsOptional, IsString, IsArray, ArrayNotEmpty } from 'class-validator';

export class QueryMetricsDto {
  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  names?: string[];

  @IsOptional()
  @IsString()
  category?: string;
}
