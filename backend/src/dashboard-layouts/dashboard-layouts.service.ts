import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { DashboardLayout } from './dashboard-layout.entity';
import { CreateDashboardLayoutDto } from './dto/create-dashboard-layout.dto';
import { UpdateDashboardLayoutDto } from './dto/update-dashboard-layout.dto';

@Injectable()
export class DashboardLayoutsService {
  constructor(
    @InjectRepository(DashboardLayout)
    private readonly layoutRepository: Repository<DashboardLayout>,
    private readonly dataSource: DataSource,
  ) {}

  async findAllByUser(userId: number): Promise<DashboardLayout[]> {
    return this.layoutRepository.find({
      where: { userId },
      order: { isDefault: 'DESC', updatedAt: 'DESC' },
    });
  }

  async findOne(id: number, userId: number): Promise<DashboardLayout> {
    const layout = await this.layoutRepository.findOne({ where: { id, userId } });
    if (!layout) {
      throw new NotFoundException('布局不存在');
    }
    return layout;
  }

  async getDefaultLayout(userId: number): Promise<DashboardLayout | null> {
    return this.layoutRepository.findOne({ where: { userId, isDefault: true } });
  }

  async create(userId: number, dto: CreateDashboardLayoutDto): Promise<DashboardLayout> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existing = await queryRunner.manager.findOne(DashboardLayout, {
        where: { userId, name: dto.name },
      });
      if (existing) {
        throw new ConflictException(`已存在名为 "${dto.name}" 的布局`);
      }

      const layout = queryRunner.manager.create(DashboardLayout, {
        userId,
        name: dto.name,
        description: dto.description,
        layoutConfig: dto.layoutConfig,
        isDefault: false,
      });

      const saved = await queryRunner.manager.save(layout);

      if (dto.isDefault) {
        await this.clearDefaultWithinTransaction(queryRunner, userId);
        saved.isDefault = true;
        await queryRunner.manager.save(saved);
      }

      await queryRunner.commitTransaction();
      return saved;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async update(id: number, userId: number, dto: UpdateDashboardLayoutDto): Promise<DashboardLayout> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const layout = await queryRunner.manager.findOne(DashboardLayout, { where: { id, userId } });
      if (!layout) {
        throw new NotFoundException('布局不存在');
      }

      if (dto.name && dto.name !== layout.name) {
        const existing = await queryRunner.manager.findOne(DashboardLayout, {
          where: { userId, name: dto.name },
        });
        if (existing) {
          throw new ConflictException(`已存在名为 "${dto.name}" 的布局`);
        }
      }

      const updated = Object.assign(layout, dto);
      const saved = await queryRunner.manager.save(updated);

      await queryRunner.commitTransaction();
      return saved;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async setDefault(userId: number, layoutId: number): Promise<DashboardLayout> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const layout = await queryRunner.manager.findOne(DashboardLayout, {
        where: { id: layoutId, userId },
      });
      if (!layout) {
        throw new NotFoundException('布局不存在');
      }

      await this.clearDefaultWithinTransaction(queryRunner, userId);

      layout.isDefault = true;
      const saved = await queryRunner.manager.save(layout);

      await queryRunner.commitTransaction();
      return saved;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async delete(id: number, userId: number): Promise<void> {
    const layout = await this.layoutRepository.findOne({ where: { id, userId } });
    if (!layout) {
      throw new NotFoundException('布局不存在');
    }

    if (layout.isDefault) {
      throw new BadRequestException('无法删除默认布局，请先将其他布局设为默认');
    }

    await this.layoutRepository.delete(id);
  }

  private async clearDefaultWithinTransaction(queryRunner: QueryRunner, userId: number): Promise<void> {
    await queryRunner.manager.update(
      DashboardLayout,
      { userId, isDefault: true },
      { isDefault: false },
    );
  }
}
