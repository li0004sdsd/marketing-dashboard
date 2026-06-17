import { IsString, IsOptional } from 'class-validator';

export class CreateDataSourceDto {
  @IsString()
  name: string;

  @IsString()
  type: string;

  @IsString()
  @IsOptional()
  connectionString?: string;

  @IsString()
  @IsOptional()
  status?: string;
}
