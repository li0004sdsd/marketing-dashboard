import { IsNumber } from 'class-validator';

export class SetDefaultLayoutDto {
  @IsNumber()
  layoutId: number;
}
