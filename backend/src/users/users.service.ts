import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private repo: Repository<User>,
  ) {}

  async findByUsername(username: string): Promise<User | null> {
    return this.repo.findOne({ where: { username } });
  }

  async create(username: string, password: string, role = 'viewer'): Promise<User> {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = this.repo.create({ username, passwordHash, role });
    return this.repo.save(user);
  }
}
