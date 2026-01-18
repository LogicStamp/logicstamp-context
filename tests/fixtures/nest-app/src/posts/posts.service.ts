import { Injectable } from '@nestjs/common';
import { CreatePostDto } from '../dto/post.dto.js';

export interface Post {
  id: string;
  title: string;
  content: string;
  slug: string;
}

@Injectable()
export class PostsService {
  async findAll(): Promise<Post[]> {
    return [];
  }

  async findOne(slug: string): Promise<Post> {
    return { id: '1', title: 'Test', content: 'Content', slug };
  }

  async create(createPostDto: CreatePostDto): Promise<Post> {
    return { id: '1', ...createPostDto };
  }
}
