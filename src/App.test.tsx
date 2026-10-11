import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App Smoke Test', () => {
  it('renders the title and API key warning', () => {
    render(<App />);
    expect(screen.getByText(/ProyectJudge/i)).toBeInTheDocument();
    expect(screen.getByText(/Falta la API key de Gemini/i)).toBeInTheDocument();
  });
});
