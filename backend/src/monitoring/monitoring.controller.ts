import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MonitoringService } from './monitoring.service';

@UseGuards(JwtAuthGuard)
@Controller('monitoring')
export class MonitoringController {
  constructor(private service: MonitoringService) {}

  @Get('realtime')
  getRealtime() {
    return this.service.getRealtime();
  }

  @Get('alerts')
  getAlerts() {
    return this.service.getAlerts();
  }
}
