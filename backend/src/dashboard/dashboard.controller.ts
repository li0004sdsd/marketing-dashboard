import { Controller, Get, UseGuards, Query, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

interface RequestWithUser extends Request {
  user: { id: number; username: string; role: string };
}

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private service: DashboardService) {}

  @Get('kpis')
  getKpis(@Query('days') days?: string, @Request() req?: RequestWithUser) {
    const daysNum = days ? parseInt(days, 10) : undefined;
    const role = req.user.role;
    return this.service.getKpis(daysNum, role);
  }

  @Get('charts')
  getCharts(@Query('days') days?: string, @Request() req?: RequestWithUser) {
    const daysNum = days ? parseInt(days, 10) : undefined;
    const role = req.user.role;
    return this.service.getCharts(daysNum, role);
  }
}
