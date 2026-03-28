/* ═══════════════════════════════════════════════
   ZILA COLLECTIONS — Main JS
   Production-grade interactions
════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

  // ─── NAVBAR SCROLL EFFECT ───────────────────
  const navbar = document.querySelector('.navbar') || document.querySelector('nav');
  if (navbar) {
    const onScroll = () => {
      navbar.classList.toggle('scrolled', window.scrollY > 20);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ─── MOBILE MENU TOGGLE ────────────────────
  const menuToggle = document.getElementById('menu-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  const menuClose = document.getElementById('menu-close');
  const menuOverlay = document.getElementById('menu-overlay');

  const openMenu = () => {
    mobileMenu?.classList.remove('translate-x-full');
    menuOverlay?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  };
  const closeMenu = () => {
    mobileMenu?.classList.add('translate-x-full');
    menuOverlay?.classList.add('hidden');
    document.body.style.overflow = '';
  };

  menuToggle?.addEventListener('click', openMenu);
  menuClose?.addEventListener('click', closeMenu);
  menuOverlay?.addEventListener('click', closeMenu);

  // Close menu on escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });

  // ─── TOAST NOTIFICATION ─────────────────────
  const showToast = (message, type = 'success') => {
    const existing = document.getElementById('zila-toast');
    if (existing) existing.remove();

    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    const toast = document.createElement('div');
    toast.id = 'zila-toast';
    toast.className = 'toast';
    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => toast.classList.add('show'));
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  };

  // Expose globally
  window.showToast = showToast;

  // Auto-show toasts from URL params
  const params = new URLSearchParams(window.location.search);
  if (params.has('added')) showToast('Added to cart!');
  if (params.has('wishlisted')) showToast('Added to wishlist ❤️');
  if (params.has('reviewed')) showToast('Review submitted!');
  if (params.has('updated')) showToast('Profile updated!');
  if (params.has('registered')) showToast('Welcome to Zila Collections! 🎉');
  if (params.has('error')) {
    const err = params.get('error');
    const msgs = {
      '1': 'Please fill in all required fields.',
      'wrong_password': 'Current password is incorrect.'
    };
    showToast(msgs[err] || 'Something went wrong.', 'error');
  }

  // ─── PRODUCT IMAGE GALLERY ──────────────────
  const mainImage = document.getElementById('main-product-image');
  const thumbs = document.querySelectorAll('.product-thumb');

  thumbs.forEach(thumb => {
    thumb.addEventListener('click', () => {
      const src = thumb.dataset.src;
      if (mainImage && src) {
        mainImage.style.opacity = '0';
        mainImage.style.transform = 'scale(0.97)';
        setTimeout(() => {
          mainImage.src = src;
          mainImage.style.opacity = '1';
          mainImage.style.transform = 'scale(1)';
        }, 200);
      }
      thumbs.forEach(t => t.classList.remove('ring-2', 'ring-yellow-400'));
      thumb.classList.add('ring-2', 'ring-yellow-400');
    });
  });

  if (mainImage) {
    mainImage.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
  }

  // ─── SIZE SELECTOR ──────────────────────────
  const sizeOptions = document.querySelectorAll('.size-option');
  const sizeInput = document.getElementById('selected-size');
  const atcBtn = document.getElementById('atc-btn');

  sizeOptions.forEach(opt => {
    if (opt.dataset.outOfStock) return;
    opt.addEventListener('click', () => {
      sizeOptions.forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      if (sizeInput) sizeInput.value = opt.dataset.size;
      if (atcBtn) {
        atcBtn.disabled = false;
        atcBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      }
    });
  });

  // ─── QUANTITY STEPPER ───────────────────────
  document.querySelectorAll('[data-qty-minus]').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.qtyMinus);
      if (input && parseInt(input.value) > 1) {
        input.value = parseInt(input.value) - 1;
        input.dispatchEvent(new Event('change'));
      }
    });
  });

  document.querySelectorAll('[data-qty-plus]').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.qtyPlus);
      const max = parseInt(input?.dataset.max || '99');
      if (input && parseInt(input.value) < max) {
        input.value = parseInt(input.value) + 1;
        input.dispatchEvent(new Event('change'));
      }
    });
  });

  // Auto-submit cart quantity forms on change
  document.querySelectorAll('.cart-qty-input').forEach(input => {
    input.addEventListener('change', () => {
      const form = input.closest('form');
      if (form) form.submit();
    });
  });

  // ─── LAZY LOAD IMAGES ───────────────────────
  if ('IntersectionObserver' in window) {
    const lazyImages = document.querySelectorAll('img[data-src]');
    const imgObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          imgObserver.unobserve(img);
        }
      });
    }, { rootMargin: '50px' });
    lazyImages.forEach(img => imgObserver.observe(img));
  }

  // ─── FADE IN ON SCROLL ───────────────────────
  if ('IntersectionObserver' in window) {
    const fadeEls = document.querySelectorAll('.animate-on-scroll');
    const fadeObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            entry.target.classList.add('fade-in-up');
            entry.target.style.opacity = '1';
          }, i * 80);
          fadeObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    fadeEls.forEach(el => {
      el.style.opacity = '0';
      fadeObserver.observe(el);
    });
  }

  // ─── SMOOTH SCROLL ANCHORS ──────────────────
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const target = document.getElementById(a.getAttribute('href').slice(1));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ─── SEARCH INPUT DEBOUNCE ──────────────────
  const searchInputs = document.querySelectorAll('[data-search-input]');
  searchInputs.forEach(input => {
    let timer;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const form = input.closest('form');
        if (form) form.submit();
      }, 600);
    });
  });

  // ─── CONFIRM DIALOGS ────────────────────────
  document.querySelectorAll('[data-confirm]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (!confirm(el.dataset.confirm || 'Are you sure?')) {
        e.preventDefault();
      }
    });
  });

  // ─── STAR RATING PICKER ─────────────────────
  const ratingInputs = document.querySelectorAll('.star-rating-input');
  ratingInputs.forEach(container => {
    const stars = container.querySelectorAll('.star-pick');
    const hiddenInput = document.getElementById('rating-value');

    stars.forEach((star, idx) => {
      star.addEventListener('mouseenter', () => {
        stars.forEach((s, i) => {
          s.classList.toggle('text-yellow-400', i <= idx);
          s.classList.toggle('fill-current', i <= idx);
        });
      });

      star.addEventListener('mouseleave', () => {
        const current = parseInt(hiddenInput?.value || 0);
        stars.forEach((s, i) => {
          s.classList.toggle('text-yellow-400', i < current);
          s.classList.toggle('fill-current', i < current);
        });
      });

      star.addEventListener('click', () => {
        if (hiddenInput) hiddenInput.value = idx + 1;
        stars.forEach((s, i) => {
          s.classList.toggle('text-yellow-400', i <= idx);
          s.classList.toggle('fill-current', i <= idx);
        });
      });
    });
  });

  // ─── STICKY ATC BUTTON VISIBILITY ───────────
  const stickyAtc = document.querySelector('.sticky-atc');
  const productTop = document.querySelector('.product-form-section');

  if (stickyAtc && productTop) {
    const atcObserver = new IntersectionObserver((entries) => {
      stickyAtc.style.display = entries[0].isIntersecting ? 'none' : 'block';
    });
    atcObserver.observe(productTop);
  }

  // ─── FILTER PANEL TOGGLE (Mobile) ───────────
  const filterToggle = document.getElementById('filter-toggle');
  const filterPanel = document.getElementById('filter-panel');
  const filterClose = document.getElementById('filter-close');

  filterToggle?.addEventListener('click', () => {
    filterPanel?.classList.toggle('hidden');
    filterPanel?.classList.toggle('flex');
  });
  filterClose?.addEventListener('click', () => {
    filterPanel?.classList.add('hidden');
    filterPanel?.classList.remove('flex');
  });

  // ─── NUMBER INPUT LIMITS ────────────────────
  document.querySelectorAll('input[type="number"]').forEach(input => {
    const min = parseFloat(input.min) || 0;
    const max = parseFloat(input.max) || Infinity;
    input.addEventListener('change', () => {
      let val = parseFloat(input.value);
      if (isNaN(val) || val < min) input.value = min;
      if (val > max) input.value = max;
    });
  });

  // ─── IMAGE PREVIEW ON UPLOAD ─────────────────
  document.querySelectorAll('input[type="file"][data-preview]').forEach(input => {
    const previewId = input.dataset.preview;
    const preview = document.getElementById(previewId);
    if (!preview) return;
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          preview.src = e.target.result;
          preview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
      }
    });
  });

  // ─── DYNAMIC SIZE VARIANTS ───────────────────
  const addVariantBtn = document.getElementById('add-variant-btn');
  const variantList = document.getElementById('variant-list');

  addVariantBtn?.addEventListener('click', () => {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-3 mt-3';
    row.innerHTML = `
      <input type="text" name="size[]" placeholder="e.g. XL" 
        class="flex-1 border-2 border-gray-200 rounded-xl px-4 py-2.5 font-medium text-sm outline-none focus:border-yellow-400">
      <input type="number" name="variant_stock[]" placeholder="Stock" min="0"
        class="w-28 border-2 border-gray-200 rounded-xl px-4 py-2.5 font-medium text-sm outline-none focus:border-yellow-400">
      <button type="button" class="remove-variant text-red-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition flex-shrink-0">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    `;
    variantList?.appendChild(row);
    row.querySelector('.remove-variant')?.addEventListener('click', () => row.remove());
  });

  // Remove existing variants
  document.querySelectorAll('.remove-variant').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.flex')?.remove());
  });

  // ─── COPY TO CLIPBOARD ───────────────────────
  document.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', () => {
      navigator.clipboard?.writeText(btn.dataset.copy).then(() => {
        const orig = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = orig, 1500);
      });
    });
  });

  // ─── PRINT ORDER ─────────────────────────────
  document.querySelectorAll('[data-print]').forEach(btn => {
    btn.addEventListener('click', () => window.print());
  });

  // ─── HEADER SEARCH TOGGLE ─────────────────────
  const headerSearchBtn = document.getElementById('header-search-btn');
  const headerSearchBox = document.getElementById('header-search-box');

  headerSearchBtn?.addEventListener('click', () => {
    headerSearchBox?.classList.toggle('hidden');
    headerSearchBox?.querySelector('input')?.focus();
  });

  document.addEventListener('click', (e) => {
    if (headerSearchBox && !headerSearchBox.contains(e.target) && e.target !== headerSearchBtn) {
      headerSearchBox.classList.add('hidden');
    }
  });

  console.log('✅ Zila Collections loaded');
});
