import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MonitoringService } from './monitoring.service';

interface RequestWithUser extends Request {
  user: { id: number; username: string; role: string };
}

@UseGuards(JwtAuthGuard)
@Controller('monitoring')
export class MonitoringController {
  constructor(private service: MonitoringService) {}

  @Get('realtime')
  getRealtime(@Request() req: RequestWithUser) {
    return this.service.getRealtime(req.user.role);
  }

  @Get('alerts')
  getAlerts(@Request() req: RequestWithUser) {
    return this.service.getAlerts(req.user.role);
  }
}
