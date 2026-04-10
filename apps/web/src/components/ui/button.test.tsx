import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { Button } from './button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Savatchaga</Button>);
    expect(screen.getByRole('button', { name: /savatchaga/i })).toBeInTheDocument();
  });
});
