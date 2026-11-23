import { expect, test } from "@playwright/test";

test("bilingual shell, theme toggle, and worker system check", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.route("**/api/v1/health", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "ok" }),
    }),
  );

  await page.goto("/");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("lang", "fa");
  await expect(html).toHaveAttribute("dir", "rtl");
  await expect(html).toHaveAttribute("data-theme", /(dark|light)/);
  await expect(page.getByTestId("module-I01")).toBeVisible();

  await page.getByTestId("language-toggle").click();
  await expect(html).toHaveAttribute("lang", "en");
  await expect(html).toHaveAttribute("dir", "ltr");

  const before = await html.getAttribute("data-theme");
  await page.getByTestId("theme-toggle").click();
  await expect(html).not.toHaveAttribute("data-theme", before ?? "dark");

  await page.getByTestId("demo-zone-plate").click();
  await expect(page.getByTestId("stage-image")).toBeVisible();

  await page.getByRole("button", { name: "System check" }).click();
  const readout = page.getByTestId("stats-readout");
  await expect(readout).toBeVisible();
  await expect(readout).toContainText("Mean");
  await expect(readout).toContainText(/\d+\.\d{4}/);

  expect(errors).toEqual([]);
});
