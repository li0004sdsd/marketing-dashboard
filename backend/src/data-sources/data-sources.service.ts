import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DataSource } from './data-source.entity';
import { CreateDataSourceDto } from './dto/create-data-source.dto';
import { UpdateDataSourceDto } from './dto/update-data-source.dto';

@Injectable()
export class DataSourcesService {
  constructor(
    @InjectRepository(DataSource)
    private repo: Repository<DataSource>,
  ) {}

  findAll() {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: number) {
    const ds = await this.repo.findOne({ where: { id } });
    if (!ds) throw new NotFoundException(`DataSource ${id} not found`);
    return ds;
  }

  create(dto: CreateDataSourceDto) {
    const ds = this.repo.create(dto);
    return this.repo.save(ds);
  }

  async update(id: number, dto: UpdateDataSourceDto) {
    await this.findOne(id);
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.repo.delete(id);
    return { message: 'Deleted' };
  }
}
