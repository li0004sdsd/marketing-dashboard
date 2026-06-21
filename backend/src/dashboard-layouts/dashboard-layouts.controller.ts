import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardLayoutsService } from './dashboard-layouts.service';
import { CreateDashboardLayoutDto } from './dto/create-dashboard-layout.dto';
import { UpdateDashboardLayoutDto } from './dto/update-dashboard-layout.dto';
import { SetDefaultLayoutDto } from './dto/set-default-layout.dto';

interface RequestWithUser extends Request {
  user: { id: number; username: string; role: string };
}

@UseGuards(JwtAuthGuard)
@Controller('dashboard-layouts')
export class DashboardLayoutsController {
  constructor(private readonly service: DashboardLayoutsService) {}

  @Get()
  findAll(@Request() req: RequestWithUser) {
    return this.service.findAllByUser(req.user.id);
  }

  @Get('default')
  getDefault(@Request() req: RequestWithUser) {
    return this.service.getDefaultLayout(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.service.findOne(parseInt(id, 10), req.user.id);
  }

  @Post()
  create(@Body() dto: CreateDashboardLayoutDto, @Request() req: RequestWithUser) {
    return this.service.create(req.user.id, dto);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateDashboardLayoutDto,
    @Request() req: RequestWithUser,
  ) {
    return this.service.update(parseInt(id, 10), req.user.id, dto);
  }

  @Post('set-default')
  setDefault(@Body() dto: SetDefaultLayoutDto, @Request() req: RequestWithUser) {
    return this.service.setDefault(req.user.id, dto.layoutId);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.service.delete(parseInt(id, 10), req.user.id);
  }
}
