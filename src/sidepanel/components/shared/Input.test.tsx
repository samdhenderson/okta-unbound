import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import Input from './Input';

describe('Input', () => {
  it('reports typed characters through onChange', async () => {
    const onChange = vi.fn();
    render(<Input value="" onChange={onChange} placeholder="Name" />);
    await userEvent.type(screen.getByPlaceholderText('Name'), 'Ab');
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenNthCalledWith(1, 'A');
    expect(onChange).toHaveBeenNthCalledWith(2, 'b');
  });

  it('forwards key events via onKeyDown', async () => {
    const onKeyDown = vi.fn();
    render(<Input value="" onChange={() => {}} placeholder="Search" onKeyDown={onKeyDown} />);
    const input = screen.getByPlaceholderText('Search');
    input.focus();
    await userEvent.keyboard('{Enter}');
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onKeyDown.mock.calls[0][0].key).toBe('Enter');
  });

  it('focuses on mount when autoFocus is set', () => {
    render(<Input value="" onChange={() => {}} placeholder="Auto" autoFocus />);
    expect(screen.getByPlaceholderText('Auto')).toHaveFocus();
  });

  it('exposes the underlying input through inputRef', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input value="" onChange={() => {}} placeholder="Ref" inputRef={ref} />);
    expect(ref.current).toBe(screen.getByPlaceholderText('Ref'));
  });

  it('renders a label and an error message', () => {
    render(<Input value="" onChange={() => {}} label="Email" error="Required" />);
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('does not emit changes while disabled', async () => {
    const onChange = vi.fn();
    render(<Input value="" onChange={onChange} placeholder="Locked" disabled />);
    const input = screen.getByPlaceholderText('Locked');
    expect(input).toBeDisabled();
    await userEvent.type(input, 'x');
    expect(onChange).not.toHaveBeenCalled();
  });
});
