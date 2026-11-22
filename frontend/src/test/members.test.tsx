import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import MembersPage from "@/pages/MembersPage";
import { installFakeServer, makeMember, makePlan } from "@/test/fakeServer";
import { renderPage, setViewport } from "@/test/utils";

const plans = [makePlan(), makePlan({ id: "PLN-002", name: "Quarterly", duration_days: 90, price: 4000 })];
const seed = () => ({
  plans,
  members: [
    makeMember(),
    makeMember({ id: "M-0002", full_name: "Priya Das", phone: "9876500012", payment_status: "pending" }),
    makeMember({ id: "M-0003", full_name: "Rohan Gupta", phone: "9876500013", status: "expired", days_remaining: -5, end_date: "2020-01-01" }),
  ],
});

describe("Members page (card layout)", () => {
  beforeEach(() => setViewport(false));

  it("lists members from the API", async () => {
    installFakeServer(seed());
    renderPage(<MembersPage />, "/members");
    expect(await screen.findByText("Aarav Sharma")).toBeInTheDocument();
    expect(screen.getByText("Priya Das")).toBeInTheDocument();
    expect(screen.getByText("3 members registered")).toBeInTheDocument();
  });

  it("shows the empty state when there are no members", async () => {
    installFakeServer({ plans });
    renderPage(<MembersPage />, "/members");
    expect(await screen.findByText("No members yet")).toBeInTheDocument();
  });

  it("adds a member through the form and shows them in the list", async () => {
    const user = userEvent.setup();
    const server = installFakeServer(seed());
    renderPage(<MembersPage />, "/members");
    await screen.findByText("Aarav Sharma");

    await user.click(screen.getByRole("button", { name: /add member/i }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/full name/i), "Neha Verma");
    await user.type(within(dialog).getByLabelText(/^age/i), "29");
    await user.type(within(dialog).getByLabelText(/contact number/i), "9123456780");
    await user.selectOptions(within(dialog).getByLabelText(/membership plan/i), "PLN-002");
    await user.click(within(dialog).getByRole("button", { name: /^add member$/i }));

    expect(await screen.findByText(/Neha Verma was added as M-0004/)).toBeInTheDocument();
    expect(await screen.findByText("Neha Verma", { selector: "span" })).toBeInTheDocument();
    expect(server.db.members).toHaveLength(4);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("validates the form before calling the API", async () => {
    const user = userEvent.setup();
    const server = installFakeServer(seed());
    renderPage(<MembersPage />, "/members");
    await screen.findByText("Aarav Sharma");

    await user.click(screen.getByRole("button", { name: /add member/i }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /^add member$/i }));

    expect(await within(dialog).findByText(/at least 2 characters/i)).toBeInTheDocument();
    expect(within(dialog).getByText("Choose a membership plan")).toBeInTheDocument();
    expect(server.calls.filter((c) => c.method === "post")).toHaveLength(0);
  });

  it("keeps what the user typed and explains the problem when saving fails", async () => {
    const user = userEvent.setup();
    const server = installFakeServer(seed());
    renderPage(<MembersPage />, "/members");
    await screen.findByText("Aarav Sharma");

    await user.click(screen.getByRole("button", { name: /add member/i }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/full name/i), "Neha Verma");
    await user.type(within(dialog).getByLabelText(/^age/i), "29");
    await user.type(within(dialog).getByLabelText(/contact number/i), "9123456780");
    await user.selectOptions(within(dialog).getByLabelText(/membership plan/i), "PLN-001");

    server.fail("post", "/members", { status: 409, detail: "A member with this phone number already exists" });
    await user.click(within(dialog).getByRole("button", { name: /^add member$/i }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("already exists");
    expect(within(dialog).getByLabelText(/full name/i)).toHaveValue("Neha Verma");
    expect(within(dialog).getByLabelText(/contact number/i)).toHaveValue("9123456780");

    // Retrying after the problem is gone succeeds without retyping anything.
    await user.click(within(dialog).getByRole("button", { name: /^add member$/i }));
    expect(await screen.findByText(/Neha Verma was added/)).toBeInTheDocument();
  });

  it("edits a member", async () => {
    const user = userEvent.setup();
    const server = installFakeServer(seed());
    renderPage(<MembersPage />, "/members");
    await screen.findByText("Aarav Sharma");

    await user.click(screen.getByRole("button", { name: "Actions for Aarav Sharma" }));
    await user.click(await screen.findByRole("menuitem", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");
    const name = within(dialog).getByLabelText(/full name/i);
    await user.clear(name);
    await user.type(name, "Aarav K. Sharma");
    await user.click(within(dialog).getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText("Aarav K. Sharma", { selector: "span" })).toBeInTheDocument();
    expect(server.db.members[0].full_name).toBe("Aarav K. Sharma");
  });

  it("deletes a member after confirmation", async () => {
    const user = userEvent.setup();
    const server = installFakeServer(seed());
    renderPage(<MembersPage />, "/members");
    await screen.findByText("Priya Das");

    await user.click(screen.getByRole("button", { name: "Actions for Priya Das" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog", { name: /delete member/i });
    expect(within(dialog).getByText(/payment history/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: /delete member/i }));

    await waitFor(() => expect(screen.queryByText("Priya Das")).not.toBeInTheDocument());
    expect(server.db.members.map((m) => m.id)).toEqual(["M-0001", "M-0003"]);
  });

  it("can cancel a delete without removing anything", async () => {
    const user = userEvent.setup();
    const server = installFakeServer(seed());
    renderPage(<MembersPage />, "/members");
    await screen.findByText("Priya Das");

    await user.click(screen.getByRole("button", { name: "Actions for Priya Das" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /cancel/i }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(server.db.members).toHaveLength(3);
  });

  it("searches members by name through the API", async () => {
    const user = userEvent.setup();
    const server = installFakeServer(seed());
    renderPage(<MembersPage />, "/members");
    await screen.findByText("Aarav Sharma");

    await user.type(screen.getByRole("searchbox", { name: /search members/i }), "priya");
    await waitFor(() => expect(screen.queryByText("Aarav Sharma")).not.toBeInTheDocument());
    expect(screen.getByText("Priya Das")).toBeInTheDocument();
    expect(server.calls.some((c) => c.url === "/members")).toBe(true);
  });

  it("shows a helpful message when a search finds nothing, and clears it", async () => {
    const user = userEvent.setup();
    installFakeServer(seed());
    renderPage(<MembersPage />, "/members");
    await screen.findByText("Aarav Sharma");

    await user.type(screen.getByRole("searchbox", { name: /search members/i }), "zzzz");
    expect(await screen.findByText("No members match these filters")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(await screen.findByText("Aarav Sharma")).toBeInTheDocument();
  });

  it("filters by membership status", async () => {
    const user = userEvent.setup();
    installFakeServer(seed());
    renderPage(<MembersPage />, "/members");
    await screen.findByText("Aarav Sharma");

    await user.selectOptions(screen.getByLabelText("Filter by membership status"), "expired");
    await waitFor(() => expect(screen.queryByText("Aarav Sharma")).not.toBeInTheDocument());
    expect(screen.getByText("Rohan Gupta")).toBeInTheDocument();
  });

  it("applies filters from the URL (deep links from the dashboard)", async () => {
    installFakeServer(seed());
    renderPage(<MembersPage />, "/members?status=expired");
    expect(await screen.findByText("Rohan Gupta")).toBeInTheDocument();
    expect(screen.queryByText("Aarav Sharma")).not.toBeInTheDocument();
  });

  it("opens the member details drawer", async () => {
    const user = userEvent.setup();
    installFakeServer(seed());
    renderPage(<MembersPage />, "/members");
    await user.click(await screen.findByRole("button", { name: /^Aarav Sharma/ }));
    const drawer = await screen.findByRole("dialog");
    expect(await within(drawer).findByText("Current plan")).toBeInTheDocument();
    expect(within(drawer).getByRole("button", { name: /renew/i })).toBeInTheDocument();
  });

  it("shows an error with a retry when the server is unreachable", async () => {
    const user = userEvent.setup();
    const server = installFakeServer(seed());
    server.fail("get", "/members", { network: true });
    renderPage(<MembersPage />, "/members");

    expect(await screen.findByText(/can’t load this data|couldn’t load this data/i)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/can't reach the server/i);
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("Aarav Sharma")).toBeInTheDocument();
  });
});

describe("Members page (table layout)", () => {
  beforeEach(() => setViewport(true));

  it("renders a sortable table and sorts through the API", async () => {
    const user = userEvent.setup();
    installFakeServer(seed());
    renderPage(<MembersPage />, "/members?sort=full_name&order=asc");
    const table = await screen.findByRole("table");
    const names = () =>
      within(table)
        .getAllByRole("row")
        .slice(1)
        .map((r) => within(within(r).getAllByRole("cell")[1]).getByRole("button").textContent);
    await waitFor(() => expect(names()).toEqual(["Aarav Sharma", "Priya Das", "Rohan Gupta"]));

    await user.click(within(table).getByRole("button", { name: /^name/i }));
    await waitFor(() => expect(names()).toEqual(["Rohan Gupta", "Priya Das", "Aarav Sharma"]));
  });
});
