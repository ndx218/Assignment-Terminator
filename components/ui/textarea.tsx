// components/ui/textarea.tsx

import React, { TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}

export const Textarea = ({ className = '', ...props }: TextareaProps) => (
  <textarea
    className={cn(`border px-2 py-1 rounded ${className}`)}
    {...props}
  />
);
