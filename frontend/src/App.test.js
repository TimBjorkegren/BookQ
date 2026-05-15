import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders the BookQ upload flow", () => {
  render(<App />);
  expect(screen.getByText(/BookQ/i)).toBeInTheDocument();
  expect(screen.getByText(/Välj dokument/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Generera frågor/i })).toBeDisabled();
});
