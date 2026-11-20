// @ts-nocheck
/**
 * Healtence Halloween Cart Enhancements
 * Updates Free Shipping progress bar, cart reservation countdown, upsells, and discount application.
 */
(function () {
  const win = /** @type {any} */ (typeof window !== 'undefined' ? window : {});

  function getThreshold() {
    if (win.BFCM && win.BFCM.freeShippingThreshold) {
      return Number(win.BFCM.freeShippingThreshold) * 100;
    }
    return 5000;
  }

  function getDiscountCode() {
    if (win.BFCM && win.BFCM.discountCode) {
      return win.BFCM.discountCode;
    }
    if (win.HALLOWEEN && win.HALLOWEEN.discountCode) {
      return win.HALLOWEEN.discountCode;
    }
    return 'BFCM25';
  }

  function formatMoney(cents) {
    return '$' + (cents / 100).toFixed(2);
  }

  // 1. Free Shipping Banner Updater ($50+ Free US Shipping / $4.90 Flat Rate)
  function updateCartProgress(cart) {
    if (!cart) return;

    // Show or hide all banner wrappers
    document.querySelectorAll('#hwCartBannerWrap').forEach(function (bannerEl) {
      if (!cart.item_count || cart.item_count === 0) {
        bannerEl.style.display = 'none';
      } else {
        bannerEl.style.display = 'block';
      }
    });

    const threshold = getThreshold();
    const totalPrice = Number(cart.total_price) || 0;
    const isUnlocked = totalPrice >= threshold;
    const pct = threshold > 0 ? Math.min(100, Math.round((totalPrice / threshold) * 100)) : 100;

    // Update fills
    document.querySelectorAll('#hwCartShippingFill').forEach(function (fillEl) {
      fillEl.style.width = pct + '%';
    });

    // Update goal icons
    document.querySelectorAll('.hw-cart-shipping-goal-icon').forEach(function (iconEl) {
      iconEl.textContent = isUnlocked ? '🎉' : '🚚';
    });

    // Update messages
    document.querySelectorAll('#hwCartShippingMsg').forEach(function (msgEl) {
      if (isUnlocked) {
        msgEl.innerHTML = '<span><strong>You unlocked Free US Shipping!</strong> &mdash; Ships in 1&ndash;2 business days (5&ndash;10 business days US delivery)</span>';
      } else {
        const remaining = threshold - totalPrice;
        msgEl.innerHTML = '<span>Add <strong>' + formatMoney(remaining) + '</strong> more for <strong>Free US Shipping</strong> ($4.90 flat rate under $50)</span>';
      }
    });

    // Ensure checkout links carry the discount code
    ensureCheckoutDiscount();
  }

  // 2. Reservation Timer disabled (no evergreen urgency)
  function initReservationTimer() { }

  // Helper: Open the theme's cart drawer
  function openCartDrawer() {
    const drawer = document.getElementById('cart-drawer') || document.querySelector('theme-drawer#cart-drawer');
    if (drawer && typeof drawer.open === 'function') {
      drawer.open();
      return;
    }
    const dialog = document.querySelector('#cart-drawer dialog');
    if (dialog && typeof dialog.showModal === 'function' && !dialog.open) {
      try {
        dialog.showModal();
        return;
      } catch (e) {
        dialog.show();
        return;
      }
    }
    const cartIcon = document.querySelector('a[href*="/cart"], button[aria-controls*="cart"], .header-cart-icon');
    if (cartIcon) {
      cartIcon.click();
    }
  }

  // Helper: Apply rendered cart drawer section to DOM
  function applyDrawerSection(sectionHtml) {
    if (!sectionHtml) return false;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(sectionHtml, 'text/html');
      const newInner = doc.querySelector('.cart-drawer__inner');
      const currentInner = document.querySelector('#cart-drawer .cart-drawer__inner, .cart-drawer__inner');
      if (newInner && currentInner) {
        currentInner.replaceWith(newInner);
        return true;
      }
    } catch (err) {
      console.warn('Error applying drawer section:', err);
    }
    return false;
  }

  // Helper: Fetch fresh section rendering for cart-drawer-section
  async function refreshCartDrawer() {
    try {
      const res = await fetch((win.Shopify ? win.Shopify.routes.root : '/') + '?section_id=cart-drawer-section');
      if (res.ok) {
        const html = await res.text();
        return applyDrawerSection(html);
      }
    } catch (err) { }
    return false;
  }

  // Helper: Update header badges
  function updateHeaderCartCount(count) {
    if (typeof count !== 'number') return;
    document.querySelectorAll('.cart-count, .theme-drawer__badge, .header-actions__cart-icon .badge, [data-cart-count], .header-cart-count').forEach(function (el) {
      el.textContent = String(count);
      el.classList.remove('visually-hidden');
      el.style.display = count > 0 ? '' : 'none';
    });
  }

  // 3. Quick-Add for Black Friday VIP Treats (Upsell)
  win.hwAddUpsellToCart = function (/** @type {number} */ variantId, /** @type {HTMLElement|null} */ btnEl) {
    if (!variantId) return;

    let originalHtml = '';
    if (btnEl) {
      originalHtml = btnEl.innerHTML;
      btnEl.disabled = true;
      btnEl.innerHTML = '<span>Adding...</span>';
    }

    fetch((win.Shopify ? win.Shopify.routes.root : '/') + 'cart/add.js', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        id: variantId,
        quantity: 1,
        sections: 'cart-drawer-section',
        sections_url: window.location.pathname
      })
    })
      .then(function (res) { return res.json(); })
      .then(async function (data) {
        if (btnEl) {
          btnEl.innerHTML = '<span>✓ Added</span>';
          btnEl.classList.add('hw-btn-added');

          // Hide the item after a short delay so drawer stays tidy
          const itemRow = btnEl.closest('.hw-cart-upsell-item');
          if (itemRow) {
            setTimeout(function () {
              itemRow.style.transition = 'opacity 0.3s, max-height 0.3s';
              itemRow.style.opacity = '0';
              itemRow.style.maxHeight = '0';
              setTimeout(function () { itemRow.remove(); }, 350);
            }, 800);
          }
        }

        let applied = false;
        if (data.sections && data.sections['cart-drawer-section']) {
          applied = applyDrawerSection(data.sections['cart-drawer-section']);
        }
        if (!applied) {
          await refreshCartDrawer();
        }

        if (typeof data.item_count === 'number') {
          updateHeaderCartCount(data.item_count);
        }

        // Notify Horizon theme components
        window.dispatchEvent(new CustomEvent('cart:updated', { detail: { cart: data } }));
        window.dispatchEvent(new CustomEvent('cart:refresh', { detail: { cart: data } }));
        document.dispatchEvent(new CustomEvent('cart:change', { detail: { cart: data } }));

        fetchAndRefresh();
      })
      .catch(function (err) {
        console.error('Upsell add error:', err);
        if (btnEl) {
          btnEl.innerHTML = originalHtml;
          btnEl.disabled = false;
        }
      });
  };

  // 4. 1-Click Coupon Code Application
  win.hwApplyCartDiscount = function (/** @type {string} */ code, /** @type {HTMLElement|null} */ btnEl) {
    const discount = code || getDiscountCode();

    if (navigator.clipboard) {
      navigator.clipboard.writeText(discount).catch(function () { });
    }

    if (btnEl) {
      btnEl.innerHTML = '<span>✓ Applied!</span>';
      btnEl.classList.add('hw-btn-applied');
    }

    const noteEl = document.getElementById('hwCartCouponNote');
    if (noteEl) {
      noteEl.innerHTML = '<span>🎉 Code <strong>' + discount + '</strong> will be automatically applied at checkout!</span>';
      noteEl.style.color = 'var(--hw-green)';
    }

    // Try applying to native cart discount form if available
    const discountInput = document.getElementById('cart-discount');
    if (discountInput) {
      /** @type {HTMLInputElement} */ (discountInput).value = discount;
      const form = discountInput.closest('form');
      if (form) {
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
          /** @type {HTMLButtonElement} */ (submitBtn).click();
        }
      }
    }

    ensureCheckoutDiscount(discount);
  };

  // 5. Ensure Checkout Buttons Append ?discount=BFCM25
  function ensureCheckoutDiscount(customCode) {
    const code = customCode || getDiscountCode();
    const checkoutButtons = document.querySelectorAll('button[name="checkout"], #checkout, a[href*="/checkout"]');

    checkoutButtons.forEach(function (btn) {
      if (btn && btn.tagName && btn.tagName.toLowerCase() === 'a' && btn.href) {
        try {
          const url = new URL(/** @type {HTMLAnchorElement} */(btn).href, window.location.origin);
          if (!url.searchParams.has('discount')) {
            url.searchParams.set('discount', code);
            /** @type {HTMLAnchorElement} */ (btn).href = url.toString();
          }
        } catch (err) { }
      }
    });

    const cartForms = document.querySelectorAll('form[action*="/cart"], form[action*="/checkout"], form#cart-form');
    cartForms.forEach(function (form) {
      let input = form.querySelector('input[name="discount"]');
      if (!input) {
        input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'discount';
        input.value = code;
        form.appendChild(input);
      } else {
        /** @type {HTMLInputElement} */ (input).value = code;
      }
    });
  }

  // 6. Universal Product Card Quick Add Handler
  function initProductCardQuickAdd() {
    document.addEventListener('click', function (e) {
      if (!(e.target instanceof Element)) return;
      const btn = e.target.closest('.hw-quick-add-btn');
      if (!btn || btn.disabled || btn.classList.contains('is-sold-out')) return;

      e.preventDefault();
      e.stopPropagation();

      const variantId = btn.getAttribute('data-variant-id');
      const productUrl = btn.getAttribute('data-product-url');
      const label = btn.querySelector('.hw-quick-add-label');
      const originalText = label ? label.textContent : 'Quick Add';

      if (!variantId) {
        if (productUrl) window.location.href = productUrl;
        return;
      }

      // Visual feedback
      btn.style.pointerEvents = 'none';
      if (label) label.textContent = 'Adding...';

      fetch((win.Shopify ? win.Shopify.routes.root : '/') + 'cart/add.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          id: variantId,
          quantity: 1,
          sections: 'cart-drawer-section',
          sections_url: window.location.pathname
        })
      })
        .then(function (res) {
          if (!res.ok) throw new Error('Add to cart failed');
          return res.json();
        })
        .then(async function (data) {
          if (label) label.textContent = '✓ Added';

          let applied = false;
          if (data.sections && data.sections['cart-drawer-section']) {
            applied = applyDrawerSection(data.sections['cart-drawer-section']);
          }
          if (!applied) {
            await refreshCartDrawer();
          }

          if (typeof data.item_count === 'number') {
            updateHeaderCartCount(data.item_count);
          }

          // Refresh cart states & trigger cart drawer
          document.dispatchEvent(new CustomEvent('cart:updated', { bubbles: true, detail: { cart: data } }));
          document.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true, detail: { cart: data } }));
          window.dispatchEvent(new CustomEvent('cart:refresh'));

          fetchAndRefresh();

          // Open cart drawer immediately with newly populated items
          openCartDrawer();

          setTimeout(function () {
            if (label) label.textContent = originalText;
            btn.style.pointerEvents = '';
          }, 1200);
        })
        .catch(function (err) {
          console.warn('Quick Add redirecting to product page:', err);
          if (productUrl) {
            window.location.href = productUrl;
          } else {
            if (label) label.textContent = originalText;
            btn.style.pointerEvents = '';
          }
        });
    });
  }

  function fetchAndRefresh() {
    fetch('/cart.js')
      .then(function (res) { return res.json(); })
      .then(function (cart) {
        updateCartProgress(cart);
        if (typeof cart.item_count === 'number') {
          updateHeaderCartCount(cart.item_count);
        }
      })
      .catch(function (err) { });
  }

  function bootCartEngine() {
    fetchAndRefresh();
    initReservationTimer();
    ensureCheckoutDiscount();
    initProductCardQuickAdd();

    // Listen to standard Shopify AJAX Cart updates
    document.addEventListener('cart:updated', fetchAndRefresh);
    document.addEventListener('cart:change', fetchAndRefresh);
    window.addEventListener('cart:refresh', fetchAndRefresh);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootCartEngine, { once: true });
  } else {
    bootCartEngine();
  }
})();
