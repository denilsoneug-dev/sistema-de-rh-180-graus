import { expect, test, type Page } from "@playwright/test";

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

function monitorarErros(page: Page, ignorarResposta?: (url: string, status: number) => boolean) {
  const erros: string[] = [];
  page.on("pageerror", (error) => erros.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) {
      erros.push(`console: ${message.text()}`);
    }
  });
  page.on("response", (response) => {
    const status = response.status();
    if (status >= 400 && !ignorarResposta?.(response.url(), status)) {
      erros.push(`response: ${status} ${response.url()}`);
    }
  });
  return erros;
}

async function esperarPagina(page: Page, titulo: RegExp) {
  await expect(page.getByRole("heading", { name: titulo })).toBeVisible();
  await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test("protege a área interna e exibe o login sem erros", async ({ page }) => {
  const erros = monitorarErros(page);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await esperarPagina(page, /180 Graus/i);
  await expect(page.getByLabel("E-mail")).toBeVisible();
  await expect(page.getByLabel("Senha")).toBeVisible();
  expect(erros).toEqual([]);
});

test("rejeita credenciais inválidas e libera nova tentativa", async ({ page }) => {
  const erros = monitorarErros(
    page,
    (url, status) => status === 400 && url.includes("/auth/v1/token"),
  );
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("invalido@example.com");
  await page.getByLabel("Senha").fill("senha-incorreta");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByText("E-mail ou senha inválidos.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar" })).toBeEnabled();
  expect(erros).toEqual([]);
});

test("link público inválido apresenta mensagem segura", async ({ page }) => {
  const erros = monitorarErros(page);
  await page.goto(`/ficha/${"a".repeat(64)}`);
  await expect(page.getByText(/Este link não é válido/i)).toBeVisible();
  expect(erros).toEqual([]);
});

test("fluxos autenticados funcionam em desktop e celular", async ({ page, browser }, testInfo) => {
  test.skip(!email || !password, "Defina E2E_EMAIL e E2E_PASSWORD para testar a área autenticada.");

  const erros = monitorarErros(page);
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email!);
  await page.getByLabel("Senha").fill(password!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/$/);

  const paginas = [
    ["/", /Dashboard/i],
    ["/fichas", /Fichas/i],
    ["/candidatos", /Candidatos/i],
    ["/equipe", /Equipe/i],
    ["/busca", /Busca/i],
  ] as const;

  for (const [rota, titulo] of paginas) {
    await page.goto(rota);
    await esperarPagina(page, titulo);
  }
  await page.screenshot({ path: testInfo.outputPath("desktop-dashboard.png"), fullPage: true });
  expect(erros).toEqual([]);

  const estado = await page.context().storageState();
  const mobile = await browser.newContext({
    storageState: estado,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  });
  const paginaMobile = await mobile.newPage();
  const errosMobile = monitorarErros(paginaMobile);
  for (const [rota, titulo] of paginas) {
    await paginaMobile.goto(rota);
    await esperarPagina(paginaMobile, titulo);
  }
  await paginaMobile.screenshot({ path: testInfo.outputPath("mobile-dashboard.png"), fullPage: true });
  expect(errosMobile).toEqual([]);
  await mobile.close();
});
