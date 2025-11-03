/**
 * Automated test for vortex-theme-utils.js
 * Run with: npx playwright test test-utils.spec.js
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

test.describe('Vortex Theme Utilities', () => {
  test.beforeEach(async ({ page }) => {
    // Load the utility functions
    const utilsScript = fs.readFileSync(
      path.join(__dirname, 'vortex-theme-utils.js'),
      'utf-8'
    );
    
    // Create a test page with form elements
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          .modal {
            background: #ffffff;
            padding: 40px;
          }
          input[type="email"] {
            padding: 12px;
            border: 2px solid #ebe6df;
            border-radius: 8px;
            background: transparent;
            transition: border-color 0.2s;
          }
          input[type="email"]:focus {
            border-color: #03d47c;
          }
        </style>
      </head>
      <body>
        <div class="modal">
          <input type="email" placeholder="Email">
        </div>
      </body>
      </html>
    `);
    
    // Inject the utilities
    await page.evaluate(utilsScript);
  });

  test('vortexRgbToHex - converts RGB to hex', async ({ page }) => {
    const result = await page.evaluate(() => {
      return window.vortexRgbToHex('rgb(7, 39, 31)');
    });
    
    expect(result).toBe('#07271F');
  });

  test('vortexRgbToHex - handles RGBA with alpha', async ({ page }) => {
    const result = await page.evaluate(() => {
      return window.vortexRgbToHex('rgba(0, 0, 0, 0.19)');
    });
    
    expect(result).toMatch(/^#00000030$/);
  });

  test('vortexRgbToHex - handles transparent', async ({ page }) => {
    const result = await page.evaluate(() => {
      return window.vortexRgbToHex('rgba(0, 0, 0, 0)');
    });
    
    expect(result).toMatch(/^#00000000$/);
  });

  test('vortexOklabToRgb - converts OKLab to RGB', async ({ page }) => {
    const result = await page.evaluate(() => {
      const [r, g, b] = window.vortexOklabToRgb(0.7, -0.1, 0.05);
      return { r, g, b, valid: r >= 0 && r <= 255 && g >= 0 && g <= 255 && b >= 0 && b <= 255 };
    });
    
    expect(result.valid).toBe(true);
    expect(result.r).toBeGreaterThanOrEqual(0);
    expect(result.r).toBeLessThanOrEqual(255);
  });

  test('vortexExtractFormFieldBorderColor - extracts RESTING border color', async ({ page }) => {
    // Focus the input first
    await page.focus('input[type="email"]');
    await page.waitForTimeout(100);
    
    // Now extract - should get resting color (not focused)
    const result = await page.evaluate(async () => {
      return await window.vortexExtractFormFieldBorderColor('input[type="email"]');
    });
    
    console.log('Border color result:', result);
    
    expect(result).toHaveProperty('color');
    expect(result.color).toBe('#EBE6DF'); // Resting state, NOT focused (#03D47C)
  });

  test('vortexExtractFormContainerBackground - finds modal background', async ({ page }) => {
    const result = await page.evaluate(async () => {
      return await window.vortexExtractFormContainerBackground('input[type="email"]');
    });
    
    console.log('Container background result:', result);
    
    expect(result).toHaveProperty('color');
    expect(result.color).toBe('#FFFFFF');
  });

  test('Async functions are callable from async evaluate', async ({ page }) => {
    // This tests the pattern the LLM should use
    const result = await page.evaluate(async () => {
      // This is the CORRECT pattern
      const borderResult = await window.vortexExtractFormFieldBorderColor('input[type="email"]');
      const containerResult = await window.vortexExtractFormContainerBackground('input[type="email"]');
      
      return {
        borderColor: borderResult.color,
        containerColor: containerResult.color
      };
    });
    
    expect(result.borderColor).toBe('#EBE6DF');
    expect(result.containerColor).toBe('#FFFFFF');
  });

  test('Non-async function with await should fail', async ({ page }) => {
    // This tests what happens when LLM forgets 'async'
    // We pass it as a string to avoid parse errors
    await expect(async () => {
      await page.evaluate(`() => {
        // This is WRONG - missing 'async'
        const result = await window.vortexExtractFormFieldBorderColor('input[type="email"]');
        return result;
      }`);
    }).rejects.toThrow();
  });
});

