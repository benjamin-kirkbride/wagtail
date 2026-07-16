import {
  Feather,
  Heart,
  Star,
  Zap,
  Cloud,
  Shield,
  Rocket,
  Globe,
  Bell,
  Bookmark,
  Camera,
  Check,
  Compass,
  Gift,
  Home,
  Lock,
  Mail,
  Map,
  Smile,
  Sun,
  ThumbsUp,
  Trophy,
  Umbrella,
  Wrench,
} from 'lucide-react';
import type { ComponentConfig } from '@puckeditor/core';
import { WithLayout, withLayout } from '../components/Layout';

/** Curated subset of lucide-react icons (the demo pulled the entire set,
 * which would bloat the bundle). `Feather` matches the demo default. */
const iconComponents = {
  Feather,
  Heart,
  Star,
  Zap,
  Cloud,
  Shield,
  Rocket,
  Globe,
  Bell,
  Bookmark,
  Camera,
  Check,
  Compass,
  Gift,
  Home,
  Lock,
  Mail,
  Map,
  Smile,
  Sun,
  ThumbsUp,
  Trophy,
  Umbrella,
  Wrench,
} as const;

const iconOptions = Object.keys(iconComponents).map((iconName) => ({
  label: iconName,
  value: iconName,
}));

export type CardProps = WithLayout<{
  title: string;
  description: string;
  icon?: string;
  mode: 'flat' | 'card';
}>;

const CardInner: ComponentConfig<CardProps> = {
  fields: {
    title: {
      type: 'text',
    },
    description: {
      // No contentEditable — overlay portals break in the takeover frame, see
      // Hero.tsx.
      type: 'textarea',
    },
    icon: {
      type: 'select',
      options: iconOptions,
    },
    mode: {
      type: 'radio',
      options: [
        { label: 'card', value: 'card' },
        { label: 'flat', value: 'flat' },
      ],
    },
  },
  defaultProps: {
    title: 'Title',
    description: 'Description',
    icon: 'Feather',
    mode: 'flat',
  },
  render: ({ title, icon, description, mode }) => {
    const Icon = icon
      ? (iconComponents as Record<string, typeof Feather>)[icon]
      : undefined;
    return (
      <div
        style={{
          padding: mode === 'card' ? 24 : 0,
          border:
            mode === 'card'
              ? '1px solid var(--puck-color-grey-09, #e5e7eb)'
              : undefined,
          borderRadius: mode === 'card' ? 8 : undefined,
          background: mode === 'card' ? 'var(--puck-color-white, #fff)' : undefined,
          height: '100%',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ color: 'var(--puck-color-azure-05, #1f2933)' }}>
            {Icon ? <Icon /> : null}
          </div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>{title}</div>
          <div style={{ color: 'var(--puck-color-grey-05, #6b7280)' }}>
            {description}
          </div>
        </div>
      </div>
    );
  },
};

export const Card = withLayout(CardInner);

export default Card;
