// @vitest-environment jsdom
import { it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { Form } from "@/ui/form";
it("labels fields, blocks missing input and exposes server feedback", async () => {
  const submit = vi
    .fn()
    .mockRejectedValue(new Error("El servicio ya no está disponible."));
  render(
    <Form fields={[{ name: "title", label: "Título" }]} onSubmit={submit} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  expect(await screen.findByText("Completa este campo.")).toBeInTheDocument();
  expect(submit).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText(/Título/), {
    target: { value: "Servicio de pruebas" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() =>
    expect(
      screen.getByText("El servicio ya no está disponible."),
    ).toBeInTheDocument(),
  );
});
