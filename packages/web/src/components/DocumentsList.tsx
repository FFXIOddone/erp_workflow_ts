import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Upload, FileText, Image, File, Archive, X, 
  Download, Eye, Trash2, MoreVertical, Plus
} from 'lucide-react';
import { api } from '../lib/api';
import { 
  DOCUMENT_CATEGORY_DISPLAY_NAMES, 
  DOCUMENT_CATEGORY_COLORS,
} from '@erp/shared';
import { Spinner } from './Spinner';
import { ConfirmDialog } from './ConfirmDialog';

interface Document {
  id: string;
  name: string;
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  mimeType: string;
  category: string;
  tags: string[];
  description?: string;
  version: number;
  isLatest: boolean;
  uploadedBy: { id: string; displayName: string };
  createdAt: string;
  _count?: { versions: number };
}

interface DocumentsListProps {
  entityType: 'customer' | 'order' | 'quote' | 'vendor' | 'subcontractor';
  entityId: string;
  entityName?: string;
  defaultCategory?: string;
  compact?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileType: string, mimeType: string) {
  if (mimeType.startsWith('image/')) return <Image className="w-4 h-4 text-cyan-500" />;
  if (fileType === '.pdf') return <FileText className="w-4 h-4 text-red-500" />;
  if (['.zip', '.rar', '.7z'].includes(fileType)) return <Archive className="w-4 h-4 text-amber-500" />;
  if (['.doc', '.docx', '.xls', '.xlsx'].includes(fileType)) return <FileText className="w-4 h-4 text-blue-500" />;
  if (['.ai', '.psd', '.eps', '.svg'].includes(fileType)) return <Image className="w-4 h-4 text-purple-500" />;
  return <File className="w-4 h-4 text-gray-500" />;
}

export function DocumentsList({ entityType, entityId, entityName, defaultCategory = 'OTHER', compact = false }: DocumentsListProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [deleteDoc, setDeleteDoc] = useState<Document | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // Fetch documents for this entity
  const { data: documents, isLoading } = useQuery({
    queryKey: ['documents', 'entity', entityType, entityId],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: Document[] }>(`/documents/entity/${entityType}/${entityId}`);
      return res.data.data;
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/documents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', 'entity', entityType, entityId] });
      setDeleteDoc(null);
    },
  });

  // Quick upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('metadata', JSON.stringify({
        name: file.name,
        category: defaultCategory,
        tags: [],
        [`${entityType}Id`]: entityId,
      }));
      await api.post('/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', 'entity', entityType, entityId] });
    },
  });

  const handleQuickUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
    e.target.value = '';
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with quick upload */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">
          Documents {documents && documents.length > 0 && `(${documents.length})`}
        </h3>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleQuickUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            className="inline-flex items-center gap-1 px-2 py-1 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded"
          >
            {uploadMutation.isPending ? (
              <Spinner className="w-4 h-4" />
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Quick Upload
              </>
            )}
          </button>
          <button
            onClick={() => setUploadModalOpen(true)}
            className="inline-flex items-center gap-1 px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <Upload className="w-4 h-4" />
            Upload
          </button>
        </div>
      </div>

      {/* Documents list */}
      {!documents || documents.length === 0 ? (
        <div className="text-center py-6 text-gray-500">
          <File className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No documents yet</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="mt-2 text-sm text-blue-600 hover:underline"
          >
            Upload your first document
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map(doc => (
            <div
              key={doc.id}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border hover:border-gray-300 group"
            >
              {getFileIcon(doc.fileType, doc.mimeType)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 truncate">{doc.name}</span>
                  {doc.version > 1 && (
                    <span className="text-xs text-gray-400">v{doc.version}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{formatFileSize(doc.fileSize)}</span>
                  <span>•</span>
                  <span 
                    className="px-1.5 py-0.5 text-xs font-medium rounded"
                    style={{ 
                      backgroundColor: DOCUMENT_CATEGORY_COLORS[doc.category] + '20', 
                      color: DOCUMENT_CATEGORY_COLORS[doc.category],
                    }}
                  >
                    {DOCUMENT_CATEGORY_DISPLAY_NAMES[doc.category]}
                  </span>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <a
                  href={`/api/v1/documents/${doc.id}/download?inline=true`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 hover:bg-gray-200 rounded"
                  title="View"
                >
                  <Eye className="w-4 h-4 text-gray-500" />
                </a>
                <a
                  href={`/api/v1/documents/${doc.id}/download`}
                  className="p-1 hover:bg-gray-200 rounded"
                  title="Download"
                >
                  <Download className="w-4 h-4 text-gray-500" />
                </a>
                <button
                  onClick={() => setDeleteDoc(doc)}
                  className="p-1 hover:bg-red-100 rounded"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {uploadModalOpen && (
        <UploadDocumentModal
          entityType={entityType}
          entityId={entityId}
          defaultCategory={defaultCategory}
          onClose={() => setUploadModalOpen(false)}
          onSuccess={() => {
            setUploadModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['documents', 'entity', entityType, entityId] });
          }}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteDoc}
        title="Delete Document"
        message={`Are you sure you want to delete "${deleteDoc?.name}"? This cannot be undone.`}
        confirmText="Delete"
        onConfirm={() => deleteDoc && deleteMutation.mutate(deleteDoc.id)}
        onClose={() => setDeleteDoc(null)}
        variant="danger"
      />
    </div>
  );
}

// Upload Modal for entity context
function UploadDocumentModal({ 
  entityType, 
  entityId, 
  defaultCategory,
  onClose, 
  onSuccess 
}: { 
  entityType: string; 
  entityId: string; 
  defaultCategory: string;
  onClose: () => void; 
  onSuccess: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>(defaultCategory);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('metadata', JSON.stringify({
        name: name || file.name,
        category,
        tags,
        description: description || undefined,
        [`${entityType}Id`]: entityId,
      }));

      await api.post('/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      onSuccess();
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Upload Document</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* File Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">File</label>
            <input
              ref={fileInputRef}
              type="file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setFile(f);
                  if (!name) setName(f.name);
                }
              }}
              className="hidden"
            />
            {file ? (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                {getFileIcon(`.${file.name.split('.').pop()}`, file.type)}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{file.name}</div>
                  <div className="text-sm text-gray-500">{formatFileSize(file.size)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full p-6 border-2 border-dashed rounded-lg text-center hover:border-blue-400 hover:bg-blue-50 transition-colors"
              >
                <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                <span className="text-gray-600 text-sm">Click to select a file</span>
              </button>
            )}
          </div>

          {/* Document Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Document Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter a name for this document"
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              {Object.entries(DOCUMENT_CATEGORY_DISPLAY_NAMES).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="Add a tag..."
                className="flex-1 border rounded-md px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={addTag}
                className="px-3 py-2 bg-gray-100 rounded-md hover:bg-gray-200 text-sm"
              >
                Add
              </button>
            </div>
            {tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {tags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                    {tag}
                    <button type="button" onClick={() => setTags(tags.filter(t => t !== tag))}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description..."
              rows={2}
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-md hover:bg-gray-50 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!file || uploading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
