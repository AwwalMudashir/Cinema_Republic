import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

const Notification = ({ 
  type = 'success', 
  message, 
  isVisible, 
  onClose, 
  duration = 5000 
}) => {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        handleClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration]);

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(() => {
      onClose();
    }, 300); // Match animation duration
  };

  if (!isVisible) return null;

  const isSuccess = type === 'success';
  const iconColor = isSuccess ? '#F4A261' : '#EF4444';
  const bgColor = isSuccess ? 'bg-[#F1FAEE]' : 'bg-red-50';
  const borderColor = isSuccess ? 'border-[#F4A261]' : 'border-red-200';
  const textColor = isSuccess ? 'text-[#0D1B2A]' : 'text-red-800';

  return (
    <div
      className={`fixed top-4 right-4 z-50 max-w-sm w-full transform transition-all duration-300 ease-in-out ${
        isAnimating ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      <div
        className={`${bgColor} ${borderColor} border-l-4 rounded-lg shadow-lg p-4 relative overflow-hidden`}
        style={{
          background: isSuccess 
            ? 'linear-gradient(135deg, rgba(244, 162, 97, 0.15) 0%, rgba(244, 162, 97, 0.05) 100%)'
            : 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%)',
          backdropFilter: 'blur(10px)',
          boxShadow: isSuccess 
            ? '0 10px 25px rgba(244, 162, 97, 0.3), 0 0 20px rgba(244, 162, 97, 0.2)'
            : '0 10px 25px rgba(239, 68, 68, 0.2), 0 0 20px rgba(239, 68, 68, 0.1)'
        }}
      >
        {/* Animated background glow */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background: isSuccess 
              ? 'radial-gradient(circle at center, rgba(244, 162, 97, 0.4) 0%, transparent 70%)'
              : 'radial-gradient(circle at center, rgba(239, 68, 68, 0.3) 0%, transparent 70%)'
          }}
        />
        
        <div className="relative flex items-start space-x-3">
          {/* Icon */}
          <div className="flex-shrink-0">
            {isSuccess ? (
              <CheckCircle 
                size={24} 
                className="text-[#F4A261]"
                style={{ 
                  filter: 'drop-shadow(0 0 8px rgba(244, 162, 97, 0.8))',
                  animation: 'pulse 2s infinite'
                }}
              />
            ) : (
              <XCircle 
                size={24} 
                className="text-red-500"
                style={{ 
                  filter: 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.6))',
                  animation: 'pulse 2s infinite'
                }}
              />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${textColor}`}>
              {isSuccess ? 'Success!' : 'Error!'}
            </p>
            <p className={`text-sm ${textColor} mt-1`}>
              {message}
            </p>
          </div>

          {/* Close button */}
          <button
            onClick={handleClose}
            className="flex-shrink-0 ml-4 p-1 rounded-full hover:bg-black/10 transition-colors"
            aria-label="Close notification"
          >
            <X size={16} className={textColor} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 h-1 bg-black/10 w-full overflow-hidden rounded-b-lg">
          <div
            className={`h-full transition-all ease-linear ${
              isSuccess ? 'bg-[#F4A261]' : 'bg-red-500'
            }`}
            style={{
              animation: `shrink ${duration}ms linear forwards`,
              boxShadow: isSuccess 
                ? '0 0 10px rgba(244, 162, 97, 0.8)'
                : '0 0 10px rgba(239, 68, 68, 0.8)'
            }}
          />
        </div>
      </div>

      <style jsx>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
};

export default Notification;
