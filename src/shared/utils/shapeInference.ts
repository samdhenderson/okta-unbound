/**
 * @module shared/utils/shapeInference
 * @description Infer a type-only structural outline from an arbitrary JSON value.
 *
 * Built for the API Explorer's "Shape" view: walks a parsed response and renders
 * its structure — field names and primitive/array/object types — with **no actual
 * values**. Because it never touches a value, this view is immune to any gap in
 * `redact.ts`'s pattern-based redaction, which is why the Explorer opens on this
 * view by default rather than the redacted-values one.
 *
 * Array items are merged into one representative shape: a field present in only
 * some items is marked optional, and items whose shapes disagree collapse to a
 * union — this mirrors how Okta list responses actually vary (e.g. `secondEmail`
 * present on some users, absent on others).
 */

/** A structural type node — never carries a value, only shape. */
export type ShapeType =
  | { kind: 'string' }
  | { kind: 'number' }
  | { kind: 'boolean' }
  | { kind: 'null' }
  | { kind: 'unknown' }
  | { kind: 'array'; element: ShapeType }
  | { kind: 'object'; fields: ShapeField[] }
  | { kind: 'union'; options: ShapeType[] };

/** One field of an inferred object shape. */
export interface ShapeField {
  key: string;
  type: ShapeType;
  /** Set when the field was absent from at least one merged array item. */
  optional: boolean;
}

/** Infer the structural shape of a single JSON value. */
export function inferShape(value: unknown): ShapeType {
  if (value === null) return { kind: 'null' };
  if (typeof value === 'string') return { kind: 'string' };
  if (typeof value === 'number') return { kind: 'number' };
  if (typeof value === 'boolean') return { kind: 'boolean' };

  if (Array.isArray(value)) {
    if (value.length === 0) return { kind: 'array', element: { kind: 'unknown' } };
    return { kind: 'array', element: mergeShapes(value.map(inferShape)) };
  }

  if (typeof value === 'object') {
    const fields = Object.entries(value as Record<string, unknown>).map(([key, item]) => ({
      key,
      type: inferShape(item),
      optional: false,
    }));
    return { kind: 'object', fields };
  }

  return { kind: 'unknown' };
}

/** Stable string signature used to dedupe structurally-identical shapes. */
function shapeSignature(shape: ShapeType): string {
  switch (shape.kind) {
    case 'string':
    case 'number':
    case 'boolean':
    case 'null':
    case 'unknown':
      return shape.kind;
    case 'array':
      return `array<${shapeSignature(shape.element)}>`;
    case 'object':
      return `object<${shape.fields
        .map((f) => f.key)
        .sort()
        .join(',')}>`;
    case 'union':
      return `union<${shape.options.map(shapeSignature).sort().join('|')}>`;
  }
}

/** Merge multiple object shapes: union their fields, marking uneven ones optional. */
function mergeObjectShapes(
  shapes: ReadonlyArray<Extract<ShapeType, { kind: 'object' }>>,
): ShapeType {
  const shapesByKey = new Map<string, ShapeType[]>();
  const presenceByKey = new Map<string, number>();

  for (const shape of shapes) {
    for (const field of shape.fields) {
      shapesByKey.set(field.key, [...(shapesByKey.get(field.key) ?? []), field.type]);
      presenceByKey.set(field.key, (presenceByKey.get(field.key) ?? 0) + 1);
    }
  }

  const fields: ShapeField[] = Array.from(shapesByKey.entries()).map(([key, types]) => ({
    key,
    type: mergeShapes(types),
    optional: (presenceByKey.get(key) ?? 0) < shapes.length,
  }));

  return { kind: 'object', fields };
}

/**
 * Collapse several shapes (e.g. one per array item) into one representative
 * shape. All-object inputs merge field-by-field; anything else dedupes by
 * structural signature and, if more than one distinct shape remains, becomes a
 * union.
 */
export function mergeShapes(shapes: ShapeType[]): ShapeType {
  if (shapes.length === 0) return { kind: 'unknown' };
  if (shapes.length === 1) return shapes[0];

  if (shapes.every((s): s is Extract<ShapeType, { kind: 'object' }> => s.kind === 'object')) {
    return mergeObjectShapes(shapes);
  }

  const seen = new Map<string, ShapeType>();
  for (const shape of shapes) {
    const signature = shapeSignature(shape);
    if (!seen.has(signature)) seen.set(signature, shape);
  }
  const deduped = Array.from(seen.values());
  return deduped.length === 1 ? deduped[0] : { kind: 'union', options: deduped };
}

/**
 * Render a {@link ShapeType} as a readable, TypeScript-like type outline —
 * field names and structure only, no values.
 *
 * @example
 * ```ts
 * formatShape(inferShape({ id: '00u123', active: true }));
 * // "{\n  active: boolean;\n  id: string;\n}"
 * ```
 */
export function formatShape(shape: ShapeType, indent = 0): string {
  const pad = '  '.repeat(indent);
  switch (shape.kind) {
    case 'string':
    case 'number':
    case 'boolean':
    case 'null':
    case 'unknown':
      return shape.kind;
    case 'union':
      return shape.options.map((option) => formatShape(option, indent)).join(' | ');
    case 'array':
      return `Array<${formatShape(shape.element, indent)}>`;
    case 'object': {
      if (shape.fields.length === 0) return '{}';
      const lines = [...shape.fields]
        .sort((a, b) => a.key.localeCompare(b.key))
        .map(
          (field) =>
            `${pad}  ${field.key}${field.optional ? '?' : ''}: ${formatShape(field.type, indent + 1)};`,
        );
      return `{\n${lines.join('\n')}\n${pad}}`;
    }
  }
}

/** Infer and render a value's shape outline in one call — the API Explorer's Shape view. */
export function shapeOutline(value: unknown): string {
  return formatShape(inferShape(value));
}
