import { Request, Response } from 'express';

export interface Post {
  id: string;
  title: string;
  content: string;
  slug: string;
}

export function getPosts(req: Request, res: Response<Post[]>): void {
  res.json([]);
}

export function getPostById(req: Request, res: Response<Post>): void {
  const { slug } = req.params;
  res.json({ id: '1', title: 'Test', content: 'Content', slug });
}

export function createPost(req: Request<{}, Post, Post>, res: Response<Post>): void {
  const post = req.body;
  res.status(201).json({ id: '1', ...post });
}
