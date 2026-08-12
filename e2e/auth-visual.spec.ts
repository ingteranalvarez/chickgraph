import { expect, test } from "@playwright/test";

test("authentication screen is usable at desktop and mobile sizes", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await page.getByRole("button", { name: "Register" }).click();
  await expect(page.getByLabel("Username")).toBeVisible();
  await expect(page.getByLabel("Country")).toHaveValue("MX");
  await expect(
    page.getByText("I confirm that I am at least 16 years old."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign in" }).first().click();

  const desktopOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(desktopOverflow).toBe(false);
  await page.screenshot({
    path: testInfo.outputPath("auth-desktop.png"),
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  const mobileOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(mobileOverflow).toBe(false);
  await page.screenshot({
    path: testInfo.outputPath("auth-mobile.png"),
    fullPage: true,
  });
});
