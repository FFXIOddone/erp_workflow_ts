---
mode: agent
description: "Scaffold a new API route with auth, validation, Prisma, broadcast, error handling"
---

# API Route Scaffolding

Create a new API route following the exact ERP conventions.

## Template

```typescript
import { Router } from 'express';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db/client.js';
import { broadcast } from '../ws/server.js';
import { NotFoundError, BadRequestError } from '../middleware/error-handler.js';
import { logActivity, ActivityAction, EntityType } from '../lib/activity-logger.js';
import { CreateXxxSchema, UpdateXxxSchema } from '@erp/shared';

export const xxxRouter = Router();
xxxRouter.use(authenticate);

// GET /api/v1/xxx - List all
xxxRouter.get('/', async (req: AuthRequest, res) => {
  const items = await prisma.xxx.findMany({
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: items });
});

// GET /api/v1/xxx/:id - Get one
xxxRouter.get('/:id', async (req: AuthRequest, res) => {
  const item = await prisma.xxx.findUnique({
    where: { id: req.params.id },
  });
  if (!item) throw NotFoundError('Item not found');
  res.json({ success: true, data: item });
});

// POST /api/v1/xxx - Create
xxxRouter.post('/', async (req: AuthRequest, res) => {
  const data = CreateXxxSchema.parse(req.body);
  const item = await prisma.xxx.create({ data });
  broadcast({ type: 'XXX_CREATED', payload: item, timestamp: new Date() });
  await logActivity({
    action: ActivityAction.CREATE,
    entityType: EntityType.XXX,
    entityId: item.id,
    description: `Created xxx ${item.id}`,
    userId: req.userId!,
    req,
  });
  res.status(201).json({ success: true, data: item });
});

// PATCH /api/v1/xxx/:id - Update
xxxRouter.patch('/:id', async (req: AuthRequest, res) => {
  const data = UpdateXxxSchema.parse(req.body);
  const item = await prisma.xxx.update({
    where: { id: req.params.id },
    data,
  });
  broadcast({ type: 'XXX_UPDATED', payload: item, timestamp: new Date() });
  await logActivity({
    action: ActivityAction.UPDATE,
    entityType: EntityType.XXX,
    entityId: item.id,
    description: `Updated xxx ${item.id}`,
    userId: req.userId!,
    req,
  });
  res.json({ success: true, data: item });
});

// DELETE /api/v1/xxx/:id - Delete
xxxRouter.delete('/:id', async (req: AuthRequest, res) => {
  await prisma.xxx.delete({ where: { id: req.params.id } });
  broadcast({ type: 'XXX_DELETED', payload: { id: req.params.id }, timestamp: new Date() });
  await logActivity({
    action: ActivityAction.DELETE,
    entityType: EntityType.XXX,
    entityId: req.params.id,
    description: `Deleted xxx ${req.params.id}`,
    userId: req.userId!,
    req,
  });
  res.json({ success: true });
});
```

## Registration
Add to `packages/server/src/index.ts`:
```typescript
import { xxxRouter } from './routes/xxx.js';
app.use('/api/v1/xxx', xxxRouter);
```

## Checklist
- [ ] Zod schemas exist in `@erp/shared` for Create and Update
- [ ] Route uses `authenticate` middleware
- [ ] Request bodies validated with Zod `.parse()`
- [ ] Errors use `NotFoundError`/`BadRequestError`
- [ ] State changes broadcast via WebSocket
- [ ] Significant actions logged with `logActivity()`
- [ ] Route registered in server index
- [ ] `.js` extension on all imports
