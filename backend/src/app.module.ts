import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { DataSourcesModule } from './data-sources/data-sources.module';
import { MetricsModule } from './metrics/metrics.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DashboardLayoutsModule } from './dashboard-layouts/dashboard-layouts.module';
import { User } from './users/user.entity';
import { DataSource } from './data-sources/data-source.entity';
import { Metric } from './metrics/metric.entity';
import { MonitorSnapshot } from './monitoring/monitor-snapshot.entity';
import { ScheduledSubscription } from './monitoring/scheduled-subscription.entity';
import { DashboardLayout } from './dashboard-layouts/dashboard-layout.entity';
import { BaselineInit } from './migrations/1700000000000-BaselineInit';
import { AddScheduledSubscriptions } from './migrations/1700000000001-AddScheduledSubscriptions';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: 'marketing_dashboard.db',
      entities: [User, DataSource, Metric, MonitorSnapshot, ScheduledSubscription, DashboardLayout],
      synchronize: false,
      migrationsRun: true,
      migrations: [BaselineInit, AddScheduledSubscriptions],
    }),
    UsersModule,
    AuthModule,
    DataSourcesModule,
    MetricsModule,
    MonitoringModule,
    DashboardModule,
    DashboardLayoutsModule,
  ],
})
export class AppModule {}
