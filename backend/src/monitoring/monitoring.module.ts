import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonitorSnapshot } from './monitor-snapshot.entity';
import { ScheduledSubscription } from './scheduled-subscription.entity';
import { MonitoringService } from './monitoring.service';
import { MonitoringController } from './monitoring.controller';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { NotificationService } from './notification.service';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [TypeOrmModule.forFeature([MonitorSnapshot, ScheduledSubscription]), MetricsModule],
  providers: [MonitoringService, SubscriptionService, NotificationService],
  controllers: [MonitoringController, SubscriptionController],
  exports: [MonitoringService, SubscriptionService],
})
export class MonitoringModule {}
