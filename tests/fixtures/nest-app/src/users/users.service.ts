import { Injectable } from '@nestjs/common';
import { CreateUserDto, UpdateUserDto } from '../dto/user.dto.js';

export interface User {
  id: string;
  name: string;
  email: string;
}

@Injectable()
export class UsersService {
  async findAll(): Promise<User[]> {
    return [];
  }

  async findOne(id: string): Promise<User> {
    return { id, name: 'Test', email: 'test@example.com' };
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    return { id: '1', ...createUserDto };
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    return { id, ...updateUserDto };
  }

  async remove(id: string): Promise<void> {
    // Remove logic
  }
}
