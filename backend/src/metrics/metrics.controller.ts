import { Controller, Get, Post, Body, UseGuards, Query, ParseArrayPipe, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MetricsService } from './metrics.service';
import { CreateMetricDto } from './dto/create-metric.dto';
import { QueryMetricsDto } from './dto/query-metrics.dto';

interface RequestWithUser extends Request {
  user: { id: number; username: string; role: string };
}

@UseGuards(JwtAuthGuard)
@Controller('metrics')
export class MetricsController {
  constructor(private service: MetricsService) {}

  @Get()
  findAll(
    @Request() req: RequestWithUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('names', new ParseArrayPipe({ items: String, separator: ',', optional: true })) names?: string[],
    @Query('category') category?: string,
  ) {
    const role = req.user.role;
    const query: QueryMetricsDto = { startDate, endDate, names, category };
    if (startDate || endDate || names || category) {
      return this.service.findByQuery(query, role);
    }
    return this.service.findAll(role);
  }

  @Get('summary')
  getSummary(
    @Request() req: RequestWithUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('names', new ParseArrayPipe({ items: String, separator: ',', optional: true })) names?: string[],
    @Query('category') category?: string,
  ) {
    const role = req.user.role;
    const query: QueryMetricsDto = { startDate, endDate, names, category };
    return this.service.getSummary(query, role);
  }

  @Post()
  create(@Body() dto: CreateMetricDto) {
    return this.service.create(dto);
  }
}
