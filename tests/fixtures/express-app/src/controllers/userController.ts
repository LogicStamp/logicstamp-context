import { Request, Response } from 'express';

export interface User {
  id: string;
  name: string;
  email: string;
}

export async function getUsers(req: Request, res: Response): Promise<void> {
  res.json({ users: [] });
}

export function getUserById(req: Request, res: Response): void {
  const { id } = req.params;
  res.json({ id, name: 'Test User' });
}

export function createUser(req: Request, res: Response): void {
  const user: User = req.body;
  res.status(201).json({ id: '1', ...user });
}

export function updateUser(req: Request, res: Response): void {
  const { id } = req.params;
  const updates = req.body;
  res.json({ id, ...updates });
}

export function deleteUser(req: Request, res: Response): void {
  const { id } = req.params;
  res.status(204).send();
}
