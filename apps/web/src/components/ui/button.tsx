import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@psr/ui';

const buttonVariants = cva(
  'relative inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all duration-150 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 min-h-[44px] px-4 active:translate-y-px',
  {
    variants: {
      variant: {
        primary:
          'bg-accent text-accent-ink shadow-[0_1px_0_0_rgb(255_255_255/0.25)_inset,0_6px_16px_-8px_rgb(56_226_197/0.6)] hover:bg-accent-strong',
        // Holographic CTA for premium moments (used sparingly).
        holo: 'bg-prism text-accent-ink font-semibold shadow-[0_8px_24px_-10px_rgb(214_122_255/0.6)] hover:brightness-110',
        secondary:
          'border border-border bg-surface-elevated text-content hover:bg-surface-hover hover:border-border-strong',
        outline:
          'border border-border-strong bg-transparent text-content hover:bg-surface-elevated',
        ghost: 'bg-transparent text-muted hover:bg-surface-elevated hover:text-content',
        gold: 'bg-gold text-accent-ink hover:brightness-105',
        danger: 'bg-negative/90 text-white hover:bg-negative',
      },
      size: {
        sm: 'min-h-[36px] px-3 text-xs',
        md: '',
        lg: 'min-h-[50px] px-6 text-[0.95rem]',
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
