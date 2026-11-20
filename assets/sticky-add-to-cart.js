import { Component } from '@theme/component';
import { ThemeEvents, QuantitySelectorUpdateEvent } from '@theme/events';
import { morph } from '@theme/morph';
import { onAnimationEnd } from '@theme/utilities';
import { StandardEvents, ProductSelectEvent, CartLinesUpdateEvent, CartErrorEvent } from '@shopify/events';

/**
 * @typedef {Object} ProductVariant
 * @property {string|number} [id] - Variant ID
 * @property {string} [title] - Variant title
 * @property {string} [name] - Variant name
 * @property {boolean} [available] - Whether variant is available
 * @property {Object} [featured_media] - Featured media object
 * @property {Object} [featured_media.preview_image] - Preview image data
 * @property {string} [featured_media.preview_image.src] - Image source URL
 * @property {string} [featured_media.alt] - Alt text for the image
 */

/**
 * @typedef {HTMLElement & {
 *   source: Element,
 *   destination: Element,
 *   useSourceSize: string | boolean
 * }} FlyToCart
 */

/**
 * @typedef {Object} StickyAddToCartRefs
 * @property {HTMLElement} stickyBar - The floating bar container
 * @property {HTMLButtonElement} addToCartButton - Sticky bar's button
 * @property {HTMLElement} quantityDisplay - Quantity display container
 * @property {HTMLElement} quantityNumber - Quantity number element
 * @property {HTMLImageElement} productImage - Product image element
 */

/**
 * A custom element that manages a sticky add-to-cart bar.
 * Shows when the main buy buttons scroll out of view.
 *
 * @extends {Component<StickyAddToCartRefs>}
 */
class StickyAddToCartComponent extends Component {
  requiredRefs = ['stickyBar', 'addToCartButton'];

  /** @type {IntersectionObserver | null} */
  #buyButtonsIntersectionObserver = null;

  /** @type {IntersectionObserver | null} */
  #mainBottomObserver = null;

  /** @type {number | undefined} */
  #resetTimeout;

  /** @type {boolean} */
  #isStuck = false;

  /** @type {number | null} */
  #animationTimeout = null;

  /** @type {AbortController} */
  #abortController = new AbortController();

  /** @type {HTMLButtonElement | null} */
  #targetAddToCartButton = null;

  /** @type {number} */
  #currentQuantity = 1;

  /** @type {boolean} */
  #hiddenByBottom = false;

  connectedCallback() {
    super.connectedCallback();

    // Never initialize or display sticky add-to-cart within quick-add modals
    if (this.closest('quick-add-dialog') || this.closest('.quick-add-modal') || this.closest('#quick-add-dialog')) {
      this.style.display = 'none';
      return;
    }

    this.#setupIntersectionObserver();

    const { signal } = this.#abortController;
    const target = this.closest('.shopify-section');
    target?.addEventListener(StandardEvents.productSelect, this.#handleProductSelect, { signal });

    document.addEventListener(StandardEvents.cartLinesUpdate, this.#handleCartAddComplete, { signal });
    document.addEventListener(StandardEvents.cartError, this.#handleCartAddComplete, { signal });
    document.addEventListener(ThemeEvents.quantitySelectorUpdate, this.#handleQuantityUpdate, { signal });

    // Precise scroll and resize tracking to ensure sticky cart NEVER shows while main Add to Cart is on screen
    window.addEventListener('scroll', this.#updateStickyBarVisibility, { passive: true, signal });
    window.addEventListener('resize', this.#updateStickyBarVisibility, { passive: true, signal });

    this.#getInitialQuantity();

    // IntersectionObserver callbacks gate visibility on #isChatActive(), but
    // if the shopper scrolls before the Inbox bundle has upgraded
    // <shopify-chat>, the bar shows and nothing re-runs that check. Hide it
    // once the element is defined so the bar doesn't overlap the chat UI.
    customElements.whenDefined('shopify-chat').then(() => {
      if (signal.aborted) return;
      if (this.#isStuck && this.#isChatActive()) this.#hideStickyBar();
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#buyButtonsIntersectionObserver?.disconnect();
    this.#mainBottomObserver?.disconnect();
    this.#abortController.abort();
    if (this.#animationTimeout) {
      clearTimeout(this.#animationTimeout);
    }
  }

  /**
   * Checks whether the main Add to Cart button is currently visible on screen.
   * Sticky bar MUST NOT be shown if the button is visible on screen.
   * @returns {boolean}
   */
  #isMainAddToCartOnScreen() {
    const buttons = document.querySelectorAll(
      '.product-information [ref="addToCartButton"], .product-details .add-to-cart-button, .product-form .add-to-cart-button, .buy-buttons-block .add-to-cart-button, [data-testid="add-to-cart-button"]'
    );
    for (const btn of buttons) {
      if (btn.closest('sticky-add-to-cart') || btn.closest('.sticky-add-to-cart__bar')) {
        continue;
      }
      const rect = btn.getBoundingClientRect();
      // Returns true if button has geometry and intersects the viewport
      if (rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight) {
        return true;
      }
    }
    return false;
  }

  /**
   * Checks if user has scrolled PAST the main Add to Cart button (button is above the top of viewport)
   * @returns {boolean}
   */
  #isMainAddToCartScrolledPast() {
    const productForm = this.#getProductForm();
    const btn =
      productForm?.querySelector('[ref="addToCartButton"]') ||
      productForm?.closest('.buy-buttons-block') ||
      document.querySelector('.product-details .add-to-cart-button');
    if (!btn) return false;
    const rect = btn.getBoundingClientRect();
    // Button is completely above viewport
    return rect.bottom <= 0;
  }

  /**
   * Evaluates sticky cart visibility strictly based on button position
   */
  #updateStickyBarVisibility = () => {
    // Rule: Hide immediately if main Add to Cart button is ANYWHERE on screen
    if (this.#isMainAddToCartOnScreen()) {
      if (this.#isStuck) this.#hideStickyBar();
      return;
    }

    // Rule: Only show if user has scrolled PAST the button (button is completely above viewport)
    if (!this.#isMainAddToCartScrolledPast()) {
      if (this.#isStuck) this.#hideStickyBar();
      return;
    }

    // Rule: Hide if near footer or chat is active
    if (this.#hiddenByBottom || this.#isChatActive()) {
      if (this.#isStuck) this.#hideStickyBar();
      return;
    }

    // Otherwise show
    if (!this.#isStuck) {
      this.#showStickyBar();
    }
  };

  /**
   * Sets up the IntersectionObserver to watch the buy buttons visibility
   */
  #setupIntersectionObserver() {
    const productForm = this.#getProductForm();
    if (!productForm) return;

    const buyButtonsBlock = productForm.closest('.buy-buttons-block');
    if (!buyButtonsBlock) return;

    // Observe footer / recommendations to hide sticky bar at page bottom
    const bottomBoundary =
      document.querySelector('.product-recommendations') ??
      document.querySelector('[id*="product_recommendations"]') ??
      document.querySelector('footer') ??
      document.querySelector('[class*="footer-group"]');

    // Observer for buy buttons visibility with multiple thresholds
    this.#buyButtonsIntersectionObserver = new IntersectionObserver(() => {
      this.#updateStickyBarVisibility();
    }, {
      threshold: [0, 0.25, 0.5, 0.75, 1.0]
    });

    if (bottomBoundary) {
      this.#mainBottomObserver = new IntersectionObserver(
        (entries) => {
          const [entry] = entries;
          if (!entry) return;
          this.#hiddenByBottom = entry.isIntersecting;
          this.#updateStickyBarVisibility();
        },
        {
          rootMargin: '100px 0px 0px 0px',
        }
      );
      this.#mainBottomObserver.observe(bottomBoundary);
    }

    this.#buyButtonsIntersectionObserver.observe(buyButtonsBlock);
    this.#targetAddToCartButton = productForm.querySelector('[ref="addToCartButton"]');

    // Run initial evaluation
    this.#updateStickyBarVisibility();
  }

  // Public action handlers
  /**
   * Handles the add to cart button click in the sticky bar
   */
  handleAddToCartClick = async () => {
    // If button is configured to scroll to restock waitlist, smoothly scroll there instead of adding to cart
    if (this.refs.addToCartButton?.getAttribute('data-action') === 'scroll-to-waitlist') {
      const waitlistCard = document.getElementById('bfcmWaitlistCard');
      if (waitlistCard) {
        waitlistCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const emailInput = waitlistCard.querySelector('input[type="email"]');
        if (emailInput) emailInput.focus();
      }
      return;
    }

    if (!this.#targetAddToCartButton) return;
    if (this.#targetAddToCartButton.disabled) return;
    this.#targetAddToCartButton.dataset.puppet = 'true';
    this.#targetAddToCartButton.click();
    const cartIcon = document.querySelector('.header-actions__cart-icon');

    if (this.refs.addToCartButton.dataset.added !== 'true') {
      this.refs.addToCartButton.dataset.added = 'true';
    }

    if (!cartIcon || !this.refs.addToCartButton || !this.refs.productImage) return;
    if (this.#resetTimeout) clearTimeout(this.#resetTimeout);

    const flyToCartElement = /** @type {FlyToCart} */ (document.createElement('fly-to-cart'));
    const sourceStyles = getComputedStyle(this.refs.productImage);

    flyToCartElement.classList.add('fly-to-cart--sticky');
    flyToCartElement.style.setProperty('background-image', `url(${this.refs.productImage.src})`);
    flyToCartElement.useSourceSize = 'true';
    flyToCartElement.source = this.refs.productImage;
    flyToCartElement.destination = cartIcon;

    document.body.appendChild(flyToCartElement);

    await onAnimationEnd([this.refs.addToCartButton, flyToCartElement]);
    this.#resetTimeout = setTimeout(() => {
      this.refs.addToCartButton.removeAttribute('data-added');
    }, 800);
  };

  /**
   * Handles product select events (variant selected and updated)
   * @param {ProductSelectEvent} event - The product select event
   */
  #handleProductSelect = (event) => {
    if (!(event.target instanceof Element) || event.target.closest('product-card')) return;

    // Update variant ID from the event detail (variant:selected part)
    const { optionValueId } = event.detail ?? {};
    if (optionValueId) {
      this.dataset.currentVariantId = optionValueId;
    }

    // Wait for the promise to resolve with variant update data
    event.promise
      .then(({ detail }) => {
        if (!detail?.html) return;

        const { html, productId, resource: variant } = detail;

        if (productId && productId !== this.dataset.productId) return;

        // Get the new sticky add to cart HTML from the server response
        const newStickyAddToCart = /** @type {HTMLElement | null} */ (html.querySelector('sticky-add-to-cart'));
        if (!newStickyAddToCart) return;

        const newStickyBar = newStickyAddToCart.querySelector('[ref="stickyBar"]');
        if (!newStickyBar) return;

        // Store current visibility state before morphing
        const currentStuck = this.refs.stickyBar.getAttribute('data-stuck') || 'false';
        const variantAvailable = newStickyAddToCart.dataset.variantAvailable;

        // Morph the entire sticky bar content
        morph(this.refs.stickyBar, newStickyBar, { childrenOnly: true });

        // Restore visibility state after morphing
        this.refs.stickyBar.setAttribute('data-stuck', currentStuck);
        this.dataset.variantAvailable = variantAvailable;

        // Update the dataset attributes with new variant info
        if (variant && variant.id) {
          this.dataset.currentVariantId = variant.id;
        }

        // Re-cache the target add to cart button after morphing
        const productForm = this.#getProductForm();
        if (productForm) {
          this.#targetAddToCartButton = productForm.querySelector('[ref="addToCartButton"]');
        }

        if (variant == null) {
          this.#handleVariantUnavailable();
        }
        // Restore the current quantity display if needed
        this.#updateButtonText();
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') console.warn('[sticky-add-to-cart] Event promise rejected:', error);
      });
  };

  /**
   * Updates the variant title based on selected options when the variant is unavailable
   */
  #handleVariantUnavailable = () => {
    this.dataset.currentVariantId = '';
    const variantTitleElement = this.querySelector('.sticky-add-to-cart__variant');
    const productId = this.dataset.productId;
    const variantPicker = document.querySelector(`variant-picker[data-product-id="${productId}"]`);
    if (!variantTitleElement || !variantPicker) return;

    const selectedOptions = Array.from(variantPicker.querySelectorAll('input:checked'))
      .map((option) => /** @type {HTMLInputElement} */ (option).value)
      .filter((value) => value !== '')
      .join(' / ');
    if (!selectedOptions) return;
    variantTitleElement.textContent = selectedOptions;
  };

  /**
   * Handles cart add complete (success or error) - resets puppet flag
   * @param {CartLinesUpdateEvent | CartErrorEvent} event - The cart event
   */
  #handleCartAddComplete = (event) => {
    // Reset the puppet flag only after the cart operation's promise settles,
    // not when the event is first dispatched (before the HTTP request completes).
    const resetPuppet = () => {
      if (this.#targetAddToCartButton) {
        this.#targetAddToCartButton.dataset.puppet = 'false';
      }
    };

    // CartLinesUpdateEvent has a promise; CartErrorEvent does not (error already happened).
    if ('promise' in event && event.promise instanceof Promise) {
      event.promise.finally(resetPuppet);
    } else {
      resetPuppet();
    }
  };

  /**
   * Handles quantity selector update events
   * @param {QuantitySelectorUpdateEvent} event - The quantity update event
   */
  #handleQuantityUpdate = (event) => {
    // Only respond to product page quantity selector updates, not cart drawer
    if (event.detail.cartLine) return;

    this.#currentQuantity = event.detail.quantity;
    this.#updateButtonText();
  };

  /**
   * Shows the sticky bar with animation
   */
  #showStickyBar() {
    const { stickyBar } = this.refs;
    this.#isStuck = true;
    stickyBar.dataset.stuck = 'true';
  }

  /**
   * Hides the sticky bar with animation
   */
  #hideStickyBar() {
    const { stickyBar } = this.refs;
    this.#isStuck = false;
    stickyBar.dataset.stuck = 'false';
  }

  // Helper methods
  /**
   * Checks whether the Shopify Chat is active on the page.
   * When active, the sticky bar must stay hidden to avoid overlapping the chat UI.
   *
   * <shopify-chat> is rendered unconditionally by chat-drawer.liquid, but
   * the "Ask anything" button only paints once the Inbox app has installed
   * and upgraded the element. Gate on the registration of the custom element
   * (the same signal chat-drawer.liquid uses via customElements.whenDefined)
   * so the inert placeholder on shops without Inbox doesn't suppress the
   * sticky bar.
   *
   * @returns {boolean}
   */
  #isChatActive() {
    if (!customElements.get('shopify-chat')) return false;
    return Boolean(document.querySelector('shopify-chat'));
  }

  /**
   * Gets the product form element
   * @returns {HTMLElement | null}
   */
  #getProductForm() {
    const productId = this.dataset.productId;
    if (!productId) return null;

    const sectionElement = this.closest('.shopify-section');
    if (!sectionElement) return null;

    const sectionId = sectionElement.id.replace('shopify-section-', '');
    return document.querySelector(
      `#shopify-section-${sectionId} product-form-component[data-product-id="${productId}"]`
    );
  }

  /**
   * Gets the initial quantity from the data attribute
   */
  #getInitialQuantity() {
    this.#currentQuantity = parseInt(this.dataset.initialQuantity || '1') || 1;
    this.#updateButtonText();
  }

  /**
   * Updates the button text to include quantity
   */
  #updateButtonText() {
    const { addToCartButton, quantityDisplay, quantityNumber } = this.refs;
    if (!addToCartButton) return;

    const available = !addToCartButton.disabled;

    // Update the quantity number if ref is present
    if (quantityNumber) {
      quantityNumber.textContent = this.#currentQuantity.toString();
    }

    // Show/hide the quantity display based on availability and quantity
    if (quantityDisplay) {
      if (available && this.#currentQuantity > 1) {
        quantityDisplay.style.display = 'inline';
      } else {
        quantityDisplay.style.display = 'none';
      }
    }
  }
}

if (!customElements.get('sticky-add-to-cart')) {
  customElements.define('sticky-add-to-cart', StickyAddToCartComponent);
}
