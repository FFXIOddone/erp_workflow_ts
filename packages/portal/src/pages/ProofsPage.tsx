import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  FileCheck,
  ChevronRight,
  FileImage,
  AlertTriangle,
} from 'lucide-react';
import { proofsApi } from '@/lib/api';
import { formatDate, formatRelativeTime, cn } from '@/lib/utils';
import { PROOF_STATUS_DISPLAY_NAMES, PROOF_STATUS_COLORS } from '@erp/shared';

export function ProofsPage() {
  const { data: proofs, isLoading } = useQuery({
    queryKey: ['proofs'],
    queryFn: () => proofsApi.list().then((r) => r.data.data),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Proof Approvals</h1>
        <p className="mt-1 text-gray-500">
          Review and approve design proofs for your orders
        </p>
      </div>

      {/* Pending Proofs Alert */}
      {proofs && proofs.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-amber-50 border border-amber-200"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <p className="font-medium text-amber-900">
              You have {proofs.length} proof{proofs.length > 1 ? 's' : ''} awaiting approval
            </p>
          </div>
        </motion.div>
      )}

      {/* Proofs List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="card p-12 text-center text-gray-500">
            Loading proofs...
          </div>
        ) : !proofs || proofs.length === 0 ? (
          <div className="card p-12 text-center">
            <FileCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No pending proofs</h3>
            <p className="mt-1 text-gray-500">
              All your proofs have been reviewed. Check back later for new ones.
            </p>
          </div>
        ) : (
          proofs.map((proof: any, index: number) => (
              <motion.div
                key={proof.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link
                  to={`/proofs/${proof.id}`}
                  className="card p-5 hover:shadow-md transition-all block group"
                >
                  <div className="flex items-center gap-4">
                    {/* Preview Thumbnail */}
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                      {proof.attachment?.filePath ? (
                        <img
                          src={`/api/v1/uploads/${proof.attachment.filePath}`}
                          alt="Proof preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FileImage className="w-8 h-8 text-gray-400" />
                      )}
                    </div>

                    {/* Proof Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 group-hover:text-primary-600">
                          {proof.attachment?.fileName || 'Design Proof'}
                        </h3>
                        <span
                          className={cn(
                            'badge',
                            PROOF_STATUS_COLORS[proof.status as keyof typeof PROOF_STATUS_COLORS] ||
                              'bg-gray-100 text-gray-700'
                          )}
                        >
                          {PROOF_STATUS_DISPLAY_NAMES[proof.status as keyof typeof PROOF_STATUS_DISPLAY_NAMES] ||
                            proof.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        Order #{proof.order?.orderNumber} • {proof.order?.description}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span>Revision {proof.revision || 1}</span>
                        <span>Sent {formatRelativeTime(proof.requestedAt)}</span>
                        {proof.dueDate && (
                          <span className="text-amber-600 font-medium">
                            Due {formatDate(proof.dueDate)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Arrow */}
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-primary-600" />
                  </div>
                </Link>
              </motion.div>
          ))
        )}
      </div>

      {/* Instructions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="card p-6 bg-gray-50"
      >
        <h3 className="font-semibold text-gray-900 mb-3">How Proof Approval Works</h3>
        <ol className="space-y-2 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <span className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-medium shrink-0">
              1
            </span>
            <span>
              Review the design proof carefully. Check colors, text, sizing, and layout.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-medium shrink-0">
              2
            </span>
            <span>
              If everything looks correct, click "Approve" to authorize production.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-medium shrink-0">
              3
            </span>
            <span>
              If changes are needed, click "Request Changes" and provide detailed feedback.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-medium shrink-0">
              4
            </span>
            <span>
              Once approved, production will begin immediately. No changes can be made after approval.
            </span>
          </li>
        </ol>
      </motion.div>
    </div>
  );
}
