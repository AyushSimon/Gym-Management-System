import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { AppProviders } from "@/components/AppProviders";

export function renderPage(ui: ReactElement, route = "/") {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </AppProviders>,
  );
}

/** Pretend the viewport is wide (tables) or narrow (card lists). */
export function setViewport(wide: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: query.includes("min-width") ? wide : false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
