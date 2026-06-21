import { Controller, Get, Post, Put, Delete, Param, Body, Query, NotFoundException } from '@nestjs/common';
import { AlertRuleService } from './alert-rule.service';
import { AlertEngine } from './alert-engine.service';
import { CreateAlertRuleDto } from './dto/create-alert-rule.dto';
import { UpdateAlertRuleDto } from './dto/update-alert-rule.dto';

@Controller('monitoring/rules')
export class AlertRuleController {
  constructor(
    private readonly ruleService: AlertRuleService,
    private readonly alertEngine: AlertEngine,
  ) {}

  @Post()
  create(@Body() dto: CreateAlertRuleDto) {
    return this.ruleService.create(dto);
  }

  @Get()
  findAll(@Query('metricName') metricName?: string) {
    return this.ruleService.findAll(metricName);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const rule = await this.ruleService.findOne(Number(id));
    if (!rule) throw new NotFoundException('Rule not found');
    return rule;
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateAlertRuleDto) {
    const rule = await this.ruleService.update(Number(id), dto);
    if (!rule) throw new NotFoundException('Rule not found');
    return rule;
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const ok = await this.ruleService.remove(Number(id));
    if (!ok) throw new NotFoundException('Rule not found');
    return { success: true };
  }

  @Post(':id/enable')
  async enable(@Param('id') id: string) {
    const rule = await this.ruleService.toggleEnabled(Number(id), true);
    if (!rule) throw new NotFoundException('Rule not found');
    return rule;
  }

  @Post(':id/disable')
  async disable(@Param('id') id: string) {
    const rule = await this.ruleService.toggleEnabled(Number(id), false);
    if (!rule) throw new NotFoundException('Rule not found');
    return rule;
  }

  @Get(':id/events')
  async getRuleEvents(@Param('id') id: string) {
    return this.alertEngine.getAlertsByRule(Number(id));
  }
}
