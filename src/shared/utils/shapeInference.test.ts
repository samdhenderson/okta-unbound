/**
 * Tests for shapeInference — the API Explorer's values-free "Shape" view. Pins
 * primitive/array/object inference, the optional-field-on-uneven-array-items
 * merge behavior (the main source of real bugs here), and that no actual value
 * ever appears in the rendered outline.
 */
import { describe, it, expect } from 'vitest';
import { inferShape, formatShape, shapeOutline } from './shapeInference';

describe('inferShape + formatShape', () => {
  it('infers primitive types', () => {
    expect(formatShape(inferShape('hi'))).toBe('string');
    expect(formatShape(inferShape(42))).toBe('number');
    expect(formatShape(inferShape(true))).toBe('boolean');
    expect(formatShape(inferShape(null))).toBe('null');
  });

  it('infers an object shape with sorted fields', () => {
    const outline = formatShape(inferShape({ id: '00u123', active: true }));
    expect(outline).toBe('{\n  active: boolean;\n  id: string;\n}');
  });

  it('infers a homogeneous array element type', () => {
    expect(formatShape(inferShape(['a', 'b', 'c']))).toBe('Array<string>');
  });

  it('renders an empty array as unknown element type', () => {
    expect(formatShape(inferShape([]))).toBe('Array<unknown>');
  });

  it('marks a field optional when only some array items carry it', () => {
    const outline = shapeOutline([{ id: '1', email: 'a@b.com' }, { id: '2' }]);
    expect(outline).toBe('Array<{\n  email?: string;\n  id: string;\n}>');
  });

  it('does not mark a field optional when every item carries it', () => {
    const outline = shapeOutline([{ id: '1' }, { id: '2' }]);
    expect(outline).toBe('Array<{\n  id: string;\n}>');
  });

  it('unions mismatched primitive types across array items', () => {
    const outline = shapeOutline(['a', 1]);
    expect(outline).toBe('Array<string | number>');
  });

  it('nests object shapes inside arrays and objects', () => {
    const outline = shapeOutline({ users: [{ profile: { email: 'a@b.com' } }] });
    expect(outline).toBe(
      '{\n  users: Array<{\n    profile: {\n      email: string;\n    };\n  }>;\n}',
    );
  });

  it('never includes an actual value in the outline', () => {
    const outline = shapeOutline({
      email: 'jane.doe@acme.com',
      id: '00u1a2b3c4d5e6f7g8h9',
      count: 42,
    });
    expect(outline).not.toContain('jane.doe');
    expect(outline).not.toContain('00u1a2b3c4d5e6f7g8h9');
    expect(outline).not.toContain('42');
  });
});
