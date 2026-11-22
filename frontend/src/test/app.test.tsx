import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import App from "@/App";
import { AppProviders } from "@/components/AppProviders";
import DashboardPage from "@/pages/DashboardPage";
import SettingsPage from "@/pages/SettingsPage";
import { installFakeServer, makeMember, makePayment, makePlan } from "@/test/fakeServer";
import { renderPage, setViewport } from "@/test/utils";

const seed = () => ({
  plans: [makePlan(), makePlan({ id: "PLN-002", name: "Quarterly", duration_days: 90, price: 4000 })],
  members: [
    makeMember({ expiring_soon: true, days_remaining: 3 }),
    makeMember({ id: "M-0002", full_name: "Priya Das", phone: "9876500012", plan_id: "PLN-002", plan_name: "Quarterly" }),
    makeMember({ id: "M-0003", full_name: "Rohan Gupta", phone: "9876500013", status: "expired", days_remaining: -5 }),
  ],
  payments: [makePayment({ status: "pending", amount: 2500 }), makePayment({ id: "PAY-0002", amount: 1500 })],
});

describe("Dashboard", () => {
  beforeEach(() => setViewport(true));

  it("shows KPI figures calculated from backend data", async () => {
    installFakeServer(seed());
    renderPage(<DashboardPage />);

    const total = await screen.findByRole("link", { name: /total members/i });
    expect(total).toHaveTextContent("3");
    expect(screen.getByRole("link", { name: /active members/i })).toHaveTextContent("2");
    expect(screen.getByRole("link", { name: /expired members/i })).toHaveTextContent("1");
    const pending = screen.getByRole("link", { name: /pending payments/i });
    expect(pending).toHaveTextContent("1");
    expect(pending).toHaveTextContent("₹2,500 outstanding");
  });

  it("lists recent registrations, recent payments and upcoming expirations", async () => {
    installFakeServer(seed());
    renderPage(<DashboardPage />);

    const recent = await screen.findByRole("heading", { name: "Recent registrations" });
    const recentCard = recent.closest("div")!.parentElement!.parentElement!;
    expect(await within(recentCard).findByText("Rohan Gupta")).toBeInTheDocument();

    const payments = screen.getByRole("heading", { name: "Recent payments" }).closest("div")!.parentElement!.parentElement!;
    expect(await within(payments).findByText(/₹1,500/)).toBeInTheDocument();

    const expiring = screen.getByRole("heading", { name: "Upcoming expirations" }).closest("div")!.parentElement!.parentElement!;
    expect(await within(expiring).findByText("3 days left")).toBeInTheDocument();
  });

  it("offers the four quick actions", async () => {
    installFakeServer(seed());
    renderPage(<DashboardPage />);
    const actions = await screen.findByRole("region", { name: /quick actions/i });
    for (const name of ["Add Member", "Record Payment", "Manage Members", "Manage Plans"]) {
      expect(within(actions).getByRole("link", { name: new RegExp(name, "i") })).toBeInTheDocument();
    }
  });

  it("handles a brand-new gym with no data", async () => {
    installFakeServer({});
    renderPage(<DashboardPage />);
    expect(await screen.findByText("No growth data yet")).toBeInTheDocument();
    expect(screen.getByText("Nothing to chart yet")).toBeInTheDocument();
    expect(screen.getByText("No members yet")).toBeInTheDocument();
    expect(screen.getByText("No payments recorded")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /total members/i })).toHaveTextContent("0");
  });

  it("shows an error with retry when the API is down", async () => {
    const user = userEvent.setup();
    const server = installFakeServer(seed());
    server.fail("get", "/dashboard/stats", { network: true });
    renderPage(<DashboardPage />);

    expect(await screen.findByText(/can't reach the server/i)).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: /try again/i })[0]);
    expect(await screen.findByRole("link", { name: /total members/i })).toHaveTextContent("3");
  });
});

describe("App shell", () => {
  beforeEach(() => setViewport(true));

  const renderApp = (route = "/") =>
    render(
      <AppProviders>
        <MemoryRouter initialEntries={[route]}>
          <App />
        </MemoryRouter>
      </AppProviders>,
    );

  it("has the five sidebar destinations and navigates between pages", async () => {
    const user = userEvent.setup();
    installFakeServer(seed());
    renderApp("/");

    const nav = screen.getByRole("navigation", { name: "Main" });
    for (const name of ["Dashboard", "Members", "Membership Plans", "Payments", "Settings"]) {
      expect(within(nav).getByRole("link", { name })).toBeInTheDocument();
    }
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();

    await user.click(within(nav).getByRole("link", { name: "Payments" }));
    expect(await screen.findByRole("heading", { name: "Payments", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toHaveTextContent("Payments");
    await waitFor(() => expect(document.title).toBe("Payments · Forma"));
  });

  it("shows a not-found page for unknown routes", async () => {
    installFakeServer({});
    renderApp("/nope");
    expect(await screen.findByText("Page not found")).toBeInTheDocument();
  });

  it("searches members from the header and opens their details", async () => {
    const user = userEvent.setup();
    installFakeServer(seed());
    renderApp("/");
    await user.type(screen.getAllByRole("combobox", { name: "Search members" })[0], "priya");
    await user.click(await screen.findByRole("option", { name: /Priya Das/ }));

    expect(await screen.findByRole("heading", { name: "Members", level: 1 })).toBeInTheDocument();
    const drawer = await screen.findByRole("dialog");
    expect(await within(drawer).findByText("Current plan")).toBeInTheDocument();
  });

  it("switches theme from the top bar", async () => {
    const user = userEvent.setup();
    installFakeServer(seed());
    renderApp("/");
    await user.click(screen.getByRole("button", { name: /switch to light theme/i }));
    expect(document.documentElement.dataset.theme).toBe("light");
    await user.click(screen.getByRole("button", { name: /switch to dark theme/i }));
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("lists items needing attention in the notification menu", async () => {
    const user = userEvent.setup();
    installFakeServer(seed());
    renderApp("/");
    await user.click(await screen.findByRole("button", { name: /notifications, \d+ items need attention/i }));
    expect(await screen.findByText(/1 expired membership/)).toBeInTheDocument();
    expect(screen.getByText(/1 pending payment/)).toBeInTheDocument();
  });
});

describe("Settings", () => {
  beforeEach(() => setViewport(true));

  it("saves gym information and validates input", async () => {
    const user = userEvent.setup();
    installFakeServer(seed());
    renderPage(<SettingsPage />, "/settings");

    const name = screen.getByLabelText(/gym name/i);
    await user.clear(name);
    await user.click(screen.getByLabelText(/email/i));
    await user.type(screen.getByLabelText(/email/i), "not-an-email");
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(await screen.findByText("Enter your gym’s name")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address")).toBeInTheDocument();

    await user.type(name, "Iron House");
    await user.clear(screen.getByLabelText(/email/i));
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(await screen.findByText("Gym information saved")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("forma.settings.v1")!).gymName).toBe("Iron House");
  });

  it("shows real storage details from the backend", async () => {
    installFakeServer(seed());
    renderPage(<SettingsPage />, "/settings");
    expect(await screen.findByText("C:\\data")).toBeInTheDocument();
    expect(screen.getByText(/3 members · 2 plans · 2 payments/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /export all data/i })).toBeInTheDocument();
  });

  it("changes the theme preference", async () => {
    const user = userEvent.setup();
    installFakeServer(seed());
    renderPage(<SettingsPage />, "/settings");
    await user.click(screen.getByRole("radio", { name: "Light" }));
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
