import { Component } from '@theme/component';
import { StandardEvents, ProductSelectEvent } from '@shopify/events';

/**
 * @typedef {Object} ProductPriceRefs
 * @property {HTMLElement} priceContainer
 * @property {HTMLElement} [volumePricingNote]
 */

/**
 * @typedef {Object} ProductVariant
 * @property {number | string} id
 * @property {number} price
 * @property {number | null} [compare_at_price]
 * @property {boolean} [available]
 * @property {string | null} [option1]
 * @property {string | null} [option2]
 * @property {string | null} [option3]
 * @property {string | null} [title]
 */

/**
 * @typedef {{ name?: string, value: string } | string} SelectedOption
 */

/**
 * @typedef {Window & typeof globalThis & { __PRODUCT_VARIANTS__?: ProductVariant[] }} WindowWithProductVariants
 */

/**
 * A custom element that displays a product price.
 * This component listens for variant update events and updates the price display accordingly.
 * It handles price updates from two different sources:
 * 1. Variant picker (in quick add modal or product page)
 * 2. Swatches variant picker (in product cards)
 *
 * @extends {Component<ProductPriceRefs>}
 */
class ProductPrice extends Component {
  /** @type {Element | null} */
  #closestSection = null;
  /** @type {MutationObserver | null} */
  #priceObserver = null;

  connectedCallback() {
    super.connectedCallback();
    this.#closestSection = this.closest('.shopify-section, dialog');
    if (!this.#closestSection) return;
    this.#closestSection.addEventListener(StandardEvents.productSelect, this.#handleProductSelect);
    this.#initDealCardObserver();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#priceObserver?.disconnect();
    this.#priceObserver = null;
    if (!this.#closestSection) return;
    this.#closestSection.removeEventListener(StandardEvents.productSelect, this.#handleProductSelect);
    this.#closestSection = null;
  }

  /**
   * Initializes automatic price synchronization between the main PDP price and the Black Friday Deal Card.
   */
  #initDealCardObserver() {
    const currentPriceEl = this.querySelector('.relief-price-current, .price-item--sale, .price-item--regular');
    if (!currentPriceEl) return;

    const syncFromElement = () => {
      const clone = /** @type {HTMLElement} */ (currentPriceEl.cloneNode(true));
      clone.querySelectorAll('.visually-hidden').forEach((sr) => sr.remove());
      const text = clone.textContent?.trim() || '';
      if (text) {
        this.#syncDealCardPrice(text);
      }
    };

    syncFromElement();

    if (typeof MutationObserver !== 'undefined') {
      this.#priceObserver?.disconnect();
      this.#priceObserver = new MutationObserver(syncFromElement);
      this.#priceObserver.observe(currentPriceEl, { childList: true, characterData: true, subtree: true });
    }
  }

  /**
   * Handles product select event and updates the price.
   * @param {ProductSelectEvent} event - The product select event.
   */
  #handleProductSelect = (event) => {
    if (!(event.target instanceof Element) || event.target.closest('product-card')) return;

    // --- INSTANT OPTIMISTIC CLIENT-SIDE PRICE UPDATE (0ms) ---
    const eventProductId = event.product?.id;
    if (!eventProductId || !this.dataset.productId || String(eventProductId) === String(this.dataset.productId)) {
      const anyEvent = /** @type {any} */ (event);
      const variantId = anyEvent.detail?.variantId;
      this.#updatePriceImmediately(
        typeof variantId === 'string' || typeof variantId === 'number' ? variantId : undefined,
        event.selectedOptions
      );
    }

    event.promise
      ?.then(({ detail }) => {
        if (!detail?.html) return;

        const { html, newProduct } = detail;

        if (newProduct) {
          this.dataset.productId = newProduct.id;
        } else if (detail.productId && detail.productId !== this.dataset.productId) {
          return;
        }

        if (!this.dataset.blockId) return;

        const priceContainer = this.querySelector('[ref="priceContainer"]') || this.refs.priceContainer;
        const volumePricingNote = this.querySelector('[ref="volumePricingNote"]') || this.refs.volumePricingNote;
        // Find the new product-price element in the updated HTML
        const newProductPrice = html.querySelector(`product-price[data-block-id="${this.dataset.blockId}"]`);
        if (!newProductPrice) return;

        // Update price container
        const newPrice = newProductPrice.querySelector('[ref="priceContainer"]');
        if (newPrice && priceContainer) {
          priceContainer.replaceWith(newPrice);
          this.#initDealCardObserver();
        }

        // Defensive check: ensure replaced price container matches the authoritative selected variant
        const anyEvent = /** @type {any} */ (event);
        const selectedVariant = this.#findVariant(anyEvent.detail?.variantId, event.selectedOptions);
        if (selectedVariant) {
          const currentVariantPrice = Number(selectedVariant.price) || 0;
          const currentDisplayedText = this.querySelector('.relief-price-current, .price-item--sale, .price-item--regular')?.textContent || '';
          const currentDisplayedNum = Math.round(Number.parseFloat(currentDisplayedText.replace(/[^0-9.]/g, '')) * 100);
          if (currentVariantPrice && currentDisplayedNum && currentVariantPrice !== currentDisplayedNum) {
            this.#updatePriceImmediately(selectedVariant.id, event.selectedOptions);
          }
        }

        // Keep PDP Black Friday Deal Card VIP net price strictly synced
        const serverMainPrice = this.querySelector('.relief-price-current, .price-item--sale, .price-item--regular');
        if (serverMainPrice) {
          const clone = /** @type {HTMLElement} */ (serverMainPrice.cloneNode(true));
          clone.querySelectorAll('.visually-hidden').forEach((sr) => sr.remove());
          const mainPriceText = clone.textContent?.trim() || '';
          if (mainPriceText) {
            this.#syncDealCardPrice(mainPriceText);
          }
        }

        // Update volume pricing note
        const newNote = newProductPrice.querySelector('[ref="volumePricingNote"]');
        if (!newNote) {
          volumePricingNote?.remove();
        } else if (!volumePricingNote) {
          // Use newPrice since priceContainer was just replaced and now points to the detached element
          newPrice?.insertAdjacentElement('afterend', /** @type {Element} */ (newNote.cloneNode(true)));
        } else {
          volumePricingNote.replaceWith(newNote);
        }

        // Update installments (SPI banner) variant ID to trigger payment terms re-render
        const installmentsInput = /** @type {HTMLInputElement | null} */ (
          this.querySelector(`#product-form-installment-${this.dataset.blockId} input[name="id"]`)
        );
        if (installmentsInput) {
          installmentsInput.value = detail.resource?.id ?? '';
          installmentsInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') console.warn('[product-price] Event promise rejected:', error);
      });
  };

  /**
   * Retrieves cached product variants JSON for optimistic price updates.
   * @returns {ProductVariant[]}
   */
  #getVariantsData() {
    const win = /** @type {WindowWithProductVariants} */ (window);
    if (Array.isArray(win.__PRODUCT_VARIANTS__)) {
      return win.__PRODUCT_VARIANTS__;
    }
    const script =
      document.getElementById('bfcmProductVariantsJson') ||
      document.querySelector('script[data-bfcm-variants]');
    if (script) {
      try {
        const data = JSON.parse(script.textContent || '[]');
        if (Array.isArray(data)) {
          win.__PRODUCT_VARIANTS__ = data;
          return data;
        }
      } catch {
        // Ignore malformed variant JSON
      }
    }
    return [];
  }

  /**
   * Finds a matching variant by ID or selected option values.
   * @param {string | number | undefined} variantId
   * @param {SelectedOption[] | undefined} selectedOptions
   * @returns {ProductVariant | null}
   */
  #findVariant(variantId, selectedOptions) {
    const variants = this.#getVariantsData();
    if (!variants.length) return null;

    if (variantId !== undefined && variantId !== '') {
      const match = variants.find((v) => String(v.id) === String(variantId));
      if (match) return match;
    }

    if (Array.isArray(selectedOptions) && selectedOptions.length) {
      const optVals = selectedOptions
        .map((opt) => (typeof opt === 'object' && opt !== null ? opt.value : opt || '').toLowerCase().trim())
        .filter(Boolean);
      const match = variants.find((v) => {
        const vOpts = [v.option1, v.option2, v.option3].filter(Boolean).map((o) => String(o).toLowerCase().trim());
        return optVals.every((val) => vOpts.includes(val) || (v.title && v.title.toLowerCase().includes(val)));
      });
      if (match) return match;
    }

    return null;
  }

  /**
   * Updates visible price text inside an element while preserving any `.visually-hidden` label span.
   * @param {Element} el
   * @param {string} formattedPrice
   * @param {string} [srPrefix]
   */
  #setPriceText(el, formattedPrice, srPrefix) {
    const srEl = el.querySelector('.visually-hidden');
    if (srEl) {
      if (srPrefix) srEl.textContent = srPrefix;
      el.replaceChildren(srEl, document.createTextNode(` ${formattedPrice}`));
    } else {
      el.textContent = formattedPrice;
    }
  }

  /**
   * Syncs the PDP Black Friday Deal Card price display with the active variant price.
   * @param {string} formattedPrice
   */
  #syncDealCardPrice(formattedPrice) {
    // Custom VIP deal card removed per Task 1
    return;
  }

  /**
   * Performs an optimistic price and stock badge update before the section fetch resolves.
   * @param {string | number | undefined} variantId
   * @param {SelectedOption[] | undefined} selectedOptions
   */
  #updatePriceImmediately(variantId, selectedOptions) {
    const variant = this.#findVariant(variantId, selectedOptions);
    if (!variant) return;

    const price = Number(variant.price) || 0;
    const comparePrice = Number(variant.compare_at_price) || 0;
    const hasDiscount = comparePrice > price;
    /** @param {number} cents */
    const format = (cents) => '$' + (Number(cents) / 100).toFixed(2);
    const formattedPrice = format(price);

    const currentPriceEl = this.querySelector(
      '.relief-price-current, .price-item--sale, .price-item--regular'
    );
    if (currentPriceEl) {
      this.#setPriceText(
        currentPriceEl,
        formattedPrice,
        hasDiscount ? 'Sale price: ' : 'Regular price: '
      );
    }

    this.#syncDealCardPrice(formattedPrice);

    const comparePriceEl = this.querySelector(
      '.relief-price-compare, .compare-at-price'
    );
    const saveBadgeEl = this.querySelector('.relief-price-save-badge');

    if (hasDiscount) {
      if (comparePriceEl instanceof HTMLElement) {
        this.#setPriceText(comparePriceEl, format(comparePrice));
        comparePriceEl.style.display = 'inline-block';
      }
      if (saveBadgeEl instanceof HTMLElement) {
        const pct = Math.round(((comparePrice - price) / comparePrice) * 100);
        saveBadgeEl.textContent = `SAVE ${pct}% OFF`;
        saveBadgeEl.style.display = 'inline-block';
      }
    } else {
      if (comparePriceEl instanceof HTMLElement) comparePriceEl.style.display = 'none';
      if (saveBadgeEl instanceof HTMLElement) saveBadgeEl.style.display = 'none';
    }

    const instockBadgeEl = this.querySelector('.relief-instock-badge');
    if (instockBadgeEl) {
      const isAvailable = variant.available !== false;
      instockBadgeEl.className =
        'relief-instock-badge ' + (isAvailable ? 'relief-instock--in' : 'relief-instock--out');
      const dot = instockBadgeEl.querySelector('.relief-instock-dot');
      if (dot) {
        dot.className =
          'relief-instock-dot' + (isAvailable ? '' : ' relief-instock-dot--out');
      }
      const text = instockBadgeEl.querySelector('.relief-instock-text');
      if (text) {
        text.textContent = isAvailable
          ? 'IN STOCK — Ships within 1–2 business days'
          : 'Out of stock';
      }
    }
  }
}

if (!customElements.get('product-price')) {
  customElements.define('product-price', ProductPrice);
}
