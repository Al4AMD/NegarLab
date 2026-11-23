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
  await expect(page.getByTestId("histogram-view")).toBeVisible();
  await page.getByTestId("stage-image").click({ position: { x: 120, y: 90 } });
  await expect(page.getByTestId("inspector-matrix")).toBeVisible();

  await page.getByTestId("tab-point").click();
  await page.getByTestId("op-equalize").click();
  await expect(page.getByTestId("stage-preview")).toBeVisible();
  await page.getByTestId("reset-preview").click();
  await expect(page.getByTestId("stage-preview")).toHaveCount(0);

  await page.getByTestId("tab-sampling").click();
  await page.getByTestId("bits-slider").fill("2");
  await expect(page.getByTestId("stage-preview")).toBeVisible();
  await page.getByTestId("sampling-reset").click();

  await page.getByTestId("tab-spatial").click();
  await page.getByTestId("spatial-mean").click();
  await expect(page.getByTestId("stage-preview")).toBeVisible();
  await page.getByTestId("spatial-reset").click();
  await expect(page.getByTestId("stage-preview")).toHaveCount(0);

  await page.getByTestId("tab-frequency").click();
  await expect(page.getByTestId("spectrum-view")).toBeVisible();
  await page.getByTestId("frequency-apply").click();
  await expect(page.getByTestId("stage-preview")).toBeVisible();
  await page.getByTestId("frequency-reset").click();
  await expect(page.getByTestId("stage-preview")).toHaveCount(0);

  await page.getByTestId("tab-compression").click();
  await expect(page.getByTestId("compression-stats")).toBeVisible();
  await expect(page.getByTestId("lossless-table")).toBeVisible();
  await expect(page.getByTestId("jpeg-block")).toBeVisible();
  await expect(page.getByTestId("stage-preview")).toBeVisible();
  await page.getByTestId("compression-quality").fill("20");
  await expect(page.getByTestId("compression-stats")).toContainText("Bits / pixel");

  await page.getByTestId("tab-metrics").click();
  await expect(page.getByTestId("metrics-values")).toBeVisible();
  await expect(page.getByTestId("ssim-map")).toBeVisible();
  await expect(page.getByTestId("metrics-heatmap")).toBeVisible();
  await page.getByTestId("metrics-quality").fill("30");
  await page.getByTestId("metrics-rd").click();
  await expect(page.getByTestId("rd-chart")).toBeVisible();

  await page.getByRole("button", { name: "System check" }).click();
  const readout = page.getByTestId("stats-readout");
  await expect(readout).toBeVisible();
  await expect(readout).toContainText("Mean");
  await expect(readout).toContainText(/\d+\.\d{4}/);

  expect(errors).toEqual([]);
});
