import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SubscriptionService } from './subscription.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

interface RequestWithUser extends Request {
  user: { id: number; username: string; role: string };
}

@UseGuards(JwtAuthGuard)
@Controller('monitoring/subscriptions')
export class SubscriptionController {
  constructor(private readonly service: SubscriptionService) {}

  @Post()
  create(@Body() dto: CreateSubscriptionDto, @Request() req: RequestWithUser) {
    dto.userId = req.user.id;
    return this.service.create(dto);
  }

  @Get()
  findAll(@Request() req: RequestWithUser) {
    return this.service.findAll(req.user.id);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Request() req: RequestWithUser) {
    const sub = await this.service.findOne(id);
    if (!sub || sub.userId !== req.user.id) {
      throw new NotFoundException();
    }
    return sub;
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSubscriptionDto,
    @Request() req: RequestWithUser,
  ) {
    const existing = await this.service.findOne(id);
    if (!existing || existing.userId !== req.user.id) {
      throw new NotFoundException();
    }
    const result = await this.service.update(id, dto);
    if (!result) throw new NotFoundException();
    return result;
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Request() req: RequestWithUser) {
    const existing = await this.service.findOne(id);
    if (!existing || existing.userId !== req.user.id) {
      throw new NotFoundException();
    }
    const deleted = await this.service.remove(id);
    if (!deleted) throw new NotFoundException();
    return { deleted: true };
  }

  @Post(':id/execute')
  async execute(@Param('id', ParseIntPipe) id: number, @Request() req: RequestWithUser) {
    const sub = await this.service.findOne(id);
    if (!sub || sub.userId !== req.user.id) {
      throw new NotFoundException();
    }
    return this.service.executeSubscription(sub);
  }

  @Post(':id/reset')
  async reset(@Param('id', ParseIntPipe) id: number, @Request() req: RequestWithUser) {
    const existing = await this.service.findOne(id);
    if (!existing || existing.userId !== req.user.id) {
      throw new NotFoundException();
    }
    const result = await this.service.resetSubscription(id);
    if (!result) throw new NotFoundException();
    return result;
  }
}
