/**
 * Vortex Theme Extraction Utilities
 * Injected into every page to provide reliable theme extraction functions.
 */

/**
 * Convert RGB/RGBA color string to hex format
 * @param {string} rgbString - Color in format "rgb(r, g, b)" or "rgba(r, g, b, a)"
 * @returns {string} Color in hex format (e.g., "#1A3D32" or "#1A3D32B8" with alpha)
 */
window.vortexRgbToHex = function(rgbString) {
  // Parse rgb(r, g, b) or rgba(r, g, b, a)
  const match = rgbString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!match) return rgbString;

  const r = parseInt(match[1]);
  const g = parseInt(match[2]);
  const b = parseInt(match[3]);
  const a = match[4] ? parseFloat(match[4]) : null;

  // Convert to hex
  const toHex = (n) => n.toString(16).padStart(2, '0');
  let hex = '#' + toHex(r) + toHex(g) + toHex(b);

  // Add alpha if present and not fully opaque
  if (a !== null && a !== 1) {
    const alphaHex = Math.round(a * 255).toString(16).padStart(2, '0');
    hex += alphaHex;
  }

  return hex.toUpperCase();
};

/**
 * Convert OKLab color to RGB
 * @param {number} L - Lightness (0-1)
 * @param {number} a - Green-red axis
 * @param {number} b - Blue-yellow axis
 * @returns {number[]} RGB values [r, g, b] (0-255)
 */
window.vortexOklabToRgb = function(L, a, b) {
  // OKLab -> Linear RGB
  const l = L + 0.3963377774 * a + 0.2158037573 * b;
  const m = L - 0.1055613458 * a - 0.0638541728 * b;
  const s = L - 0.0894841775 * a - 1.2914855480 * b;
  const l3 = l * l * l, m3 = m * m * m, s3 = s * s * s;

  // Linear RGB -> sRGB
  let r = +4.0767416621 * l3 - 3.0771159139 * m3 + 0.2309699292 * s3;
  let g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  let bl = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

  // Gamma correction
  r = r > 0.0031308 ? 1.055 * Math.pow(r, 1/2.4) - 0.055 : 12.92 * r;
  g = g > 0.0031308 ? 1.055 * Math.pow(g, 1/2.4) - 0.055 : 12.92 * g;
  bl = bl > 0.0031308 ? 1.055 * Math.pow(bl, 1/2.4) - 0.055 : 12.92 * bl;

  // Clamp and convert to 0-255
  return [
    Math.max(0, Math.min(255, Math.round(r * 255))),
    Math.max(0, Math.min(255, Math.round(g * 255))),
    Math.max(0, Math.min(255, Math.round(bl * 255)))
  ];
};

/**
 * Extract form field border color in RESTING (unfocused) state
 * This is the critical function that properly handles focus/blur and CSS transitions.
 * 
 * @param {string} selector - CSS selector for the input element (e.g., 'input[type="email"]')
 * @returns {Promise<{color: string, element: string, width: string}>} Border color in hex, element info, and border width
 */
window.vortexExtractFormFieldBorderColor = async function(selector) {
  const input = document.querySelector(selector);
  if (!input) {
    throw new Error(`Element not found: ${selector}`);
  }

  // CRITICAL: Ensure NO element has focus before extracting border color
  // This is the key to getting the resting/unfocused color
  if (document.activeElement) {
    document.activeElement.blur();
  }
  input.blur();
  
  // Click somewhere neutral to ensure no element is focused
  document.body.click();
  
  // MANDATORY WAIT: CSS transitions take time - must wait for them to complete
  // If you extract immediately, you'll get the WRONG (focused) color!
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Get border element (might be on wrapper, not input itself)
  const inputBorderWidth = getComputedStyle(input).borderWidth;
  let borderElement = input;
  
  if (inputBorderWidth === '0px' || inputBorderWidth === '0') {
    // Border is on parent wrapper (common modern pattern)
    borderElement = input.parentElement;
  }
  
  // Now extract the border color - should be the resting state
  const restingBorderColor = getComputedStyle(borderElement).borderColor;
  const borderWidth = getComputedStyle(borderElement).borderWidth;
  
  // Convert to hex
  const hexColor = window.vortexRgbToHex(restingBorderColor);
  
  return {
    color: hexColor,
    element: borderElement.className || borderElement.tagName,
    width: borderWidth
  };
};

/**
 * Extract form container background color (modal/dialog/card background)
 * Walks up the DOM tree to find the appropriate container background.
 * 
 * @param {string} inputSelector - CSS selector for an input within the form
 * @returns {Promise<{color: string, element: string}>} Background color in hex and element info
 */
window.vortexExtractFormContainerBackground = async function(inputSelector) {
  const input = document.querySelector(inputSelector);
  if (!input) {
    throw new Error(`Element not found: ${inputSelector}`);
  }

  let current = input;
  const backgrounds = [];
  let modalElement = null;
  
  for (let i = 0; i < 15; i++) {
    if (!current) break;
    const bg = getComputedStyle(current).backgroundColor;
    if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
      backgrounds.push({level: i, color: bg, element: current});
    }
    // Track the modal/form container element
    if (!modalElement && current.className && typeof current.className === 'string') {
      if (current.className.includes('modal') || current.className.includes('dialog') || current.className.includes('form')) {
        modalElement = current;
      }
    }
    current = current.parentElement;
  }
  
  // CRITICAL: Use the LAST solid background, but prefer modal/dialog elements over body
  let formContainerBg = null;
  let containerElement = null;
  
  // First, try to find a solid background within a modal/dialog/form element
  for (let i = 0; i < backgrounds.length; i++) {
    const bg = backgrounds[i];
    const el = bg.element;
    const className = typeof el.className === 'string' ? el.className : '';
    
    // Check if this is a modal/dialog/form element
    if (className.includes('modal') || className.includes('dialog') || className.includes('form') ||
        el.tagName === 'DIALOG' || el.getAttribute('role') === 'dialog') {
      // Check if this background is solid
      if (!bg.color.includes('rgba')) {
        formContainerBg = bg.color;
        containerElement = el;
        break;
      } else if (bg.color.includes('rgba')) {
        const alphaMatch = bg.color.match(/,\s*([\d.]+)\)/);
        const alpha = alphaMatch ? parseFloat(alphaMatch[1]) : 0;
        if (alpha === 1) {
          formContainerBg = bg.color;
          containerElement = el;
          break;
        }
      }
    }
  }
  
  // If no modal/dialog found with solid background, fall back to last solid background
  // But DON'T use body/html (those are page backgrounds, not form containers)
  if (!formContainerBg) {
    for (let i = backgrounds.length - 1; i >= 0; i--) {
      const el = backgrounds[i].element;
      const tagName = el.tagName?.toLowerCase();
      
      // Skip body/html - these are page backgrounds, not form containers
      if (tagName === 'body' || tagName === 'html') continue;
      
      const color = backgrounds[i].color;
      // Check if it's solid (rgb) or fully opaque rgba
      if (!color.includes('rgba')) {
        formContainerBg = color;
        containerElement = el;
        break;
      } else if (color.includes('rgba')) {
        const alphaMatch = color.match(/,\s*([\d.]+)\)/);
        const alpha = alphaMatch ? parseFloat(alphaMatch[1]) : 0;
        if (alpha === 1) {
          formContainerBg = color;
          containerElement = el;
          break;
        }
      }
    }
  }
  
  // Final fallback: use the last background if still nothing found
  if (!formContainerBg && backgrounds.length > 0) {
    formContainerBg = backgrounds[backgrounds.length - 1].color;
    containerElement = backgrounds[backgrounds.length - 1].element;
  }
  
  if (!formContainerBg) {
    throw new Error('Could not find form container background');
  }
  
  const hexColor = window.vortexRgbToHex(formContainerBg);
  
  return {
    color: hexColor,
    element: containerElement?.className || containerElement?.tagName || 'unknown'
  };
};

console.log('✨ Vortex theme utilities loaded:', {
  vortexRgbToHex: typeof window.vortexRgbToHex,
  vortexOklabToRgb: typeof window.vortexOklabToRgb,
  vortexExtractFormFieldBorderColor: typeof window.vortexExtractFormFieldBorderColor,
  vortexExtractFormContainerBackground: typeof window.vortexExtractFormContainerBackground
});

