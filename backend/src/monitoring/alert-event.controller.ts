import { Controller, Get, Query } from '@nestjs/common';
import { AlertEngine } from './alert-engine.service';

@Controller('monitoring/alerts')
export class AlertEventController {
  constructor(private readonly alertEngine: AlertEngine) {}

  @Get('active')
  getActiveAlerts() {
    return this.alertEngine.getActiveAlerts();
  }

  @Get('history')
  getAlertHistory(@Query('limit') limit?: string) {
    const limitNum = limit ? Number(limit) : 100;
    return this.alertEngine.getAlertHistory(limitNum);
  }
}
