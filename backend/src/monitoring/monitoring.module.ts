import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonitorSnapshot } from './monitor-snapshot.entity';
import { MonitoringService } from './monitoring.service';
import { MonitoringController } from './monitoring.controller';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [TypeOrmModule.forFeature([MonitorSnapshot]), MetricsModule],
  providers: [MonitoringService],
  controllers: [MonitoringController],
  exports: [MonitoringService],
})
export class MonitoringModule {}
