import { Controller, Get, UseGuards, Request, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MonitoringService } from './monitoring.service';
import { CompareSnapshotsDto } from './dto/compare-snapshots.dto';

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

  @Get('compare')
  compare(
    @Query() query: CompareSnapshotsDto,
    @Request() req: RequestWithUser,
  ) {
    return this.service.compareSnapshots(
      query.timestampA,
      query.timestampB,
      req.user.role,
    );
  }
}
