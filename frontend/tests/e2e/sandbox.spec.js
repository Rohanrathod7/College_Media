import { test, expect } from '@playwright/test';

test.describe('Code Sandbox Execution', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/sandbox'); // Assuming public access or previously logged in
    });

    test('should execute JS code and show output', async ({ page }) => {
        // Wait for Editor to load
        await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 10000 });

        // Select Language
        await page.click('[aria-label="Select Language"]');
        await page.click('text=JavaScript');

        // Enter Code (Monaco requires specific interaction or clipboard paste)
        // Simple type approach
        await page.click('.monaco-editor .view-lines');
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Backspace');
        await page.keyboard.type('console.log("Hello from Playwright");');

        // Run
        await page.click('button:has-text("Run")');

        // Verify Output Terminal
        const output = page.locator('[data-testid="execution-output"]');
        await expect(output).toBeVisible();
        await expect(output).toContainText('Hello from Playwright');
    });

    test('should handle compilation errors', async ({ page }) => {
        await page.click('.monaco-editor .view-lines');
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Backspace');
        await page.keyboard.type('syntax error here');

        await page.click('button:has-text("Run")');

        const output = page.locator('[data-testid="execution-output"]');
        await expect(output).toContainText('SyntaxError');
    });
});
