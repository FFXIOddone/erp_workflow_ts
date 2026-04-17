import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db/client.js';
import { broadcast } from '../ws/server.js';
import { buildRouteBroadcastPayload } from '../lib/route-broadcast.js';

const router = Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
const PHOTO_DIR = path.join(UPLOAD_DIR, 'photos');
if (!fs.existsSync(PHOTO_DIR)) {
  fs.mkdirSync(PHOTO_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PHOTO_DIR),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `photo-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// POST /photo-upload/token (authenticated) - Generate short-lived JWT for mobile photo upload
router.post('/token', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({ success: false, error: 'orderId is required' });
  }

  const order = await prisma.workOrder.findUnique({ where: { id: orderId } });
  if (!order) {
    return res.status(404).json({ success: false, error: 'Order not found' });
  }

  // Generate a short-lived token (10 minutes)
  const token = jwt.sign(
    { orderId, userId, purpose: 'photo-upload' },
    process.env.JWT_SECRET!,
    { expiresIn: '10m' }
  );

  res.json({ success: true, data: { token } });
});

// GET /photo-upload/:token - Serve mobile-friendly photo upload page (no login required)
router.get('/:token', (req: Request, res: Response) => {
  const { token } = req.params;

  try {
    jwt.verify(token, process.env.JWT_SECRET!);
  } catch {
    return res.status(401).send('<html><body><h2>Link expired or invalid</h2><p>Please scan the QR code again.</p></body></html>');
  }

  // Serve a minimal mobile-friendly HTML page
  const serverUrl = `${req.protocol}://${req.get('host')}`;
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>Upload Photo - Wilde Signs</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f3f4f6; min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 20px; }
    .container { max-width: 400px; width: 100%; }
    h1 { font-size: 1.5rem; color: #111827; margin-bottom: 8px; text-align: center; }
    .subtitle { color: #6b7280; text-align: center; margin-bottom: 24px; font-size: 0.9rem; }
    .upload-area { background: white; border: 3px dashed #d1d5db; border-radius: 16px; padding: 40px 20px; text-align: center; cursor: pointer; transition: all 0.2s; }
    .upload-area:active, .upload-area.dragging { border-color: #3b82f6; background: #eff6ff; }
    .upload-area svg { width: 48px; height: 48px; color: #9ca3af; margin-bottom: 12px; }
    .upload-area p { color: #6b7280; font-size: 1rem; }
    .btn { display: block; width: 100%; padding: 16px; border: none; border-radius: 12px; font-size: 1.1rem; font-weight: 600; cursor: pointer; margin-top: 16px; }
    .btn-primary { background: #3b82f6; color: white; }
    .btn-primary:active { background: #2563eb; }
    .btn-primary:disabled { background: #93c5fd; }
    .preview { margin-top: 16px; border-radius: 12px; overflow: hidden; }
    .preview img { width: 100%; display: block; }
    .status { text-align: center; margin-top: 16px; padding: 12px; border-radius: 8px; font-weight: 500; }
    .status.success { background: #d1fae5; color: #065f46; }
    .status.error { background: #fee2e2; color: #991b1b; }
    .status.uploading { background: #dbeafe; color: #1e40af; }
    input[type="file"] { display: none; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Shipment Photo</h1>
    <p class="subtitle">Take or select a photo to attach to the order</p>
    <div class="upload-area" id="uploadArea" onclick="document.getElementById('fileInput').click()">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.04l-.821 1.316z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"/></svg>
      <p>Tap to take photo</p>
    </div>
    <input type="file" id="fileInput" accept="image/*" capture="environment">
    <div id="preview" class="preview" style="display:none"></div>
    <button id="uploadBtn" class="btn btn-primary" style="display:none" disabled>Upload Photo</button>
    <div id="status" class="status" style="display:none"></div>
    <button id="anotherBtn" class="btn btn-primary" style="display:none" onclick="reset()">Take Another Photo</button>
  </div>
  <script>
    const token = '${token}';
    const uploadUrl = '${serverUrl}/api/v1/photo-upload/${token}/upload';
    let selectedFile = null;
    const fileInput = document.getElementById('fileInput');
    const preview = document.getElementById('preview');
    const uploadBtn = document.getElementById('uploadBtn');
    const status = document.getElementById('status');
    const uploadArea = document.getElementById('uploadArea');
    const anotherBtn = document.getElementById('anotherBtn');

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      selectedFile = file;
      const reader = new FileReader();
      reader.onload = (ev) => {
        preview.innerHTML = '<img src="' + ev.target.result + '">';
        preview.style.display = 'block';
        uploadArea.style.display = 'none';
        uploadBtn.style.display = 'block';
        uploadBtn.disabled = false;
        status.style.display = 'none';
      };
      reader.readAsDataURL(file);
    });

    uploadBtn.addEventListener('click', async () => {
      if (!selectedFile) return;
      uploadBtn.disabled = true;
      status.className = 'status uploading';
      status.textContent = 'Uploading...';
      status.style.display = 'block';

      const formData = new FormData();
      formData.append('photo', selectedFile);

      try {
        const res = await fetch(uploadUrl, { method: 'POST', body: formData });
        const json = await res.json();
        if (json.success) {
          status.className = 'status success';
          status.textContent = 'Photo uploaded successfully!';
          uploadBtn.style.display = 'none';
          anotherBtn.style.display = 'block';
        } else {
          throw new Error(json.error || 'Upload failed');
        }
      } catch (err) {
        status.className = 'status error';
        status.textContent = 'Upload failed: ' + err.message;
        uploadBtn.disabled = false;
      }
    });

    function reset() {
      selectedFile = null;
      fileInput.value = '';
      preview.style.display = 'none';
      preview.innerHTML = '';
      uploadBtn.style.display = 'none';
      anotherBtn.style.display = 'none';
      status.style.display = 'none';
      uploadArea.style.display = 'block';
    }
  </script>
</body>
</html>`);
});

// POST /photo-upload/:token/upload - Accept photo upload (token = auth)
router.post('/:token/upload', (req: Request, res: Response, next) => {
  const { token } = req.params;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { orderId: string; userId: string; purpose: string };
    if (decoded.purpose !== 'photo-upload') {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }
    (req as any).photoUpload = decoded;
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Token expired or invalid' });
  }
}, upload.single('photo'), async (req: Request, res: Response) => {
  const { orderId, userId } = (req as any).photoUpload;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ success: false, error: 'No photo provided' });
  }

  const attachment = await prisma.orderAttachment.create({
    data: {
      fileName: file.originalname || file.filename,
      filePath: file.path,
      fileType: 'PHOTO',
      fileSize: file.size,
      orderId,
      uploadedById: userId,
    },
  });

  broadcast(buildRouteBroadcastPayload({ type: 'PHOTO_UPLOADED', payload: { orderId, attachment }, timestamp: new Date() }));
  res.json({ success: true, data: attachment });
});

export default router;
