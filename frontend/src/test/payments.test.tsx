import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import PaymentsPage from "@/pages/PaymentsPage";
import { installFakeServer, makeMember, makePayment, makePlan } from "@/test/fakeServer";
import { renderPage, setViewport } from "@/test/utils";

const seed = () => ({
  plans: [makePlan()],
  members: [makeMember(), makeMember({ id: "M-0002", full_name: "Priya Das", phone: "9876500012" })],
  payments: [
    makePayment(),
    makePayment({ id: "PAY-0002", member_id: "M-0002", member_name: "Priya Das", amount: 4000, status: "pending", method: "cash", payment_date: "2026-01-09" }),
    makePayment({ id: "PAY-0003", amount: 700, status: "failed", method: "card", payment_date: "2026-01-12", notes: "Card declined" }),
  ],
});

describe("Payments page", () => {
  beforeEach(() => setViewport(true));

  it("shows totals and the payment history table", async () => {
    installFakeServer(seed());
    renderPage(<PaymentsPage />, "/payments");
    const table = await screen.findByRole("table");
    expect(await within(table).findByText("PAY-0001")).toBeInTheDocument();
    expect(within(table).getByText("Card declined")).toBeInTheDocument();

    const totals = screen.getByRole("region", { name: /payment totals/i });
    expect(await within(totals).findByText("₹1,500 collected")).toBeInTheDocument();
    expect(within(totals).getByText("₹4,000 outstanding")).toBeInTheDocument();
  });

  it("records a payment for a member picked from the backend search", async () => {
    const user = userEvent.setup();
    const server = installFakeServer(seed());
    renderPage(<PaymentsPage />, "/payments");
    await screen.findByText("PAY-0001");

    await user.click(screen.getByRole("button", { name: /record payment/i }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByPlaceholderText(/search by name/i));
    await user.click(await within(dialog).findByRole("option", { name: /Priya Das/ }));

    const amount = within(dialog).getByLabelText(/amount/i);
    await user.clear(amount);
    await user.type(amount, "1500");
    await user.selectOptions(within(dialog).getByLabelText(/method/i), "upi");
    await user.type(within(dialog).getByLabelText(/notes/i), "January fees");
    await user.click(within(dialog).getByRole("button", { name: /^record payment$/i }));

    expect(await screen.findByText(/Recorded ₹1,500 for Priya Das/)).toBeInTheDocument();
    expect(server.db.payments).toHaveLength(4);
    expect(server.db.payments[3]).toMatchObject({ member_id: "M-0002", amount: 1500, method: "upi", status: "paid", notes: "January fees" });
    // The new payment shows in the list.
    expect(await screen.findByText("PAY-0004")).toBeInTheDocument();
  });

  it("validates before submitting", async () => {
    const user = userEvent.setup();
    const server = installFakeServer(seed());
    renderPage(<PaymentsPage />, "/payments");
    await screen.findByText("PAY-0001");

    await user.click(screen.getByRole("button", { name: /record payment/i }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /^record payment$/i }));

    expect(await within(dialog).findByText("Select a member")).toBeInTheDocument();
    expect(within(dialog).getByText("Enter the amount")).toBeInTheDocument();
    expect(server.calls.filter((c) => c.method === "post")).toHaveLength(0);
  });

  it("keeps the form open and shows the server's message when saving fails", async () => {
    const user = userEvent.setup();
    const server = installFakeServer(seed());
    renderPage(<PaymentsPage />, "/payments?member=M-0001");
    await screen.findByText("PAY-0001");

    await user.click(screen.getByRole("button", { name: /record payment/i }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(within(dialog).getByPlaceholderText(/search by name/i)).toHaveValue("Aarav Sharma · M-0001"));
    await user.type(within(dialog).getByLabelText(/amount/i), "250");
    server.fail("post", "/payments", { status: 503, detail: "The data store is temporarily unavailable. Please try again." });
    await user.click(within(dialog).getByRole("button", { name: /^record payment$/i }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/temporarily unavailable/i);
    expect(within(dialog).getByLabelText(/amount/i)).toHaveValue(250);
  });

  it("edits a payment from its details", async () => {
    const user = userEvent.setup();
    const server = installFakeServer(seed());
    renderPage(<PaymentsPage />, "/payments");
    await screen.findByText("PAY-0002");

    await user.click(screen.getByRole("button", { name: "Actions for payment PAY-0002" }));
    await user.click(await screen.findByRole("menuitem", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText(/^status/i), "paid");
    await user.click(within(dialog).getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText(/Updated payment PAY-0002/)).toBeInTheDocument();
    expect(server.db.payments[1].status).toBe("paid");
  });

  it("deletes a payment after confirmation", async () => {
    const user = userEvent.setup();
    const server = installFakeServer(seed());
    renderPage(<PaymentsPage />, "/payments");
    await screen.findByText("PAY-0003");

    await user.click(screen.getByRole("button", { name: "Actions for payment PAY-0003" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /delete record/i }));

    await waitFor(() => expect(screen.queryByText("PAY-0003")).not.toBeInTheDocument());
    expect(server.db.payments).toHaveLength(2);
  });

  it("filters by status and by search text", async () => {
    const user = userEvent.setup();
    installFakeServer(seed());
    renderPage(<PaymentsPage />, "/payments");
    await screen.findByText("PAY-0001");

    await user.selectOptions(screen.getByLabelText("Filter by payment status"), "pending");
    await waitFor(() => expect(screen.queryByText("PAY-0001")).not.toBeInTheDocument());
    expect(screen.getByText("PAY-0002")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear" }));
    await user.type(screen.getByRole("searchbox", { name: /search payments/i }), "declined");
    await waitFor(() => expect(screen.queryByText("PAY-0001")).not.toBeInTheDocument());
    expect(screen.getByText("PAY-0003")).toBeInTheDocument();
  });

  it("shows one member's payment history with totals", async () => {
    installFakeServer(seed());
    renderPage(<PaymentsPage />, "/payments?member=M-0001");
    expect(await screen.findByText("Payment history for")).toBeInTheDocument();
    const table = await screen.findByRole("table");
    await waitFor(() => expect(within(table).queryByText("PAY-0002")).not.toBeInTheDocument());
    expect(within(table).getByText("PAY-0001")).toBeInTheDocument();
    expect(await screen.findByText("Total paid")).toBeInTheDocument();
  });

  it("opens payment details from a deep link", async () => {
    installFakeServer(seed());
    renderPage(<PaymentsPage />, "/payments?view=PAY-0003");
    const dialog = await screen.findByRole("dialog", { name: /payment details/i });
    expect(within(dialog).getByText("Card declined")).toBeInTheDocument();
  });

  it("shows an error state and recovers on retry", async () => {
    const user = userEvent.setup();
    const server = installFakeServer(seed());
    server.fail("get", "/payments", { status: 500, detail: "boom", once: true });
    renderPage(<PaymentsPage />, "/payments");
    expect(await screen.findByText(/couldn’t load this data/i)).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: /try again/i })[0]);
    expect(await screen.findByText("PAY-0001")).toBeInTheDocument();
  });
});
