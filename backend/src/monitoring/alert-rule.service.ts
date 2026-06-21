import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlertRule } from './alert-rule.entity';
import { CreateAlertRuleDto } from './dto/create-alert-rule.dto';
import { UpdateAlertRuleDto } from './dto/update-alert-rule.dto';

@Injectable()
export class AlertRuleService {
  constructor(
    @InjectRepository(AlertRule)
    private readonly repo: Repository<AlertRule>,
  ) {}

  async create(dto: CreateAlertRuleDto): Promise<AlertRule> {
    const rule = this.repo.create({
      name: dto.name,
      metricName: dto.metricName,
      comparisonType: dto.comparisonType,
      threshold: dto.threshold,
      enabled: dto.enabled ?? true,
      notificationEmail: dto.notificationEmail ?? '',
      description: dto.description ?? null,
      severity: dto.severity ?? 'warning',
    });
    return this.repo.save(rule);
  }

  async findAll(metricName?: string): Promise<AlertRule[]> {
    if (metricName) {
      return this.repo.find({ where: { metricName } });
    }
    return this.repo.find();
  }

  async findEnabled(): Promise<AlertRule[]> {
    return this.repo.find({ where: { enabled: true } });
  }

  async findOne(id: number): Promise<AlertRule | null> {
    return this.repo.findOne({ where: { id } });
  }

  async update(id: number, dto: UpdateAlertRuleDto): Promise<AlertRule | null> {
    const rule = await this.findOne(id);
    if (!rule) return null;
    Object.assign(rule, dto);
    return this.repo.save(rule);
  }

  async remove(id: number): Promise<boolean> {
    const result = await this.repo.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async toggleEnabled(id: number, enabled: boolean): Promise<AlertRule | null> {
    const rule = await this.findOne(id);
    if (!rule) return null;
    rule.enabled = enabled;
    return this.repo.save(rule);
  }
}
