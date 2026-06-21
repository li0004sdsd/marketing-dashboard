import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private service: DashboardService) {}

  @Get('kpis')
  getKpis(@Query('days') days?: string) {
    const daysNum = days ? parseInt(days, 10) : undefined;
    return this.service.getKpis(daysNum);
  }

  @Get('charts')
  getCharts(@Query('days') days?: string) {
    const daysNum = days ? parseInt(days, 10) : undefined;
    return this.service.getCharts(daysNum);
  }
}
