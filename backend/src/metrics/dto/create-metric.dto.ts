import { IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateMetricDto {
  @IsString()
  name: string;

  @IsNumber()
  value: number;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsString()
  category: string;

  @IsNumber()
  @IsOptional()
  dataSourceId?: number;
}
