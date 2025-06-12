'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center px-4">
      <div className="text-center relative">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="font-outfit"
        >
          {/* Pencil drawing animation */}
          <motion.div
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2, ease: "easeInOut" }}
            className="absolute -top-20 left-1/2 transform -translate-x-1/2 w-32 h-32"
          >
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <path
                d="M20,50 Q50,20 80,50 Q50,80 20,50"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-indigo-600"
              />
            </svg>
          </motion.div>

          <h1 className="text-8xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mb-4">
            404
          </h1>
          
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-gray-700 mb-8 text-xl"
          >
            Oops! This drawing seems to have been erased
          </motion.p>
          
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            <Link 
              href="/"
              className="inline-flex items-center px-6 py-3 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium hover:from-indigo-700 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
            >
              <span className="mr-2">🎨</span>
              Back to Drawing Board
            </Link>
          </motion.div>

          {/* Decorative elements */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.1 }}
            transition={{ delay: 1 }}
            className="absolute -z-10 inset-0"
          >
            <div className="absolute top-0 left-0 w-20 h-20 border-4 border-indigo-200 rounded-full transform -translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-0 right-0 w-32 h-32 border-4 border-purple-200 rounded-full transform translate-x-1/2 translate-y-1/2"></div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
} 