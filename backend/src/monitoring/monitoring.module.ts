import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonitorSnapshot } from './monitor-snapshot.entity';
import { ScheduledSubscription } from './scheduled-subscription.entity';
import { AlertRule } from './alert-rule.entity';
import { AlertEvent } from './alert-event.entity';
import { MonitoringService } from './monitoring.service';
import { MonitoringController } from './monitoring.controller';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { NotificationService } from './notification.service';
import { AlertRuleService } from './alert-rule.service';
import { AlertEngine } from './alert-engine.service';
import { AlertRuleController } from './alert-rule.controller';
import { AlertEventController } from './alert-event.controller';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MonitorSnapshot,
      ScheduledSubscription,
      AlertRule,
      AlertEvent,
    ]),
    MetricsModule,
  ],
  providers: [
    MonitoringService,
    SubscriptionService,
    NotificationService,
    AlertRuleService,
    AlertEngine,
  ],
  controllers: [
    MonitoringController,
    SubscriptionController,
    AlertRuleController,
    AlertEventController,
  ],
  exports: [MonitoringService, SubscriptionService, AlertRuleService, AlertEngine],
})
export class MonitoringModule {}
