import express from 'express';
import { userRoutes } from './routes/users.js';
import { postRoutes } from './routes/posts.js';

const app = express();

app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);

export default app;
