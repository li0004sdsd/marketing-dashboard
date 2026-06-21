import { Controller, Get, Post, Body, UseGuards, Query, ParseArrayPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MetricsService } from './metrics.service';
import { CreateMetricDto } from './dto/create-metric.dto';
import { QueryMetricsDto } from './dto/query-metrics.dto';

@UseGuards(JwtAuthGuard)
@Controller('metrics')
export class MetricsController {
  constructor(private service: MetricsService) {}

  @Get()
  findAll(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('names', new ParseArrayPipe({ items: String, separator: ',', optional: true })) names?: string[],
    @Query('category') category?: string,
  ) {
    const query: QueryMetricsDto = { startDate, endDate, names, category };
    if (startDate || endDate || names || category) {
      return this.service.findByQuery(query);
    }
    return this.service.findAll();
  }

  @Get('summary')
  getSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('names', new ParseArrayPipe({ items: String, separator: ',', optional: true })) names?: string[],
    @Query('category') category?: string,
  ) {
    const query: QueryMetricsDto = { startDate, endDate, names, category };
    return this.service.getSummary(query);
  }

  @Post()
  create(@Body() dto: CreateMetricDto) {
    return this.service.create(dto);
  }
}
