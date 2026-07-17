import { CSSProperties, forwardRef, ReactNode } from 'react';
import type {
  ComponentConfig,
  DefaultComponentProps,
  ObjectField,
} from '@puckeditor/core';
import { spacingOptions } from './options';

/**
 * The `withLayout` HOC ported from the Puck demo.
 *
 * It injects a shared `layout` object field (padding / grid span / flex grow)
 * into a block's fields and wraps the block's render output in a positioning
 * `<div>`. The demo used a CSS module for the wrapper; here it is inline.
 */

type LayoutFieldProps = {
  padding?: string;
  spanCol?: number;
  spanRow?: number;
  grow?: boolean;
};

export type WithLayout<Props extends DefaultComponentProps> = Props & {
  layout?: LayoutFieldProps;
};

type LayoutProps = WithLayout<{
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}>;

export const layoutField: ObjectField<LayoutFieldProps> = {
  type: 'object',
  objectFields: {
    spanCol: {
      label: 'Grid Columns',
      type: 'number',
      min: 1,
      max: 12,
    },
    spanRow: {
      label: 'Grid Rows',
      type: 'number',
      min: 1,
      max: 12,
    },
    grow: {
      label: 'Flex Grow',
      type: 'radio',
      options: [
        { label: 'true', value: true },
        { label: 'false', value: false },
      ],
    },
    padding: {
      type: 'select',
      label: 'Vertical Padding',
      options: [{ label: '0px', value: '0px' }, ...spacingOptions],
    },
  },
};

const Layout = forwardRef<HTMLDivElement, LayoutProps>(
  ({ children, className, layout, style }, ref) => {
    return (
      <div
        className={className}
        style={{
          display: 'block',
          gridColumn: layout?.spanCol
            ? `span ${Math.max(Math.min(layout.spanCol, 12), 1)}`
            : undefined,
          gridRow: layout?.spanRow
            ? `span ${Math.max(Math.min(layout.spanRow, 12), 1)}`
            : undefined,
          paddingTop: layout?.padding,
          paddingBottom: layout?.padding,
          flex: layout?.grow ? '1 1 0' : undefined,
          ...style,
        }}
        ref={ref}
      >
        {children}
      </div>
    );
  },
);

Layout.displayName = 'Layout';

export { Layout };

export function withLayout<
  ThisComponentConfig extends ComponentConfig<any> = ComponentConfig
>(
  componentConfig: ThisComponentConfig,
  className?: string,
): ThisComponentConfig {
  return {
    ...componentConfig,
    fields: {
      ...componentConfig.fields,
      layout: layoutField,
    },
    defaultProps: {
      ...componentConfig.defaultProps,
      // Deliberately DON'T seed `spanCol`/`spanRow` here. The render below emits
      // `grid-column`/`grid-row` only when they are truthy, so seeding them to
      // `1` made every top-level block emit an inert `grid-column: span 1;
      // grid-row: span 1` (a no-op outside a grid container). Left unset, a
      // fresh block emits no grid-area. Existing stored blocks that already
      // carry `spanCol: 1`/`spanRow: 1` still render them (the render logic is
      // unchanged), so previously saved documents stay byte-identical.
      layout: {
        padding: '0px',
        grow: false,
        ...componentConfig.defaultProps?.layout,
      },
    },
    resolveFields: (_: any, params: any) => {
      if (params.parent?.type === 'Grid') {
        return {
          ...componentConfig.fields,
          layout: {
            ...layoutField,
            objectFields: {
              spanCol: layoutField.objectFields.spanCol,
              spanRow: layoutField.objectFields.spanRow,
              padding: layoutField.objectFields.padding,
            },
          },
        };
      }
      if (params.parent?.type === 'Flex') {
        return {
          ...componentConfig.fields,
          layout: {
            ...layoutField,
            objectFields: {
              grow: layoutField.objectFields.grow,
              padding: layoutField.objectFields.padding,
            },
          },
        };
      }

      return {
        ...componentConfig.fields,
        layout: {
          ...layoutField,
          objectFields: {
            padding: layoutField.objectFields.padding,
          },
        },
      };
    },
    inline: true,
    render: (props: any) => (
      <Layout
        layout={props.layout as LayoutFieldProps}
        className={className}
        ref={props.puck.dragRef}
      >
        {componentConfig.render(props)}
      </Layout>
    ),
  };
}
