import { IsString, IsNotEmpty } from 'class-validator';

export class CompareSnapshotsDto {
  @IsString()
  @IsNotEmpty()
  timestampA: string;

  @IsString()
  @IsNotEmpty()
  timestampB: string;
}
