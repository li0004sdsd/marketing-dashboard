import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MetricsService } from './metrics.service';
import { CreateMetricDto } from './dto/create-metric.dto';

@UseGuards(JwtAuthGuard)
@Controller('metrics')
export class MetricsController {
  constructor(private service: MetricsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('summary')
  getSummary() {
    return this.service.getSummary();
  }

  @Post()
  create(@Body() dto: CreateMetricDto) {
    return this.service.create(dto);
  }
}
