import { render, screen } from '@testing-library/react';
import App from './App';

test('renders learn react link', () => {
  render(<App />);
  const linkElement = screen.getByText(/create professional quotes in minutes, not hours/i);
  expect(linkElement).toBeInTheDocument();
});
