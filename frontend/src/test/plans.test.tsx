import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import PlansPage from "@/pages/PlansPage";
import { installFakeServer, makeMember, makePlan } from "@/test/fakeServer";
import { renderPage, setViewport } from "@/test/utils";

const seed = () => ({
  plans: [makePlan(), makePlan({ id: "PLN-002", name: "Quarterly", duration_days: 90, price: 4000 }), makePlan({ id: "PLN-003", name: "Legacy", is_active: false, price: 900 })],
  members: [makeMember()],
});

describe("Plans page", () => {
  beforeEach(() => setViewport(true));

  it("lists plans with price, duration and member counts", async () => {
    installFakeServer(seed());
    renderPage(<PlansPage />, "/plans");
    expect(await screen.findByRole("heading", { name: "Quarterly" })).toBeInTheDocument();
    expect(screen.getByText("₹4,000")).toBeInTheDocument();
    expect(screen.getByText("for 90 days", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("1 member")).toBeInTheDocument();
    expect(screen.getByText("Most popular")).toBeInTheDocument();
    expect(screen.getByText("3 plans")).toBeInTheDocument();
  });

  it("creates a plan", async () => {
    const user = userEvent.setup();
    const server = installFakeServer(seed());
    renderPage(<PlansPage />, "/plans");
    await screen.findByRole("heading", { name: "Quarterly" });

    await user.click(screen.getByRole("button", { name: /new plan/i }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/plan name/i), "Annual");
    await user.type(within(dialog).getByLabelText(/duration/i), "365");
    await user.type(within(dialog).getByLabelText(/price/i), "12000");
    await user.click(within(dialog).getByRole("button", { name: /create plan/i }));

    expect(await screen.findByText(/Created the Annual plan/)).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Annual" })).toBeInTheDocument();
    expect(server.db.plans.find((p) => p.name === "Annual")).toMatchObject({ duration_days: 365, price: 12000, is_active: true });
  });

  it("rejects invalid plan input in the form", async () => {
    const user = userEvent.setup();
    const server = installFakeServer(seed());
    renderPage(<PlansPage />, "/plans");
    await screen.findByRole("heading", { name: "Quarterly" });

    await user.click(screen.getByRole("button", { name: /new plan/i }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/plan name/i), "X");
    await user.type(within(dialog).getByLabelText(/duration/i), "0");
    await user.type(within(dialog).getByLabelText(/price/i), "-5");
    await user.click(within(dialog).getByRole("button", { name: /create plan/i }));

    expect(await within(dialog).findByText(/at least 2 characters/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/at least 1 day/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/can’t be negative/i)).toBeInTheDocument();
    expect(server.calls.filter((c) => c.method === "post")).toHaveLength(0);
  });

  it("edits a plan", async () => {
    const user = userEvent.setup();
    const server = installFakeServer(seed());
    renderPage(<PlansPage />, "/plans");
    await screen.findByRole("heading", { name: "Quarterly" });

    await user.click(screen.getByRole("button", { name: "Actions for Quarterly" }));
    await user.click(await screen.findByRole("menuitem", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");
    const price = within(dialog).getByLabelText(/price/i);
    await user.clear(price);
    await user.type(price, "4500");
    await user.click(within(dialog).getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText("₹4,500")).toBeInTheDocument();
    expect(server.db.plans[1].price).toBe(4500);
  });

  it("deletes a plan that nobody uses", async () => {
    const user = userEvent.setup();
    const server = installFakeServer(seed());
    renderPage(<PlansPage />, "/plans");
    await screen.findByRole("heading", { name: "Quarterly" });

    await user.click(screen.getByRole("button", { name: "Actions for Quarterly" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog", { name: /delete plan/i });
    await user.click(within(dialog).getByRole("button", { name: /delete plan/i }));

    await waitFor(() => expect(screen.queryByRole("heading", { name: "Quarterly" })).not.toBeInTheDocument());
    expect(server.db.plans.map((p) => p.id)).toEqual(["PLN-001", "PLN-003"]);
  });

  it("protects plans that members are on and offers to deactivate instead", async () => {
    const user = userEvent.setup();
    const server = installFakeServer(seed());
    renderPage(<PlansPage />, "/plans");
    await screen.findByRole("heading", { name: "Monthly" });

    await user.click(screen.getByRole("button", { name: "Actions for Monthly" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog", { name: /in use/i });
    expect(within(dialog).getByText(/can’t be deleted/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: /mark as inactive/i }));

    expect(await screen.findByText(/Monthly is now inactive/)).toBeInTheDocument();
    expect(server.db.plans[0].is_active).toBe(false);
    expect(server.db.plans).toHaveLength(3);
    expect(server.calls.some((c) => c.method === "delete")).toBe(false);
  });

  it("searches and filters plans", async () => {
    const user = userEvent.setup();
    installFakeServer(seed());
    renderPage(<PlansPage />, "/plans");
    await screen.findByRole("heading", { name: "Quarterly" });

    await user.click(screen.getByRole("radio", { name: "Inactive" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Quarterly" })).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Legacy" })).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "All" }));
    await user.type(screen.getByRole("searchbox", { name: /search plans/i }), "quar");
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Monthly" })).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Quarterly" })).toBeInTheDocument();
  });

  it("shows the empty state and an error state", async () => {
    const user = userEvent.setup();
    const server = installFakeServer({});
    server.fail("get", "/memberships", { network: true });
    renderPage(<PlansPage />, "/plans");
    expect(await screen.findByRole("alert")).toHaveTextContent(/can't reach the server/i);
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("No membership plans yet")).toBeInTheDocument();
  });
});
