import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary-600 text-white p-12 flex-col justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <span className="text-2xl font-bold">W</span>
            </div>
            <span className="text-2xl font-semibold">Wilde Signs</span>
          </div>
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl font-bold mb-6">
            Welcome to Your<br />Customer Portal
          </h1>
          <p className="text-primary-100 text-lg leading-relaxed">
            Track your orders in real-time, review and approve proofs, 
            and communicate directly with our production team - 
            all in one convenient place.
          </p>
          
          <div className="mt-12 grid grid-cols-2 gap-6">
            <div className="bg-white/10 rounded-xl p-4">
              <div className="text-3xl font-bold">24/7</div>
              <div className="text-primary-200 text-sm">Order Access</div>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <div className="text-3xl font-bold">Live</div>
              <div className="text-primary-200 text-sm">Status Updates</div>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <div className="text-3xl font-bold">Fast</div>
              <div className="text-primary-200 text-sm">Proof Approvals</div>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <div className="text-3xl font-bold">Direct</div>
              <div className="text-primary-200 text-sm">Communication</div>
            </div>
          </div>
        </motion.div>
        
        <div className="text-primary-300 text-sm">
          © {new Date().getFullYear()} Wilde Signs. All rights reserved.
        </div>
      </div>

      {/* Right side - Auth form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
                <span className="text-xl font-bold text-white">W</span>
              </div>
              <span className="text-xl font-semibold text-gray-900">Wilde Signs</span>
            </div>
          </div>
          
          <Outlet />
        </motion.div>
      </div>
    </div>
  );
}
