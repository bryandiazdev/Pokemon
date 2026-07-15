import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@psr/ui';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 min-h-[44px] px-4',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-bg hover:bg-accent-strong',
        secondary: 'bg-surface-elevated text-content hover:bg-border',
        outline: 'border border-border bg-transparent text-content hover:bg-surface-elevated',
        ghost: 'bg-transparent text-content hover:bg-surface-elevated',
        gold: 'bg-gold text-bg hover:opacity-90',
        danger: 'bg-negative text-white hover:opacity-90',
      },
      size: {
        sm: 'min-h-[36px] px-3 text-xs',
        md: '',
        lg: 'min-h-[48px] px-6 text-base',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = 'Button';

export { buttonVariants };
