import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  FileImage,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ZoomIn,
  Download,
} from 'lucide-react';
import { proofsApi } from '@/lib/api';
import { formatDate, formatDateTime, cn } from '@/lib/utils';
import { PROOF_STATUS_DISPLAY_NAMES, PROOF_STATUS_COLORS } from '@erp/shared';

export function ProofDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [comments, setComments] = useState('');
  const [imageFullscreen, setImageFullscreen] = useState(false);

  const { data: proof, isLoading } = useQuery({
    queryKey: ['proof', id],
    queryFn: () => proofsApi.get(id!).then((r) => r.data.data),
    enabled: !!id,
  });

  const respondMutation = useMutation({
    mutationFn: (data: { status: string; comments?: string }) =>
      proofsApi.respond(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proofs'] });
      queryClient.invalidateQueries({ queryKey: ['proof', id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      navigate('/proofs');
    },
  });

  const handleApprove = () => {
    respondMutation.mutate({ status: 'APPROVED', comments: comments || undefined });
  };

  const handleRequestChanges = () => {
    if (!comments.trim()) {
      alert('Please provide details about the changes needed.');
      return;
    }
    respondMutation.mutate({ status: 'CHANGES_REQUESTED', comments });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading proof...</div>
      </div>
    );
  }

  if (!proof) {
    return (
      <div className="text-center py-12">
        <FileImage className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900">Proof not found</h2>
        <Link to="/proofs" className="btn btn-primary mt-4">
          Back to Proofs
        </Link>
      </div>
    );
  }

  const isPending = proof.status === 'PENDING';
  const imageUrl = proof.attachment?.filePath
    ? `/api/v1/uploads/${proof.attachment.filePath}`
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            to="/proofs"
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Proofs
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            Proof Review
            <span
              className={cn(
                'badge text-sm',
                PROOF_STATUS_COLORS[proof.status as keyof typeof PROOF_STATUS_COLORS]
              )}
            >
              {PROOF_STATUS_DISPLAY_NAMES[proof.status as keyof typeof PROOF_STATUS_DISPLAY_NAMES]}
            </span>
          </h1>
          <p className="mt-1 text-gray-500">
            Order #{proof.order?.orderNumber} • {proof.order?.description}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Proof Image */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 card"
        >
          <div className="card-header flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {proof.attachment?.fileName || 'Design Proof'}
            </h2>
            <div className="flex items-center gap-2">
              {imageUrl && (
                <>
                  <button
                    onClick={() => setImageFullscreen(true)}
                    className="btn btn-ghost p-2"
                    title="View fullscreen"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <a
                    href={imageUrl}
                    download
                    className="btn btn-ghost p-2"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </>
              )}
            </div>
          </div>
          <div className="card-body p-0">
            {imageUrl ? (
              <div
                className="relative bg-gray-100 cursor-zoom-in"
                onClick={() => setImageFullscreen(true)}
              >
                <img
                  src={imageUrl}
                  alt="Proof"
                  className="w-full h-auto max-h-[600px] object-contain"
                />
              </div>
            ) : (
              <div className="p-12 text-center">
                <FileImage className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No preview available</p>
              </div>
            )}
          </div>

          {/* Approval Actions */}
          {isPending && (
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <h3 className="font-semibold text-gray-900 mb-4">Your Response</h3>

              <div className="mb-4">
                <label className="label">
                  Comments <span className="text-gray-400">(required for changes)</span>
                </label>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className="input min-h-[100px]"
                  placeholder="Add any notes or describe changes needed..."
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleApprove}
                  disabled={respondMutation.isPending}
                  className="btn btn-success flex-1"
                >
                  {respondMutation.isPending ? (
                    <Loader2 className="w-4 h-4 spinner" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Approve & Start Production
                </button>
                <button
                  onClick={handleRequestChanges}
                  disabled={respondMutation.isPending || !comments.trim()}
                  className="btn btn-danger flex-1"
                >
                  {respondMutation.isPending ? (
                    <Loader2 className="w-4 h-4 spinner" />
                  ) : (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                  Request Changes
                </button>
              </div>

              <p className="text-xs text-gray-500 mt-4 text-center">
                ⚠️ Once approved, production will begin immediately and changes cannot be made.
              </p>
            </div>
          )}

          {/* Already Responded */}
          {!isPending && (
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex items-start gap-3">
                {proof.status === 'APPROVED' ? (
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-amber-600" />
                )}
                <div>
                  <p className="font-semibold text-gray-900">
                    {proof.status === 'APPROVED'
                      ? 'Proof Approved'
                      : 'Changes Requested'}
                  </p>
                  {proof.comments && (
                    <p className="text-sm text-gray-600 mt-1">{proof.comments}</p>
                  )}
                  {proof.respondedBy && (
                    <p className="text-xs text-gray-500 mt-2">
                      Responded by {proof.respondedBy.firstName} {proof.respondedBy.lastName} on{' '}
                      {formatDateTime(proof.respondedAt)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Proof Details */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card"
          >
            <div className="card-header">
              <h2 className="text-lg font-semibold text-gray-900">Details</h2>
            </div>
            <div className="card-body space-y-4">
              <div>
                <p className="text-xs text-gray-500">Revision</p>
                <p className="font-medium text-gray-900">
                  Version {proof.revision || 1}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Sent</p>
                <p className="font-medium text-gray-900">
                  {formatDateTime(proof.requestedAt)}
                </p>
              </div>
              {proof.dueDate && (
                <div>
                  <p className="text-xs text-gray-500">Due By</p>
                  <p className="font-medium text-amber-600">
                    {formatDate(proof.dueDate)}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500">Order</p>
                <Link
                  to={`/orders/${proof.order?.id}`}
                  className="text-primary-600 hover:text-primary-700 font-medium"
                >
                  #{proof.order?.orderNumber}
                </Link>
              </div>
            </div>
          </motion.div>

          {/* Tips */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card bg-blue-50 border-blue-200"
          >
            <div className="card-body">
              <h3 className="font-semibold text-blue-900 mb-2">Review Tips</h3>
              <ul className="space-y-2 text-sm text-blue-800">
                <li>• Check all text for spelling and accuracy</li>
                <li>• Verify colors match your brand guidelines</li>
                <li>• Confirm sizing and dimensions are correct</li>
                <li>• Review layout and positioning</li>
                <li>• Check images for quality and clarity</li>
              </ul>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Fullscreen Modal */}
      {imageFullscreen && imageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setImageFullscreen(false)}
        >
          <button
            onClick={() => setImageFullscreen(false)}
            className="absolute top-4 right-4 text-white hover:text-gray-300"
          >
            <XCircle className="w-8 h-8" />
          </button>
          <img
            src={imageUrl}
            alt="Proof fullscreen"
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}
    </div>
  );
}
