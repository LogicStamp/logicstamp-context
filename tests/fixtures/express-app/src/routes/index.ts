import express from 'express';
import { userRoutes } from './users.js';
import { postRoutes } from './posts.js';

const router = express.Router();

router.use('/users', userRoutes);
router.use('/posts', postRoutes);

export { router };
