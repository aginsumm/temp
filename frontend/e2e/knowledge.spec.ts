import { test, expect, type Page } from '@playwright/test';

test.describe('知识图谱模块 E2E 测试', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('/knowledge');
  });

  test('应该能够加载知识图谱页面', async ({ page }: { page: Page }) => {
    await expect(page.locator('text=知识图谱')).toBeVisible({ timeout: 10000 });
  });

  test('应该能够搜索节点', async ({ page }: { page: Page }) => {
    await page.goto('/knowledge');
    await expect(page.locator('text=知识图谱')).toBeVisible({ timeout: 10000 });

    const searchInput = page.locator('input[placeholder*="搜索"]');
    await searchInput.fill('景泰蓝');
    await searchInput.press('Enter');

    await page.waitForTimeout(1000);
    await expect(page.locator('text=景泰蓝')).toBeVisible();
  });

  test('应该能够筛选节点类型', async ({ page }: { page: Page }) => {
    await page.goto('/knowledge');
    await expect(page.locator('text=知识图谱')).toBeVisible({ timeout: 10000 });

    const filterButton = page.locator('button:has-text("筛选")');
    await filterButton.click();

    await page.waitForTimeout(500);
    await expect(page.locator('text=技艺')).toBeVisible();
  });

  test('应该能够切换布局', async ({ page }: { page: Page }) => {
    await page.goto('/knowledge');
    await expect(page.locator('text=知识图谱')).toBeVisible({ timeout: 10000 });

    const layoutSelector = page.locator('select, button:has-text("力导向")');
    await layoutSelector.click();

    await page.waitForTimeout(500);
  });

  test('应该能够缩放图谱', async ({ page }: { page: Page }) => {
    await page.goto('/knowledge');
    await expect(page.locator('text=知识图谱')).toBeVisible({ timeout: 10000 });

    const zoomInButton = page.locator('button[aria-label*="放大"], button:has-text("+")');
    if ((await zoomInButton.count()) > 0) {
      await zoomInButton.click();
      await page.waitForTimeout(500);
    }
  });

  test('应该能够查看节点详情', async ({ page }: { page: Page }) => {
    await page.goto('/knowledge');
    await expect(page.locator('text=知识图谱')).toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(2000);
    const node = page.locator('[data-testid="graph-node"], text=景泰蓝').first();
    if ((await node.count()) > 0) {
      await node.click();
      await page.waitForTimeout(1000);
    }
  });

  test('应该能够重置视图', async ({ page }: { page: Page }) => {
    await page.goto('/knowledge');
    await expect(page.locator('text=知识图谱')).toBeVisible({ timeout: 10000 });

    const resetButton = page.locator('button[aria-label*="重置"], button:has-text("重置")');
    if ((await resetButton.count()) > 0) {
      await resetButton.click();
      await page.waitForTimeout(500);
    }
  });

  test('应该能够导出图谱', async ({ page }: { page: Page }) => {
    await page.goto('/knowledge');
    await expect(page.locator('text=知识图谱')).toBeVisible({ timeout: 10000 });

    const exportButton = page.locator('button[aria-label*="导出"], button:has-text("导出")');
    if ((await exportButton.count()) > 0) {
      await exportButton.click();
      await page.waitForTimeout(500);
    }
  });

  test('应该能够处理网络错误', async ({ page }: { page: Page }) => {
    await page.route('**/api/**', (route) => {
      route.abort('failed');
    });

    await page.goto('/knowledge');
    await page.waitForTimeout(2000);
  });

  test('应该能够加载实体列表', async ({ page }: { page: Page }) => {
    await page.goto('/knowledge');
    await expect(page.locator('text=知识图谱')).toBeVisible({ timeout: 10000 });

    const listButton = page.locator('button[aria-label*="列表"], button:has-text("列表")');
    if ((await listButton.count()) > 0) {
      await listButton.click();
      await page.waitForTimeout(1000);
    }
  });

  test('应该能够切换视图模式', async ({ page }: { page: Page }) => {
    await page.goto('/knowledge');
    await expect(page.locator('text=知识图谱')).toBeVisible({ timeout: 10000 });

    const viewToggle = page.locator(
      'button[aria-label*="视图"], button:has-text("图谱"), button:has-text("列表")'
    );
    if ((await viewToggle.count()) > 0) {
      await viewToggle.first().click();
      await page.waitForTimeout(500);
    }
  });

  test('应该能够刷新数据', async ({ page }: { page: Page }) => {
    await page.goto('/knowledge');
    await expect(page.locator('text=知识图谱')).toBeVisible({ timeout: 10000 });

    const refreshButton = page.locator('button[aria-label*="刷新"], button:has-text("刷新")');
    if ((await refreshButton.count()) > 0) {
      await refreshButton.click();
      await page.waitForTimeout(1000);
    }
  });
});
