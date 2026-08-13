import { expect, type Page, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config as loadEnvironment } from "dotenv";
import { randomBytes } from "node:crypto";

import type { Database } from "@/lib/supabase.database.types";

interface QaUser {
  id: string;
  email: string;
  password: string;
  username: string;
}

loadEnvironment({ path: ".env.local", quiet: true });

const users: QaUser[] = [];
let admin: SupabaseClient<Database> | null = null;

test.beforeAll(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return;

  admin = createClient<Database>(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const suffix = randomBytes(3).toString("hex");
  const password = `Ck${randomBytes(10).toString("base64url")}9`;
  const definitions = [
    {
      email: `qa-cyan-${suffix}@example.com`,
      username: `qa_cyan_${suffix}`,
      country_code: "MX",
    },
    {
      email: `qa-coral-${suffix}@example.com`,
      username: `qa_coral_${suffix}`,
      country_code: "US",
    },
  ];

  for (const definition of definitions) {
    const { data, error } = await admin.auth.admin.createUser({
      email: definition.email,
      password,
      email_confirm: true,
      user_metadata: {
        username: definition.username,
        country_code: definition.country_code,
        is_16_plus: true,
      },
    });
    if (error) throw error;
    users.push({
      id: data.user.id,
      email: definition.email,
      password,
      username: definition.username,
    });
  }
});

test.afterAll(async () => {
  if (!admin) return;
  await Promise.all(users.map((user) => admin!.auth.admin.deleteUser(user.id)));
});

async function signIn(page: Page, user: QaUser) {
  await page.goto("/");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.locator("form").getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Choose a match" })).toBeVisible();
}

test("tutorial, practice, private room, and public queue flows work", async ({ browser }, testInfo) => {
  test.skip(users.length < 2, "Supabase server credentials are required for multiplayer QA.");
  const firstContext = await browser.newContext();
  const secondContext = await browser.newContext();
  const first = await firstContext.newPage();
  const second = await secondContext.newPage();

  await Promise.all([signIn(first, users[0]), signIn(second, users[1])]);

  await first.getByRole("button", { name: "Learn" }).click();
  await expect(first.getByRole("heading", { name: "Start level" })).toBeVisible();
  await expect(first.locator(".tutorial-target-halo")).toBeVisible();
  await expect(first.locator(".board-chicken.active-shooter")).toHaveCount(1);
  await expect(first.locator(".board-corner-label")).toHaveText("LIVE PREVIEW");
  await first.getByRole("button", { name: "Test shot" }).click();
  await expect(first.getByText("Direct hit. Challenge complete.")).toBeVisible();
  await first.getByRole("button", { name: "Next challenge" }).click();
  await expect(first.getByRole("heading", { name: "Climb with slope" })).toBeVisible();
  await first.getByRole("button", { name: "Test shot" }).click();
  await expect(first.getByText(/8 units below the target/)).toBeVisible();
  await first.getByRole("button", { name: "Test shot" }).click();
  await expect(first.getByText("CLUE 2 OF 3")).toBeVisible();
  const slope = first.getByRole("slider", { name: "Slope" });
  await slope.focus();
  for (let step = 0; step < 10; step += 1) await slope.press("ArrowRight");
  await expect(first.locator(".tutorial-formula code")).toHaveText("0.75*x");
  await first.getByRole("button", { name: "Test shot" }).click();
  await expect(first.getByText("Direct hit. Challenge complete.")).toBeVisible();
  await first.screenshot({
    path: testInfo.outputPath("tutorial-level.png"),
    fullPage: true,
  });
  await first.getByRole("button", { name: "Play" }).click();
  await expect(first.getByRole("heading", { name: "Choose a match" })).toBeVisible();
  await first.getByRole("button", { name: "Learn" }).click();
  await expect(first.getByRole("heading", { name: "Descend with slope" })).toBeVisible();
  await first.getByRole("button", { name: "Play" }).click();

  await first.evaluate(
    ({ id }) => window.localStorage.setItem(`chickgraph:tutorial:v2:${id}`, "16"),
    { id: users[0].id },
  );
  await first.getByRole("button", { name: "Learn" }).click();
  await expect(first.getByRole("heading", { name: "Write a V yourself" })).toBeVisible();
  await first.getByRole("textbox", { name: "Tutorial function" }).fill("-0.2*x");
  await first.getByRole("button", { name: "Test shot" }).click();
  await expect(first.getByText("Good hit, but use abs(...) to complete this challenge.")).toBeVisible();
  await first.getByRole("textbox", { name: "Tutorial function" }).fill("0.7*abs(x+3)");
  await expect(first.getByText("Valid expression · live preview active")).toBeVisible();
  await first.getByRole("button", { name: "Test shot" }).click();
  await expect(first.getByText("Direct hit. Challenge complete.")).toBeVisible();
  await first.screenshot({
    path: testInfo.outputPath("tutorial-builder.png"),
    fullPage: true,
  });
  await first.getByRole("button", { name: "Play" }).click();

  await first.getByRole("button", { name: "Practice vs bot" }).click();
  await expect(first.getByText("Practice 1v1")).toBeVisible();
  await expect(first.locator("svg.game-board")).toBeVisible();
  await expect(first.getByText("GraphBot").first()).toBeVisible();
  await expect(first.locator(".board-chicken.active-shooter")).toHaveCount(1);
  await expect(first.locator(".axis-labels-x text")).toHaveCount(11);
  await expect(first.locator(".axis-labels-y text")).toHaveCount(6);
  const firstShooter = await first
    .locator(".board-chicken.active-shooter")
    .getAttribute("data-chick-id");
  await first.getByRole("textbox", { name: "Function" }).fill("0");
  await first.getByRole("button", { name: "Fire" }).click();
  await expect(first.getByText("Turn 3")).toBeVisible({ timeout: 15_000 });
  await expect(first.getByRole("textbox", { name: "Function" })).toBeEnabled();
  const nextShooter = await first
    .locator(".board-chicken.active-shooter")
    .getAttribute("data-chick-id");
  expect(nextShooter).not.toBe(firstShooter);
  await first.screenshot({
    path: testInfo.outputPath("practice-match.png"),
    fullPage: true,
  });
  await first.getByRole("button", { name: "Exit" }).click();
  await expect(first.getByRole("heading", { name: "Choose a match" })).toBeVisible();

  await first.getByRole("button", { name: "Create invite code" }).click();
  await expect(first.getByRole("heading", { name: "Waiting for your opponent" })).toBeVisible();
  const code = (await first.locator(".invite-code span").textContent())?.trim();
  expect(code).toMatch(/^[A-Z2-9]{6}$/);

  await second.getByLabel("ROOM CODE").fill(code!);
  await second.getByRole("button", { name: "Join room" }).click();
  await expect(second.locator("svg.game-board")).toBeVisible();
  await expect(first.locator("svg.game-board")).toBeVisible();

  await first.screenshot({
    path: testInfo.outputPath("private-match.png"),
    fullPage: true,
  });
  const boardPixels = await first.locator("svg.game-board").evaluate((node) => {
    const box = node.getBoundingClientRect();
    return { width: box.width, height: box.height };
  });
  expect(boardPixels.width).toBeGreaterThan(700);
  expect(boardPixels.height).toBeGreaterThan(400);

  await first.getByRole("textbox", { name: "Function" }).fill("0");
  await first.getByRole("button", { name: "Fire" }).click();
  await expect(first.getByText("Turn 2")).toBeVisible();
  await expect(second.getByRole("textbox", { name: "Function" })).toBeEnabled();

  await first.getByLabel("Chat message").fill("QA synchronized chat");
  await first.getByTitle("Send message").click();
  await expect(second.getByText("QA synchronized chat")).toBeVisible();

  second.once("dialog", (dialog) => dialog.accept());
  await second.getByRole("button", { name: "Resign" }).click();
  await expect(first.getByRole("heading", { name: "Victory" })).toBeVisible();
  await first.locator(".match-result").getByRole("button", { name: "Return to lobby" }).click();
  await second.locator(".match-result").getByRole("button", { name: "Return to lobby" }).click();
  await expect(first.getByRole("heading", { name: "Choose a match" })).toBeVisible();
  await expect(second.getByRole("heading", { name: "Choose a match" })).toBeVisible();

  if (process.env.RUN_PUBLIC_QUEUE_E2E === "true") {
    const { count: waitingPlayers, error: queueError } = await admin!
      .from("matchmaking_queue")
      .select("user_id", { count: "exact", head: true });
    if (queueError) throw queueError;
    expect(waitingPlayers, "The live queue must be empty before public queue QA.").toBe(0);

    await Promise.all([
      first.getByRole("button", { name: "Find opponent" }).click(),
      second.getByRole("button", { name: "Find opponent" }).click(),
    ]);
    await expect(second.locator("svg.game-board")).toBeVisible();
    await expect(first.locator("svg.game-board")).toBeVisible();
    await expect(first.getByText("Ranked 1v1")).toBeVisible();

    await first.screenshot({
      path: testInfo.outputPath("public-queue-match.png"),
      fullPage: true,
    });

    second.once("dialog", (dialog) => dialog.accept());
    await second.getByRole("button", { name: "Resign" }).click();
    await expect(first.getByRole("heading", { name: "Victory" })).toBeVisible();
  } else {
    testInfo.annotations.push({
      type: "queue",
      description: "Public queue QA requires RUN_PUBLIC_QUEUE_E2E=true.",
    });
  }

  await Promise.all([firstContext.close(), secondContext.close()]);
});
