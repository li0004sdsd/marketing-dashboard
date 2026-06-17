import { IsString, IsOptional } from 'class-validator';

export class UpdateDataSourceDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsString()
  @IsOptional()
  connectionString?: string;

  @IsString()
  @IsOptional()
  status?: string;
}
