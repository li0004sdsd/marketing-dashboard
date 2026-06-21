import { Injectable, Logger } from '@nestjs/common';
import { MonitorSnapshot } from './monitor-snapshot.entity';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  async sendAlertEmail(
    to: string,
    subscriptionName: string,
    alerts: MonitorSnapshot[],
  ): Promise<void> {
    const subject = `[监控告警] ${subscriptionName} - 发现 ${alerts.length} 个异常指标`;
    const body = this.buildEmailBody(subscriptionName, alerts);

    this.logger.log(`Sending alert email to=${to}, subject="${subject}"`);

    this.logger.debug(`Email body:\n${body}`);
  }

  private buildEmailBody(subscriptionName: string, alerts: MonitorSnapshot[]): string {
    const timestamp = new Date().toISOString();
    const alertLines = alerts
      .map(a => `  - ${a.metricName}: ${a.value}${a.unit ? ' ' + a.unit : ''} [${a.status}]`)
      .join('\n');

    return [
      `监控订阅: ${subscriptionName}`,
      `时间: ${timestamp}`,
      '',
      `发现 ${alerts.length} 个异常指标:`,
      alertLines,
      '',
      '请及时关注并处理。',
    ].join('\n');
  }
}
