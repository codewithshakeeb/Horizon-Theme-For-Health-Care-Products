// @ts-nocheck
/**
 * Healtence Black Friday / Cyber Monday (BFCM) 2026 Engine
 * High-converting countdown synchronizer, real-time variant pricing,
 * dynamic savings calculator, and interactive restock waitlist.
 */
(function() {
  'use strict';
  const win = typeof window !== 'undefined' ? window : {};

  // =========================================================================
  // 1. DUAL-PHASE BLACK FRIDAY & CYBER MONDAY COUNTDOWN TIMER
  // =========================================================================
  const BF_MIDNIGHT_EST = new Date('2026-11-27T23:59:59-05:00').getTime();
  const CM_MIDNIGHT_EST = new Date('2026-11-30T23:59:59-05:00').getTime();

  function getTargetDate() {
    const now = Date.now();
    // Rollover to Cyber Monday once Black Friday concludes
    if (now <= BF_MIDNIGHT_EST) {
      return { target: BF_MIDNIGHT_EST, phase: 'BF', label: 'Black Friday VIP Sale Ends in:' };
    } else if (now <= CM_MIDNIGHT_EST) {
      return { target: CM_MIDNIGHT_EST, phase: 'CM', label: 'Cyber Monday VIP Sale Ends in:' };
    }
    // Fallback if settings provide a custom date
    if (win.BFCM && win.BFCM.endDate) {
      const customEnd = new Date(win.BFCM.endDate).getTime();
      if (!isNaN(customEnd) && now <= customEnd) {
        return { target: customEnd, phase: 'EXT', label: 'VIP Cyber Sale Ends in:' };
      }
    }
    return { target: CM_MIDNIGHT_EST, phase: 'ENDED', label: 'VIP Sale Concluded' };
  }

  function pad(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function updateCountdowns() {
    const now = Date.now();
    const { target, phase, label } = getTargetDate();
    const distance = target - now;

    if (distance <= 0) {
      document.querySelectorAll('.hw-timer-digits, #hw-top-timer-display, #hwProductTimer, #hwMobileTimerDigits, #hwStickyBarDigits').forEach(function(el) {
        el.textContent = '00d : 00h : 00m : 00s';
      });
      return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    const shortStr = `${days}d : ${pad(hours)}h : ${pad(minutes)}m`;
    const fullStr = `${days}d : ${pad(hours)}h : ${pad(minutes)}m : ${pad(seconds)}s`;

    // 1. Top Announcement Bar Timer
    const topDisplay = document.getElementById('hw-top-timer-display');
    if (topDisplay) topDisplay.textContent = shortStr;

    // 2. Mobile Sticky Bar Timer
    const mobileDisplay = document.getElementById('hwMobileTimerDigits');
    if (mobileDisplay) mobileDisplay.textContent = shortStr;

    // 3. PDP Deal Box Timer
    const prodDisplay = document.getElementById('hwProductTimer');
    if (prodDisplay) prodDisplay.textContent = fullStr;

    // 4. Sticky Promo Bar Timer
    const stickyDigits = document.getElementById('hwStickyBarDigits');
    if (stickyDigits) stickyDigits.textContent = fullStr;

    // 5. Homepage Strip Individual Unit Boxes
    document.querySelectorAll('#hwDays, .hw-days').forEach(function(el) { el.textContent = pad(days); });
    document.querySelectorAll('#hwHours, .hw-hours').forEach(function(el) { el.textContent = pad(hours); });
    document.querySelectorAll('#hwMins, .hw-mins').forEach(function(el) { el.textContent = pad(minutes); });
    document.querySelectorAll('#hwSecs, .hw-secs').forEach(function(el) { el.textContent = pad(seconds); });

    // Dynamic Phase Label Synchronizer
    document.querySelectorAll('.hw-strip-main-heading, .hw-pdp-timer-label span').forEach(function(lbl) {
      if (lbl && !lbl.dataset.customized) {
        lbl.textContent = label;
      }
    });
  }

  // =========================================================================
  // 2. 1-CLICK CLIPBOARD COPY HELPER
  // =========================================================================
  win.copyHalloweenCode = function(code, btnEl) {
    const promoCode = code || (win.BFCM && win.BFCM.discountCode) || 'BFCM25';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(promoCode).then(function() {
        showCopyFeedback(btnEl);
      }).catch(function() {
        fallbackCopy(promoCode, btnEl);
      });
    } else {
      fallbackCopy(promoCode, btnEl);
    }
  };

  function fallbackCopy(text, btnEl) {
    try {
      const tempInput = document.createElement('input');
      tempInput.value = text;
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand('copy');
      document.body.removeChild(tempInput);
      showCopyFeedback(btnEl);
    } catch (e) {
      console.warn('Clipboard copy failed:', e);
    }
  }

  function showCopyFeedback(btnEl) {
    if (!btnEl) return;
    const originalText = btnEl.innerHTML;
    btnEl.innerHTML = '<span style="color:#10B981;font-weight:700;">Copied! ✓</span>';
    btnEl.setAttribute('aria-live', 'polite');
    setTimeout(function() {
      btnEl.innerHTML = originalText;
    }, 2200);
  }

  // =========================================================================
  // 3. ANNOUNCEMENT BAR ROTATING SLIDER
  // =========================================================================
  function initAnnouncementSlider() {
    const slides = document.querySelectorAll('.hw-announcement-slide');
    if (!slides || slides.length <= 1) return;

    let currentIndex = 0;
    setInterval(function() {
      if (document.hidden) return;
      if (slides[currentIndex]) {
        slides[currentIndex].classList.remove('active');
      }
      currentIndex = (currentIndex + 1) % slides.length;
      if (slides[currentIndex]) {
        slides[currentIndex].classList.add('active');
      }
    }, 4500);
  }

  // =========================================================================
  // 4. FLOATING WIDGETS & BACK-TO-TOP
  // =========================================================================
  function initFloatingWidgets() {
    const backToTop = document.getElementById('hwScrollToTop') || document.getElementById('hwBackToTopBtn');
    if (backToTop) {
      let ticking = false;
      window.addEventListener('scroll', function() {
        if (!ticking) {
          window.requestAnimationFrame(function() {
            if (window.scrollY > 320) {
              backToTop.classList.add('is-visible');
              backToTop.style.display = 'flex';
            } else {
              backToTop.classList.remove('is-visible');
            }
            ticking = false;
          });
          ticking = true;
        }
      }, { passive: true });

      backToTop.addEventListener('click', function(e) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    const isPdp = document.body.classList.contains('template-product') || window.location.pathname.includes('/products/');
    if (backToTop && isPdp) {
      backToTop.style.setProperty('bottom', '96px', 'important');
    }
    const allClaimTabs = document.querySelectorAll('.hw-floating-claim-tab, .hw-claim-discount-btn');
    if (isPdp) {
      allClaimTabs.forEach(function(tab) { tab.remove(); });
    } else if (allClaimTabs.length > 1) {
      for (let i = 1; i < allClaimTabs.length; i++) {
        allClaimTabs[i].remove();
      }
    }

    // Drawer open / close sync to hide mobile sticky bottom bar
    const menuDrawerContainer = document.getElementById('Details-menu-drawer-container') || document.querySelector('.menu-drawer-container');
    const stickyBar = document.getElementById('hwMobileStickyBar') || document.querySelector('.hw-mobile-sticky-bar');
    if (menuDrawerContainer && stickyBar) {
      const syncDrawerState = function() {
        if (menuDrawerContainer.hasAttribute('open') || menuDrawerContainer.classList.contains('menu-open')) {
          stickyBar.style.setProperty('display', 'none', 'important');
          stickyBar.style.setProperty('opacity', '0', 'important');
          stickyBar.style.setProperty('pointer-events', 'none', 'important');
        } else {
          stickyBar.style.removeProperty('display');
          stickyBar.style.removeProperty('opacity');
          stickyBar.style.removeProperty('pointer-events');
        }
      };
      const observer = new MutationObserver(syncDrawerState);
      observer.observe(menuDrawerContainer, { attributes: true, attributeFilter: ['open', 'class'] });
      menuDrawerContainer.addEventListener('toggle', syncDrawerState);
    }
  }

  // =========================================================================
  // 5. DYNAMIC VARIANT SYNCHRONIZER, SAVINGS CALC & OUT-OF-STOCK WAITLIST
  // =========================================================================
  function formatMoney(cents) {
    return '$' + (Number(cents) / 100).toFixed(2);
  }

  function getProductVariantsData() {
    if (win.__PRODUCT_VARIANTS__ && Array.isArray(win.__PRODUCT_VARIANTS__) && win.__PRODUCT_VARIANTS__.length) {
      return win.__PRODUCT_VARIANTS__;
    }
    const scriptEl = document.getElementById('bfcmProductVariantsJson') ||
                     document.querySelector('script[data-bfcm-variants]') ||
                     document.querySelector('.variant-picker script[type="application/json"]');
    if (!scriptEl) return [];

    try {
      const data = JSON.parse(scriptEl.textContent || '[]');
      const arr = Array.isArray(data) ? data : [data];
      win.__PRODUCT_VARIANTS__ = arr;
      return arr;
    } catch (e) {
      return [];
    }
  }

  function findMatchingVariant(variants, selectedOptions) {
    if (!variants || !variants.length) return null;
    if (!selectedOptions || !selectedOptions.length) return variants[0];

    const cleanOpts = selectedOptions.map(function(s) { return String(s).toLowerCase().trim(); });

    // Look for exact match across option1, option2, option3
    const matched = variants.find(function(v) {
      const vOpts = [v.option1, v.option2, v.option3].filter(Boolean).map(function(o) {
        return String(o).toLowerCase().trim();
      });
      return cleanOpts.every(function(opt) { return vOpts.includes(opt); }) &&
             vOpts.every(function(vo) { return cleanOpts.includes(vo); });
    }) || variants.find(function(v) {
      const vOpts = [v.option1, v.option2, v.option3].filter(Boolean).map(function(o) {
        return String(o).toLowerCase().trim();
      });
      return cleanOpts.every(function(opt) { return vOpts.includes(opt); });
    });

    return matched || variants[0];
  }

  function updateDynamicVariantPricing(variant) {
    if (!variant) return;

    const price = Number(variant.price) || 0;
    const comparePrice = Number(variant.compare_at_price) || price;

    // 1. PDP Deal Box removed (Task 1)

    // 2. Update Main Price & Compare-At Display (Instant 0ms sync)
    const currentPriceEls = document.querySelectorAll(
      '.relief-price-current, .product-information .price-item--sale, .product-information .price-item--regular, product-price .price-item--sale, product-price .price-item--regular, .product-details .price-item, [data-testid="price"]'
    );
    currentPriceEls.forEach(function(el) {
      const sr = el.querySelector('.visually-hidden');
      if (sr) {
        el.replaceChildren(sr, document.createTextNode(' ' + formatMoney(price)));
      } else {
        el.textContent = formatMoney(price);
      }
    });

    const comparePriceEls = document.querySelectorAll(
      '.relief-price-compare, .product-information .compare-at-price, product-price .compare-at-price, .product-details .compare-at-price'
    );
    comparePriceEls.forEach(function(el) {
      if (comparePrice > price) {
        const sr = el.querySelector('.visually-hidden');
        if (sr) {
          el.replaceChildren(sr, document.createTextNode(' ' + formatMoney(comparePrice)));
        } else {
          el.textContent = formatMoney(comparePrice);
        }
        el.style.display = 'inline-block';
      } else {
        el.style.display = 'none';
      }
    });

    // 3. Update Dynamic Savings Badge (keep header gold badge "UP TO 70% OFF" intact)
    const savingsBadges = document.querySelectorAll(
      '.relief-price-save-badge, .product-badges__badge, .bfcm-savings-badge'
    );
    if (comparePrice > price) {
      const saveCents = comparePrice - price;
      const savePct = Math.round((saveCents / comparePrice) * 100);
      savingsBadges.forEach(function(badge) {
        badge.textContent = `SAVE ${savePct}% OFF`;
        badge.style.display = 'inline-block';
      });
    } else {
      savingsBadges.forEach(function(badge) {
        badge.style.display = 'none';
      });
    }

    // 4. Update In-Stock Badge
    const instockBadge = document.querySelector('.relief-instock-badge');
    if (instockBadge) {
      const isAvail = variant.available !== false;
      instockBadge.className = 'relief-instock-badge ' + (isAvail ? 'relief-instock--in' : 'relief-instock--out');
      const dot = instockBadge.querySelector('.relief-instock-dot');
      if (dot) dot.className = 'relief-instock-dot' + (isAvail ? '' : ' relief-instock-dot--out');
      const text = instockBadge.querySelector('.relief-instock-text');
      if (text) text.textContent = isAvail ? 'IN STOCK — Ships within 1–2 business days' : 'Out of stock';
    }

    // 5. Update Sticky Add-to-Cart Bar
    const stickyBar = document.querySelector('sticky-add-to-cart, .sticky-add-to-cart');
    if (stickyBar) {
      const stickyPrice = stickyBar.querySelector('.sticky-add-to-cart__price');
      if (stickyPrice) {
        const sale = stickyPrice.querySelector('.price-item--sale') || stickyPrice.querySelector('.relief-price-current') || stickyPrice;
        sale.textContent = formatMoney(price);
      }

      const stickyVariant = stickyBar.querySelector('.sticky-add-to-cart__variant');
      if (stickyVariant && variant.title) {
        stickyVariant.textContent = variant.title;
      }

      const stickyBtn = stickyBar.querySelector('.sticky-add-to-cart__button');
      if (stickyBtn) {
        stickyBtn.setAttribute('data-variant-id', variant.id);
        stickyBar.setAttribute('data-variant-available', variant.available ? 'true' : 'false');
      }
    }

    // 5. Sync with Frequently Bought Together Bundle (Item 0)
    const bundleItem0Check = document.getElementById('hwBundleCheck-0');
    if (bundleItem0Check) {
      bundleItem0Check.setAttribute('data-variant-id', variant.id);
      bundleItem0Check.setAttribute('data-price', price);
      bundleItem0Check.setAttribute('data-compare', comparePrice);

      const bundleItem0Price = document.getElementById('hwBundleItemPrice-0');
      if (bundleItem0Price) bundleItem0Price.textContent = formatMoney(price);

      if (typeof win.hwRecalculateBundleTotals === 'function') {
        win.hwRecalculateBundleTotals();
      }
    }

    // 6. Manage Out-of-Stock Waitlist Card & Buy Buttons Visibility
    updateWaitlistState(variant);
  }

  function updateWaitlistState(variant) {
    const waitlistCard = document.getElementById('bfcmWaitlistCard');
    const standardBuyButtons = document.querySelectorAll(
      '.buy-buttons-block, .product-details form[action*="/cart/add"], .product-form, .shopify-payment-button'
    );
    const mainAtcBtn = document.querySelector(
      '.product-details .add-to-cart-button, .buy-buttons-block .add-to-cart-button, [name="add"]'
    );
    const stickyAtcBtn = document.querySelector('.sticky-add-to-cart__button');

    if (!variant || variant.available === false) {
      // Variant is Sold Out!
      if (waitlistCard) {
        waitlistCard.style.display = 'block';
        waitlistCard.setAttribute('aria-hidden', 'false');

        const titleEl = waitlistCard.querySelector('.bfcm-waitlist-variant-name');
        if (titleEl) titleEl.textContent = variant.title || 'Selected Variant';

        const idInput = waitlistCard.querySelector('input[name="contact[variant_id]"]');
        if (idInput) idInput.value = variant.id;

        const bodyInput = waitlistCard.querySelector('input[name="contact[body]"]');
        if (bodyInput) {
          bodyInput.value = `VIP Black Friday Restock Notification Request: Variant [${variant.title}] (ID: ${variant.id})`;
        }
      }

      // Dim and disable standard ATC button
      if (mainAtcBtn) {
        mainAtcBtn.disabled = true;
        mainAtcBtn.classList.add('is-disabled-soldout');
        const mainLabel = mainAtcBtn.querySelector('.add-to-cart-main-label');
        if (mainLabel) {
          mainLabel.textContent = 'Sold Out — Join Waitlist Below';
        } else {
          const textSpan = mainAtcBtn.querySelector('.add-to-cart-label') || mainAtcBtn.querySelector('.add-to-cart-text__content > span:first-child');
          if (textSpan) {
            textSpan.textContent = 'Sold Out — Join Waitlist Below';
          }
        }
      }

      // Hide Buy It Now / Dynamic Checkout
      document.querySelectorAll('.shopify-payment-button').forEach(function(el) {
        el.style.display = 'none';
      });

      // Update sticky button to scroll to waitlist without destroying ref="quantityDisplay"
      if (stickyAtcBtn) {
        stickyAtcBtn.setAttribute('data-action', 'scroll-to-waitlist');
        const labelSpan = stickyAtcBtn.querySelector('.add-to-cart-label') || stickyAtcBtn.querySelector('.add-to-cart-text__content > span:first-child');
        if (labelSpan) {
          labelSpan.textContent = 'Join Waitlist 🔔';
        }
        const qtyDisplay = stickyAtcBtn.querySelector('[ref="quantityDisplay"]');
        if (qtyDisplay) {
          qtyDisplay.style.display = 'none';
        }
      }

    } else {
      // Variant is In Stock!
      if (waitlistCard) {
        waitlistCard.style.display = 'none';
        waitlistCard.setAttribute('aria-hidden', 'true');
      }

      if (mainAtcBtn) {
        mainAtcBtn.disabled = false;
        mainAtcBtn.classList.remove('is-disabled-soldout');
        const mainLabel = mainAtcBtn.querySelector('.add-to-cart-main-label');
        if (mainLabel) {
          mainLabel.textContent = 'Add to Cart';
        } else {
          const textSpan = mainAtcBtn.querySelector('.add-to-cart-label') || mainAtcBtn.querySelector('.add-to-cart-text__content > span:first-child');
          if (textSpan) {
            textSpan.textContent = 'Add to Cart';
          }
        }
      }

      document.querySelectorAll('.shopify-payment-button').forEach(function(el) {
        el.style.display = 'block';
      });

      if (stickyAtcBtn) {
        stickyAtcBtn.removeAttribute('data-action');
        const labelSpan = stickyAtcBtn.querySelector('.add-to-cart-label') || stickyAtcBtn.querySelector('.add-to-cart-text__content > span:first-child');
        if (labelSpan) {
          labelSpan.textContent = 'Add to Cart';
        }
      }
    }
  }

  function handleWaitlistFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    if (!form) return;
    const submitBtn = form.querySelector('.bfcm-waitlist-submit-btn');
    const successBox = form.parentElement ? form.parentElement.querySelector('.bfcm-waitlist-success') : null;
    const emailInput = form.querySelector('input[type="email"]');

    if (!emailInput || !emailInput.value) return;

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Joining...';
    }

    const formData = new FormData(form);

    fetch('/contact#contact_form', {
      method: 'POST',
      body: formData,
      headers: { 'Accept': 'application/json, text/javascript, */*; q=0.01' }
    }).then(function() {
      form.style.display = 'none';
      if (successBox) {
        successBox.style.display = 'block';
        successBox.setAttribute('aria-live', 'polite');
      }
    }).catch(function() {
      // Fallback submit
      form.style.display = 'none';
      if (successBox) successBox.style.display = 'block';
    });
  }

  function initVariantSynchronizer() {
    const variants = getProductVariantsData();

    // 1. Initial State Sync
    function syncInitialState() {
      // Clean up multiple active radios per group if any
      document.querySelectorAll('variant-picker fieldset, .variant-picker .variant-option').forEach(function(fs) {
        const checkedRadios = fs.querySelectorAll('input[type="radio"]:checked');
        if (checkedRadios.length > 1) {
          for (let i = 1; i < checkedRadios.length; i++) {
            checkedRadios[i].checked = false;
            checkedRadios[i].removeAttribute('data-current-checked');
            checkedRadios[i].setAttribute('data-current-checked', 'false');
            const p = checkedRadios[i].closest('.variant-swatch-pill, .variant-pill, .variant-option__button-label');
            if (p) {
              p.classList.remove('is-active');
            }
          }
        }
      });

      const activeRadios = Array.from(document.querySelectorAll('.variant-picker input[type="radio"]:checked'));
      const activeSelects = Array.from(document.querySelectorAll('.variant-picker select'));

      let selectedOptions = [];
      if (activeRadios.length) {
        selectedOptions = activeRadios.map(function(r) { return r.value; });
      } else if (activeSelects.length) {
        selectedOptions = activeSelects.map(function(s) { return s.value; });
      }

      if (selectedOptions.length && variants.length) {
        const matched = findMatchingVariant(variants, selectedOptions);
        if (matched) updateDynamicVariantPricing(matched);
      }
    }

    // Run initial check
    syncInitialState();

    // 2. Instant Click Handler: ensures radio is checked and change event dispatches immediately
    document.addEventListener('click', function(e) {
      if (!(e.target instanceof Element)) return;
      const pill = e.target.closest(
        '.variant-swatch-pill, .variant-pill, .variant-option__button-label, [data-agent-action="select-variant"]'
      );
      if (!pill) return;

      const container = pill.closest('.variant-picker__swatches, .variant-pill-list') || pill.closest('fieldset');
      if (container) {
        container.querySelectorAll('.variant-swatch-pill, .variant-pill, .variant-option__button-label').forEach(function(p) {
          p.classList.remove('is-active');
          p.setAttribute('aria-checked', 'false');
        });
        pill.classList.add('is-active');
        pill.setAttribute('aria-checked', 'true');
      }

      const radio = pill.querySelector('input[type="radio"]') || (pill.tagName === 'INPUT' ? pill : null);
      if (radio) {
        if (!radio.checked) {
          radio.checked = true;
        }
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    // Listen to standard product:select & shopify:product:select events for 0ms synchronizer
    const handleProductSelectEvent = function(e) {
      let variant = e.detail?.resource;
      if (Array.isArray(variant)) variant = variant[0];
      if (variant) {
        updateDynamicVariantPricing(variant);
        if (variant.available !== false && variant.id) {
          document.querySelectorAll('input[name="id"]').forEach(function(inp) {
            inp.value = variant.id;
          });
        }
      } else if (e.detail?.variantId) {
        const vList = getProductVariantsData();
        const found = vList.find(function(v) { return String(v.id) === String(e.detail.variantId); });
        if (found) {
          updateDynamicVariantPricing(found);
          if (found.available !== false && found.id) {
            document.querySelectorAll('input[name="id"]').forEach(function(inp) {
              inp.value = found.id;
            });
          }
        }
      }
    };
    document.addEventListener('product:select', handleProductSelectEvent);
    document.addEventListener('shopify:product:select', handleProductSelectEvent);

    // 3. Click & Change Listeners
    document.addEventListener('change', function(e) {
      if (!e.target) return;

      // Handle variant changes
      if (e.target.matches('.variant-picker input[type="radio"], .variant-picker select, .variant-option input[type="radio"]')) {
        const fieldset = e.target.closest('fieldset') || e.target.closest('.variant-option');
        const container = e.target.closest('.variant-picker__swatches, .variant-pill-list') || fieldset;

        if (fieldset) {
          fieldset.querySelectorAll('input[type="radio"]').forEach(function(r) {
            if (r !== e.target) {
              r.checked = false;
              r.removeAttribute('data-current-checked');
              r.setAttribute('data-current-checked', 'false');
            }
          });
        }

        if (container) {
          container.querySelectorAll('.variant-swatch-pill, .variant-pill, .variant-option__button-label').forEach(function(pill) {
            pill.classList.remove('is-active');
          });
          const parentPill = e.target.closest('.variant-swatch-pill, .variant-pill, .variant-option__button-label');
          if (parentPill) {
            parentPill.classList.add('is-active');
          }
        }

        e.target.checked = true;
        e.target.setAttribute('data-current-checked', 'true');

        if (fieldset) {
          const selectedValEl = fieldset.querySelector('.variant-option__selected-value');
          if (selectedValEl && e.target.value) {
            selectedValEl.textContent = e.target.value;
          }
        }

        // Collect all currently checked options
        const currentPills = Array.from(document.querySelectorAll('.variant-picker input[type="radio"]:checked, .variant-picker select'));
        const currentOptions = currentPills.map(function(input) { return input.value; });

        const matchedVariant = findMatchingVariant(variants, currentOptions);
        if (matchedVariant) {
          updateDynamicVariantPricing(matchedVariant);
          if (matchedVariant.available !== false && matchedVariant.id) {
            document.querySelectorAll('input[name="id"]').forEach(function(inp) {
              inp.value = matchedVariant.id;
            });
          }
          const featImg = matchedVariant.featured_image?.src || matchedVariant.featured_media?.preview_image?.src;
          if (featImg) {
            const mainImg = document.querySelector('.product-media-gallery img, .product-media img, .product-information img');
            if (mainImg) {
              mainImg.src = featImg;
              if (mainImg.srcset) mainImg.removeAttribute('srcset');
            }
          }
        }
      }
    });

    // 3. Delegate Sticky Bar Scroll to Waitlist
    document.addEventListener('click', function(e) {
      if (!(e.target instanceof Element)) return;
      const target = e.target.closest('[data-action="scroll-to-waitlist"]');
      if (target) {
        e.preventDefault();
        const waitlistCard = document.getElementById('bfcmWaitlistCard');
        if (waitlistCard) {
          waitlistCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const emailInput = waitlistCard.querySelector('input[type="email"]');
          if (emailInput) emailInput.focus();
        }
      }
    });

    // 4. Attach Waitlist Form Handlers
    const waitlistForm = document.getElementById('bfcmWaitlistForm');
    if (waitlistForm) {
      waitlistForm.addEventListener('submit', handleWaitlistFormSubmit);
    }
  }

  // =========================================================================
  // 6. DOM BOOTSTRAP (supports both eager load & post-DOMContentLoaded lazy load)
  // =========================================================================
  function bootBfcmEngine() {
    initAnnouncementSlider();
    initFloatingWidgets();
    initVariantSynchronizer();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootBfcmEngine, { once: true });
  } else {
    bootBfcmEngine();
  }
})();
