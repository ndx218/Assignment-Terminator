// UI input component// components/ui/input.tsx

import React, { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export const Input = ({ className = '', ...props }: InputProps) => (
  <input
    className={cn(`border px-2 py-1 rounded ${className}`)}
    {...props}
  />
);
