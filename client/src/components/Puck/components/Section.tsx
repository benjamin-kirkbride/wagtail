import { CSSProperties, forwardRef, ReactNode } from 'react';

/**
 * Presentational content wrapper ported from the Puck demo's `Section`.
 *
 * Adds horizontal gutters and centres the content within a max width. The
 * demo used CSS modules; here everything is inline so the block renders
 * identically in the editor iframe and in the standalone SSR bundle.
 */
export type SectionProps = {
  className?: string;
  children: ReactNode;
  maxWidth?: string;
  style?: CSSProperties;
};

export const Section = forwardRef<HTMLDivElement, SectionProps>(
  ({ children, className, maxWidth = '1280px', style = {} }, ref) => {
    return (
      <div
        className={className}
        style={{
          paddingInlineStart: 24,
          paddingInlineEnd: 24,
          ...style,
        }}
        ref={ref}
      >
        <div
          style={{
            marginInlineStart: 'auto',
            marginInlineEnd: 'auto',
            height: '100%',
            width: '100%',
            maxWidth,
          }}
        >
          {children}
        </div>
      </div>
    );
  },
);

Section.displayName = 'Section';
