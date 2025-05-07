// components/ui/textarea.tsx
import { TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = ({ className, ...props }: TextareaProps) => (
  <textarea
    className={cn('border p-2 rounded w-full min-h-[100px]', className)}
    {...props}
  />
);

export default Textarea;
