import React from 'react';

type BrandLogoVariant = 'splash' | 'login' | 'sidebar' | 'receipt' | 'report' | 'icon';

interface BrandLogoProps {
  variant: BrandLogoVariant;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ variant, className = '' }) => {
  const getStylesForVariant = (): string => {
    switch (variant) {
      case 'splash':
        return 'w-64 h-auto max-w-full drop-shadow-xl';
      case 'login':
        return 'w-32 h-auto max-w-full drop-shadow-md';
      case 'sidebar':
        return 'w-8 h-8 object-contain'; // Compact for sidebar
      case 'receipt':
        return 'w-32 h-auto max-w-[200px] mb-2 mx-auto'; // Optimized for thermal receipts
      case 'report':
        return 'h-16 w-auto max-h-[80px] object-contain';
      case 'icon':
        return 'w-10 h-10 object-contain';
      default:
        return 'w-24 h-auto';
    }
  };

  return (
    <img
      src="/logo.png"
      alt="Gujjar Milk Shop Logo"
      className={`${getStylesForVariant()} ${className}`}
      style={{ aspectRatio: 'auto' }} // Prevents distortion
    />
  );
};
