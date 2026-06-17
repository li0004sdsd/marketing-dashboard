import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private service: DashboardService) {}

  @Get('kpis')
  getKpis() {
    return this.service.getKpis();
  }

  @Get('charts')
  getCharts() {
    return this.service.getCharts();
  }
}
