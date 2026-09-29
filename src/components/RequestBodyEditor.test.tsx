import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RequestBodyEditor from './RequestBodyEditor';
import type { JsonSchema } from '../utils/schema-validate';

describe('RequestBodyEditor', () => {
  const mockSchema: JsonSchema = {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string' },
    },
  };

  it('does not flag an empty body as invalid', () => {
    render(
      <RequestBodyEditor
        value=""
        onChange={() => {}}
        schema={mockSchema}
      />
    );

    const textarea = screen.getByRole('textbox', { name: /Request Body \(JSON\)/i });
    expect(textarea).not.toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText(/JSON syntax error:/)).not.toBeInTheDocument();
  });

  it('shows a syntax error and aria-invalid=true for malformed JSON', () => {
    render(
      <RequestBodyEditor
        value="{ malformed }"
        onChange={() => {}}
        schema={mockSchema}
      />
    );

    const textarea = screen.getByRole('textbox', { name: /Request Body \(JSON\)/i });
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/JSON syntax error:/)).toBeInTheDocument();
  });

  it('lists each failing path for schema violations', () => {
    render(
      <RequestBodyEditor
        value='{ "age": 25 }'
        onChange={() => {}}
        schema={mockSchema}
      />
    );

    const textarea = screen.getByRole('textbox', { name: /Request Body \(JSON\)/i });
    expect(textarea).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('$: missing required property "name"')).toBeInTheDocument();
  });

  it('clears errors and aria-invalid for valid JSON', () => {
    const { rerender } = render(
      <RequestBodyEditor
        value='{ "age": 25 }'
        onChange={() => {}}
        schema={mockSchema}
      />
    );

    let textarea = screen.getByRole('textbox', { name: /Request Body \(JSON\)/i });
    expect(textarea).toHaveAttribute('aria-invalid', 'true');

    rerender(
      <RequestBodyEditor
        value='{ "name": "John" }'
        onChange={() => {}}
        schema={mockSchema}
      />
    );

    textarea = screen.getByRole('textbox', { name: /Request Body \(JSON\)/i });
    expect(textarea).not.toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/Valid JSON/)).toBeInTheDocument();
  });

  it('references the status region by aria-describedby', () => {
    render(
      <RequestBodyEditor
        value=""
        onChange={() => {}}
        schema={mockSchema}
      />
    );

    const textarea = screen.getByRole('textbox', { name: /Request Body \(JSON\)/i });
    const describedBy = textarea.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();

    // The element referenced by aria-describedby should exist and have role="status"
    const statusRegion = document.getElementById(describedBy!);
    expect(statusRegion).toBeInTheDocument();
    expect(statusRegion).toHaveAttribute('role', 'status');
  });
});
