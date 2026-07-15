import { CSSProperties, ReactNode } from 'react';

/**
 * Plain-HTML replacement for the Puck demo's core `<Button>` component
 * (which relied on CSS modules). Approximates the primary / secondary
 * pill button visually with inline styles.
 */
export type ButtonElProps = {
  children: ReactNode;
  href?: string;
  variant?: 'primary' | 'secondary';
  tabIndex?: number;
};

const base: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box',
  padding: '12px 24px',
  borderRadius: 4,
  fontSize: 16,
  fontWeight: 500,
  lineHeight: 1,
  textDecoration: 'none',
  cursor: 'pointer',
  border: '1px solid transparent',
};

const variants: Record<'primary' | 'secondary', CSSProperties> = {
  primary: {
    background: 'var(--puck-color-azure-05, #1f2933)',
    color: '#ffffff',
    borderColor: 'var(--puck-color-azure-05, #1f2933)',
  },
  secondary: {
    background: 'transparent',
    color: 'var(--puck-color-azure-05, #1f2933)',
    borderColor: 'currentColor',
  },
};

export const ButtonEl = ({
  children,
  href,
  variant = 'primary',
  tabIndex,
}: ButtonElProps) => {
  return (
    <a
      href={href}
      tabIndex={tabIndex}
      style={{ ...base, ...variants[variant] }}
    >
      {children}
    </a>
  );
};
