import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardLayout } from './dashboard-layout.entity';
import { DashboardLayoutsService } from './dashboard-layouts.service';
import { DashboardLayoutsController } from './dashboard-layouts.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DashboardLayout])],
  providers: [DashboardLayoutsService],
  controllers: [DashboardLayoutsController],
  exports: [DashboardLayoutsService],
})
export class DashboardLayoutsModule {}
