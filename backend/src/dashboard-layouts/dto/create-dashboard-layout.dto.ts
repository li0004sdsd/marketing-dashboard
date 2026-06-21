import { IsString, IsNotEmpty, IsOptional, IsObject, IsArray, ValidateNested, IsNumber, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

class WidgetPositionDto {
  @IsNumber()
  x: number;

  @IsNumber()
  y: number;
}

class WidgetSizeDto {
  @IsNumber()
  width: number;

  @IsNumber()
  height: number;
}

class WidgetDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsArray()
  @IsNumber({}, { each: true })
  metricIds: number[];

  @ValidateNested()
  @Type(() => WidgetPositionDto)
  position: WidgetPositionDto;

  @ValidateNested()
  @Type(() => WidgetSizeDto)
  size: WidgetSizeDto;

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}

class LayoutConfigDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WidgetDto)
  widgets: WidgetDto[];

  @IsOptional()
  @IsNumber()
  gridCols?: number;

  @IsOptional()
  @IsNumber()
  rowHeight?: number;
}

export class CreateDashboardLayoutDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @ValidateNested()
  @Type(() => LayoutConfigDto)
  layoutConfig: LayoutConfigDto;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
