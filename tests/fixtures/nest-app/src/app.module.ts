import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module.js';
import { PostsModule } from './posts/posts.module.js';

@Module({
  imports: [UsersModule, PostsModule],
})
export class AppModule {}
