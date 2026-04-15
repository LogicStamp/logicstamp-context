import express from 'express';

const router = express.Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true });
});

export { router };
