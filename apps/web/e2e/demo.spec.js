import { expect, test } from "@playwright/test";

const API = "http://localhost:4000/api/v1";

test.beforeAll(async ({ request }) => {
  const state = await request.get(`${API}/demo/state`).catch(() => null);
  if (!state || !state.ok()) return;
  const payload = await state.json();
  if (payload.mode !== "stub") return;
  const reset = await request.post(`${API}/demo/reset`);
  expect(reset.ok()).toBeTruthy();
});

test("buy, transfer, redeem and verify a lot", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Own the harvest/i })).toBeVisible();
  await expect(page.getByText("DigaZitoun").first()).toBeVisible();

  await page.goto("/lots/LOT-0001/buy");
  await expect(page.getByRole("heading", { name: /Buy DigaZitoun/i })).toBeVisible();
  await page.locator("#quantity").fill("12.5");
  await expect(page.getByText("1.25 DGZ")).toBeVisible();
  await page.getByRole("button", { name: /Pay 52.50 tUSDT/i }).click();
  await expect(page.getByText("Settled on the ledger")).toBeVisible();

  await page.goto("/wallet");
  await expect(page.getByRole("heading", { name: "Buyer A" })).toBeVisible();
  await expect(page.getByText("1.25 DGZ").first()).toBeVisible();

  // Peer transfer: give 0.2 DGZ to the other demo buyer.
  await page.locator("#amount").fill("0.2");
  await page.locator("#memo").fill("E2E peer transfer");
  await page.getByRole("button", { name: /Send tokens/i }).click();
  await expect(page.getByText(/Sent 0.2 DGZ/i)).toBeVisible();

  await page.goto("/redemptions");
  await page.locator("#redeem-series").selectOption("DGZ");
  await page.locator("#redeem-tokens").fill("0.5");
  await page.getByRole("button", { name: /Request pickup/i }).click();
  await expect(page).toHaveURL(/\/redemptions\/.+/);
  await expect(page.getByText("Pickup progress")).toBeVisible();
  await expect(page.getByText("Pickup code", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: /Confirm handover & burn/i }).click();
  await expect(page.getByText("Burned", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Tokens burned", { exact: true })).toBeVisible();

  // Public passport must verify the signature chain in the browser.
  await page.goto("/l/LOT-0001");
  await expect(page.getByRole("heading", { name: "DigaZitoun" })).toBeVisible();
  await page.getByRole("button", { name: /^Verify now$/ }).click();
  await expect(page.getByText(/Chain valid/i)).toBeVisible();

  // Printable label renders a QR and the lot code.
  await page.goto("/lots/LOT-0001/label");
  await expect(page.getByText("warehouse label", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: /Print label/i })).toBeVisible();

  expect(pageErrors).toEqual([]);
});
