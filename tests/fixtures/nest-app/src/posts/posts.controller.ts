import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { PostsService } from './posts.service.js';
import { CreatePostDto } from '../dto/post.dto.js';

export interface Post {
  id: string;
  title: string;
  content: string;
  slug: string;
}

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  findAll(): Promise<Post[]> {
    return this.postsService.findAll();
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string): Promise<Post> {
    return this.postsService.findOne(slug);
  }

  @Post()
  create(@Body() createPostDto: CreatePostDto): Promise<Post> {
    return this.postsService.create(createPostDto);
  }
}
