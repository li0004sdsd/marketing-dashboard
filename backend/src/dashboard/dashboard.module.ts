import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { Metric } from '../metrics/metric.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Metric])],
  providers: [DashboardService],
  controllers: [DashboardController],
})
export class DashboardModule {}
