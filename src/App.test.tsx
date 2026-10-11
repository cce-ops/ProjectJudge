import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App Smoke Test', () => {
  it('renders the title and API key warning', () => {
    render(<App />);
    expect(screen.getAllByText(/ProyectJudge/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Falta la API key de Gemini/i)).toBeInTheDocument();
  });
});
