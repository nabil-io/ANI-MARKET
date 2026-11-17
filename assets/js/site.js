/**
 * ANI MARKET - Logique Interactive du Site Public (site.js)
 * Cahier des charges v2.0
 */

(function() {
  'use strict';

  // État local de la vue
  let catalogData = null;
  let activeCategory = 'all';
  let searchQuery = '';
  let activeSort = 'default';
  let displayedCount = 12;
  const PAGE_SIZE = 12;

  // Enregistrement du Service Worker
  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('assets/js/sw.js').catch(err => {
        console.log('SW registration error:', err);
      });
    });
  }

  // Éléments du DOM
  const dom = {
    // Header
    brandName: document.getElementById('brand-name'),
    cartCountBadge: document.getElementById('cart-count-badge'),
    btnCartHeader: document.getElementById('btn-cart-header'),
    btnSearchHeader: document.getElementById('btn-search-header'),
    btnWaHeader: document.getElementById('btn-wa-header'),
    mainHeader: document.getElementById('main-header'),

    // Hero
    heroTitle: document.getElementById('hero-title'),
    heroPunchline: document.getElementById('hero-punchline'),
    heroBtnWa: document.getElementById('hero-btn-wa'),
    heroArchesWrap: document.getElementById('hero-arches-wrap'),

    // Sections dynamiques
    categoriesWheel: document.getElementById('categories-wheel'),
    featuredPagnesSection: document.getElementById('featured-pagnes-section'),
    featuredPagnesTrack: document.getElementById('featured-pagnes-track'),
    beautySpotlightSection: document.getElementById('beauty-spotlight-section'),
    beautySpotlightGrid: document.getElementById('beauty-spotlight-grid'),

    // Catalogue
    categoryPills: document.getElementById('category-pills'),
    catalogSearchInput: document.getElementById('catalog-search-input'),
    searchClearBtn: document.getElementById('search-clear-btn'),
    sortSelect: document.getElementById('catalog-sort-select'),
    resultsCounter: document.getElementById('results-counter'),
    productsGrid: document.getElementById('products-grid'),
    loadMoreBtn: document.getElementById('btn-load-more'),
    loadMoreWrap: document.getElementById('load-more-wrap'),

    // Infos pratiques & Groupe WA
    practicalSection: document.getElementById('practical-section'),
    waGroupCard: document.getElementById('wa-group-card'),
    waGroupBtn: document.getElementById('wa-group-btn'),
    practicalCardsGrid: document.getElementById('practical-cards-grid'),

    // Appel final & Footer
    finalWaBtn: document.getElementById('final-wa-btn'),
    footerPhone: document.getElementById('footer-phone'),
    footerCategories: document.getElementById('footer-categories'),
    footerCredit: document.getElementById('footer-credit'),

    // Éléments flottants
    floatingWa: document.getElementById('floating-wa'),
    backToTop: document.getElementById('back-to-top'),
    mobileCartBar: document.getElementById('mobile-cart-bar'),
    mobileCartCount: document.getElementById('mobile-cart-count'),
    mobileCartTotal: document.getElementById('mobile-cart-total'),
    btnMobileCart: document.getElementById('btn-mobile-cart'),

    // Modale Panier
    cartModalOverlay: document.getElementById('cart-modal-overlay'),
    cartItemsList: document.getElementById('cart-items-list'),
    cartTotalPrice: document.getElementById('cart-total-price'),
    cartCloseBtn: document.getElementById('cart-close-btn'),
    cartOrderWaBtn: document.getElementById('cart-order-wa-btn'),

    // Modale Fiche Produit
    productModalOverlay: document.getElementById('product-modal-overlay'),
    productModalSheet: document.getElementById('product-modal-sheet'),
    productCloseBtn: document.getElementById('product-close-btn'),
    modalProductImg: document.getElementById('modal-product-img'),
    modalProductTitle: document.getElementById('modal-product-title'),
    modalProductPrice: document.getElementById('modal-product-price'),
    modalProductUnit: document.getElementById('modal-product-unit'),
    modalProductDesc: document.getElementById('modal-product-desc'),
    modalProductCategory: document.getElementById('modal-product-category'),
    modalQtyVal: document.getElementById('modal-qty-val'),
    modalQtyMinus: document.getElementById('modal-qty-minus'),
    modalQtyPlus: document.getElementById('modal-qty-plus'),
    modalBtnOrderWa: document.getElementById('modal-btn-order-wa'),
    modalBtnAddToCart: document.getElementById('modal-btn-add-to-cart'),

    // Recherche Plein Écran
    searchOverlay: document.getElementById('search-overlay'),
    searchOverlayInput: document.getElementById('search-overlay-input'),
    searchOverlayClose: document.getElementById('search-overlay-close'),
    searchOverlayResults: document.getElementById('search-overlay-results'),

    // Toast
    toastNotice: document.getElementById('toast-notice')
  };

  // Produit actif dans la modale
  let currentModalProduct = null;
  let currentModalQty = 1;

  // Helper Toast
  function showToast(message) {
    if (!dom.toastNotice) return;
    dom.toastNotice.textContent = message;
    dom.toastNotice.classList.add('show');
    setTimeout(() => {
      dom.toastNotice.classList.remove('show');
    }, 2800);
  }

  // Initialisation principale
  async function init() {
    setupEventListeners();
    await loadCatalog();
    handleHashNavigation();
  }

  // Chargement du catalogue via api.js
  async function loadCatalog() {
    try {
      catalogData = await window.aniAPI.loadCatalog();
      renderAll();
    } catch (err) {
      console.error('Erreur chargement catalogue:', err);
      if (dom.productsGrid) {
        dom.productsGrid.innerHTML = `
          <div class="empty-state">
            <p>Impossible de charger les produits pour le moment.</p>
            <button class="btn btn-primary" onclick="location.reload()" style="margin-top:16px;">Réessayer</button>
          </div>
        `;
      }
    }
  }

  // Rendu de l'ensemble de l'interface
  function renderAll() {
    if (!catalogData) return;
    renderBrandSettings();
    renderHeroArches();
    renderCategoriesWheel();
    renderFeaturedPagnes();
    renderBeautySpotlight();
    renderCategoryPills();
    renderCatalog();
    renderPracticalInfo();
    renderFooter();
    updateCartUI();
  }

  // Réglages globaux de la boutique
  function renderBrandSettings() {
    const s = catalogData.settings || {};
    const shopName = s.name || 'ANI MARKET';
    const waPhone = (s.whatsapp || '2290196273834').replace(/[^0-9]/g, '');
    const waLink = `https://wa.me/${waPhone}`;

    document.title = `${shopName} — Boutique en ligne & WhatsApp`;

    if (dom.brandName) dom.brandName.textContent = shopName;
    if (dom.heroTitle && s.tagline) {
      dom.heroTitle.innerHTML = s.tagline.replace('de tout', '<span class="gold-italic">de tout</span>');
    }
    if (dom.heroPunchline && s.punchline) {
      dom.heroPunchline.textContent = s.punchline;
    }

    // Liens WhatsApp directs
    const greetingMsg = encodeURIComponent(`Bonjour ${shopName}, je vous écris depuis votre site web.`);
    const waDirectUrl = `${waLink}?text=${greetingMsg}`;

    if (dom.btnWaHeader) dom.btnWaHeader.href = waDirectUrl;
    if (dom.heroBtnWa) dom.heroBtnWa.href = waDirectUrl;
    if (dom.finalWaBtn) dom.finalWaBtn.href = waDirectUrl;
    if (dom.floatingWa) dom.floatingWa.href = waDirectUrl;
    if (dom.footerPhone) {
      dom.footerPhone.textContent = s.whatsapp || '+229 01 96 27 38 34';
      dom.footerPhone.href = waDirectUrl;
    }
  }

  // Arches décoratives du Hero (3 pagnes en arches)
  function renderHeroArches() {
    if (!dom.heroArchesWrap) return;
    const pagnes = (catalogData.products || []).filter(p => p.categoryId === 'pagne' && !p.hidden && p.available);
    const arches = pagnes.slice(0, 3);
    if (arches.length === 0) {
      dom.heroArchesWrap.style.display = 'none';
      return;
    }

    dom.heroArchesWrap.innerHTML = arches.map((p, idx) => `
      <div class="hero-arch-card" data-id="${p.id}" role="button" title="${escapeHtml(p.name)}">
        <img src="${escapeHtml(p.images[0])}" alt="${escapeHtml(p.name)}" loading="eager" />
      </div>
    `).join('');

    dom.heroArchesWrap.querySelectorAll('.hero-arch-card').forEach(el => {
      el.addEventListener('click', () => {
        const pid = el.dataset.id;
        const prod = (catalogData.products || []).find(p => p.id === pid);
        if (prod) openProductModal(prod);
      });
    });
  }

  // 5. La roue des catégories
  function renderCategoriesWheel() {
    if (!dom.categoriesWheel) return;
    const cats = catalogData.categories || [];
    const products = catalogData.products || [];

    // Afficher uniquement les catégories non vides et non cachées
    const visibleCats = cats.filter(c => {
      if (c.hidden) return false;
      return products.some(p => p.categoryId === c.id && !p.hidden);
    }).sort((a, b) => (a.order || 0) - (b.order || 0));

    if (visibleCats.length === 0) {
      dom.categoriesWheel.closest('.categories-wheel-section').style.display = 'none';
      return;
    }

    dom.categoriesWheel.innerHTML = visibleCats.map(c => {
      const sampleProd = products.find(p => p.categoryId === c.id && !p.hidden && p.images && p.images.length > 0);
      const imgUrl = sampleProd ? sampleProd.images[0] : 'assets/brand/logo-rond.png';

      return `
        <button class="wheel-card" data-cat="${c.id}" type="button">
          <div class="wheel-circle">
            <img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(c.name)}" loading="lazy" />
          </div>
          <span class="wheel-name">${escapeHtml(c.name)}</span>
        </button>
      `;
    }).join('');

    dom.categoriesWheel.querySelectorAll('.wheel-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const catId = btn.dataset.cat;
        selectCategory(catId);
        scrollToCatalog();
      });
    });
  }

  // 6. Collection à la une : Nos pagnes
  function renderFeaturedPagnes() {
    if (!dom.featuredPagnesSection || !dom.featuredPagnesTrack) return;
    const pagnes = (catalogData.products || []).filter(p => p.categoryId === 'pagne' && !p.hidden);

    if (pagnes.length === 0) {
      dom.featuredPagnesSection.style.display = 'none';
      return;
    }
    dom.featuredPagnesSection.style.display = 'block';

    dom.featuredPagnesTrack.innerHTML = pagnes.slice(0, 4).map(p => `
      <div class="arch-product-card" data-id="${p.id}">
        <div class="arch-img-wrap">
          <img src="${escapeHtml(p.images[0])}" alt="${escapeHtml(p.name)}" loading="lazy" />
        </div>
        <div class="arch-info">
          <h3 class="arch-title">${escapeHtml(p.name)}</h3>
          <span class="arch-price">${window.aniCart.formatPrice(p.price)}</span>
          <button class="btn btn-primary" type="button" style="height:40px; margin-top:8px;">Voir le pagne</button>
        </div>
      </div>
    `).join('');

    dom.featuredPagnesTrack.querySelectorAll('.arch-product-card').forEach(card => {
      card.addEventListener('click', () => {
        const prod = pagnes.find(p => p.id === card.dataset.id);
        if (prod) openProductModal(prod);
      });
    });
  }

  // 7. Coup de cœur beauté
  function renderBeautySpotlight() {
    if (!dom.beautySpotlightSection || !dom.beautySpotlightGrid) return;
    const populars = (catalogData.products || []).filter(p => p.badge === 'popular' && !p.hidden);

    if (populars.length === 0) {
      dom.beautySpotlightSection.style.display = 'none';
      return;
    }
    dom.beautySpotlightSection.style.display = 'block';

    dom.beautySpotlightGrid.innerHTML = populars.map(p => createProductCardHtml(p)).join('');
    attachProductCardListeners(dom.beautySpotlightGrid);
  }

  // 8. Pastilles de catégories (Catalogue)
  function renderCategoryPills() {
    if (!dom.categoryPills) return;
    const cats = catalogData.categories || [];
    const products = catalogData.products || [];

    const visibleCats = cats.filter(c => {
      if (c.hidden) return false;
      return products.some(p => p.categoryId === c.id && !p.hidden);
    }).sort((a, b) => (a.order || 0) - (b.order || 0));

    let html = `<button class="filter-pill ${activeCategory === 'all' ? 'active' : ''}" data-cat="all" type="button">Tous les produits</button>`;
    visibleCats.forEach(c => {
      html += `<button class="filter-pill ${activeCategory === c.id ? 'active' : ''}" data-cat="${c.id}" type="button">${escapeHtml(c.name)}</button>`;
    });

    dom.categoryPills.innerHTML = html;

    dom.categoryPills.querySelectorAll('.filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        selectCategory(btn.dataset.cat);
      });
    });
  }

  function selectCategory(catId) {
    activeCategory = catId;
    displayedCount = PAGE_SIZE;
    if (dom.categoryPills) {
      dom.categoryPills.querySelectorAll('.filter-pill').forEach(b => {
        b.classList.toggle('active', b.dataset.cat === catId);
      });
    }
    updateUrlHash();
    renderCatalog();
  }

  // 8. Rendu du Catalogue
  function renderCatalog() {
    if (!dom.productsGrid) return;

    let list = (catalogData.products || []).filter(p => !p.hidden);

    // Filtre catégorie
    if (activeCategory !== 'all') {
      list = list.filter(p => p.categoryId === activeCategory);
    }

    // Filtre recherche
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(p => {
        const nameMatch = (p.name || '').toLowerCase().includes(q);
        const descMatch = (p.description || '').toLowerCase().includes(q);
        const unitMatch = (p.unit || '').toLowerCase().includes(q);
        return nameMatch || descMatch || unitMatch;
      });
    }

    // Tri
    if (activeSort === 'price-asc') {
      list.sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (activeSort === 'price-desc') {
      list.sort((a, b) => (b.price || 0) - (a.price || 0));
    } else if (activeSort === 'name-asc') {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }

    // Compteur
    if (dom.resultsCounter) {
      const count = list.length;
      dom.resultsCounter.textContent = `${count} produit${count > 1 ? 's' : ''} disponible${count > 1 ? 's' : ''}`;
    }

    // Cas vide
    if (list.length === 0) {
      dom.productsGrid.innerHTML = `
        <div class="empty-state">
          <img src="assets/brand/logo-rond.png" alt="ANI MARKET" class="empty-state-logo" />
          <h3 style="font-family:var(--font-serif); font-size:1.3rem; margin-bottom:8px;">Aucun produit trouvé</h3>
          <p style="color:var(--ink-light); font-size:0.95rem;">Essayez un autre mot-clé ou sélectionnez une autre catégorie.</p>
          <button class="btn btn-secondary" id="btn-reset-filters" style="margin-top:20px;">Afficher tous les produits</button>
        </div>
      `;
      const resetBtn = document.getElementById('btn-reset-filters');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          searchQuery = '';
          if (dom.catalogSearchInput) dom.catalogSearchInput.value = '';
          if (dom.searchClearBtn) dom.searchClearBtn.classList.remove('visible');
          selectCategory('all');
        });
      }
      if (dom.loadMoreWrap) dom.loadMoreWrap.style.display = 'none';
      return;
    }

    // Pagination par lot de 12
    const toShow = list.slice(0, displayedCount);
    dom.productsGrid.innerHTML = toShow.map(p => createProductCardHtml(p)).join('');
    attachProductCardListeners(dom.productsGrid);

    // Bouton Charger plus
    if (dom.loadMoreWrap) {
      if (displayedCount < list.length) {
        dom.loadMoreWrap.style.display = 'block';
      } else {
        dom.loadMoreWrap.style.display = 'none';
      }
    }
  }

  // Création HTML d'une Carte Produit
  function createProductCardHtml(p) {
    const isSoldOut = p.available === false;
    let badgeHtml = '';
    if (isSoldOut) {
      badgeHtml = '<span class="card-badge badge-soldout">Épuisé</span>';
    } else if (p.badge === 'new') {
      badgeHtml = '<span class="card-badge badge-new">Nouveau</span>';
    } else if (p.badge === 'popular') {
      badgeHtml = '<span class="card-badge badge-popular">Populaire</span>';
    }

    const img = (p.images && p.images.length > 0) ? p.images[0] : 'assets/brand/logo-rond.png';
    const priceStr = window.aniCart.formatPrice(p.price);
    const unitStr = p.unit ? escapeHtml(p.unit) : '';

    return `
      <div class="product-card" data-id="${p.id}">
        <div class="card-thumb-link" role="button" aria-label="${escapeHtml(p.name)}">
          ${badgeHtml}
          <img src="${escapeHtml(img)}" alt="${escapeHtml(p.name)}" loading="lazy" />
        </div>
        <div class="card-body">
          <h3 class="card-title">${escapeHtml(p.name)}</h3>
          <div class="card-meta">
            <span class="card-price price-tag">${priceStr}</span>
            ${unitStr ? `<span class="card-unit">${unitStr}</span>` : ''}
          </div>
          <div class="card-actions">
            ${isSoldOut ? `
              <button class="btn btn-secondary card-btn-order" disabled style="opacity:0.6; cursor:not-allowed;">Indisponible</button>
            ` : `
              <button class="btn btn-primary card-btn-order" type="button">Commander</button>
              <button class="card-btn-cart" type="button" aria-label="Ajouter au panier" title="Ajouter au panier">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
              </button>
            `}
          </div>
        </div>
      </div>
    `;
  }

  // Écouteurs sur les cartes produits
  function attachProductCardListeners(container) {
    container.querySelectorAll('.product-card').forEach(card => {
      const pid = card.dataset.id;
      const prod = (catalogData.products || []).find(p => p.id === pid);
      if (!prod) return;

      // Clic vignette ou titre -> ouvrir la fiche
      card.querySelector('.card-thumb-link').addEventListener('click', () => openProductModal(prod));
      card.querySelector('.card-title').addEventListener('click', () => openProductModal(prod));

      // Bouton Commander -> ouvre la fiche pour choisir la quantité ou passer commande
      const orderBtn = card.querySelector('.card-btn-order');
      if (orderBtn && prod.available !== false) {
        orderBtn.addEventListener('click', () => openProductModal(prod));
      }

      // Bouton Panier direct
      const cartBtn = card.querySelector('.card-btn-cart');
      if (cartBtn && prod.available !== false) {
        cartBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          window.aniCart.addItem(prod, 1);
          showToast(`« ${prod.name} » ajouté au panier !`);
          animateCartIcon();
        });
      }
    });
  }

  // 10. Groupe WhatsApp & Infos Pratiques
  function renderPracticalInfo() {
    const s = catalogData.settings || {};

    // Groupe WhatsApp
    if (dom.waGroupCard) {
      if (s.groupUrl && s.groupUrl.trim()) {
        dom.waGroupCard.style.display = 'flex';
        if (dom.waGroupBtn) dom.waGroupBtn.href = s.groupUrl.trim();
      } else {
        dom.waGroupCard.style.display = 'none';
      }
    }

    // Cartes infos pratiques
    if (dom.practicalCardsGrid) {
      let cards = '';
      if (s.location && s.location.trim()) {
        cards += `
          <div class="practical-card">
            <h3 class="practical-card-title">Localisation</h3>
            <p>${escapeHtml(s.location)}</p>
          </div>
        `;
      }
      if (s.delivery && s.delivery.trim()) {
        cards += `
          <div class="practical-card">
            <h3 class="practical-card-title">Livraison</h3>
            <p>${escapeHtml(s.delivery)}</p>
          </div>
        `;
      }
      if (s.payment && s.payment.trim()) {
        cards += `
          <div class="practical-card">
            <h3 class="practical-card-title">Modalités de paiement</h3>
            <p>${escapeHtml(s.payment)}</p>
          </div>
        `;
      }

      dom.practicalCardsGrid.innerHTML = cards;
      if (!cards && (!s.groupUrl || !s.groupUrl.trim())) {
        if (dom.practicalSection) dom.practicalSection.style.display = 'none';
      } else if (dom.practicalSection) {
        dom.practicalSection.style.display = 'block';
      }
    }
  }

  // 12. Pied de page
  function renderFooter() {
    const cats = catalogData.categories || [];
    const products = catalogData.products || [];

    if (dom.footerCategories) {
      const visibleCats = cats.filter(c => !c.hidden && products.some(p => p.categoryId === c.id && !p.hidden));
      dom.footerCategories.innerHTML = visibleCats.map(c => `
        <li><a href="#categorie=${c.id}" class="footer-cat-link" data-cat="${c.id}">${escapeHtml(c.name)}</a></li>
      `).join('');

      dom.footerCategories.querySelectorAll('.footer-cat-link').forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          selectCategory(link.dataset.cat);
          scrollToCatalog();
        });
      });
    }

    const s = catalogData.settings || {};
    if (dom.footerCredit) {
      dom.footerCredit.style.display = s.showCredit ? 'block' : 'none';
    }

    const footerGroupLink = document.getElementById('footer-group-link');
    if (footerGroupLink) {
      if (s.groupUrl && s.groupUrl.trim()) {
        footerGroupLink.href = s.groupUrl.trim();
        footerGroupLink.style.display = 'inline-block';
      } else {
        footerGroupLink.style.display = 'none';
      }
    }
  }

  // Fiche Produit (Modal Detail)
  function openProductModal(product) {
    currentModalProduct = product;
    currentModalQty = 1;

    const img = (product.images && product.images.length > 0) ? product.images[0] : 'assets/brand/logo-rond.png';
    dom.modalProductImg.src = img;
    dom.modalProductImg.alt = product.name;
    dom.modalProductTitle.textContent = product.name;
    dom.modalProductPrice.textContent = window.aniCart.formatPrice(product.price);
    dom.modalProductUnit.textContent = product.unit ? `(${product.unit})` : '';
    dom.modalProductDesc.textContent = product.description || 'Produit de qualité sélectionné par ANI MARKET.';

    const catObj = (catalogData.categories || []).find(c => c.id === product.categoryId);
    dom.modalProductCategory.textContent = catObj ? catObj.name : '';

    dom.modalQtyVal.textContent = '1';

    updateModalDirectWhatsAppUrl();

    dom.productModalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeProductModal() {
    dom.productModalOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  function updateModalDirectWhatsAppUrl() {
    if (!currentModalProduct) return;
    const s = catalogData.settings || {};
    const url = window.aniCart.getProductDirectWhatsAppUrl(s.whatsapp, currentModalProduct, currentModalQty, s.name);
    dom.modalBtnOrderWa.href = url;
  }

  // Tiroir Panier (Cart Drawer)
  function openCart() {
    renderCartDrawerItems();
    dom.cartModalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeCart() {
    dom.cartModalOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  function renderCartDrawerItems() {
    const items = window.aniCart.getItems();
    if (items.length === 0) {
      dom.cartItemsList.innerHTML = `
        <div style="text-align:center; padding:40px 10px; color:var(--ink-light);">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin:0 auto 12px; display:block; opacity:0.4;"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          <p style="font-size:1.05rem; font-weight:600; margin-bottom:6px;">Votre panier est vide</p>
          <p style="font-size:0.88rem;">Ajoutez des articles depuis le catalogue pour passer votre commande.</p>
        </div>
      `;
      dom.cartTotalPrice.textContent = '0 FCFA';
      dom.cartOrderWaBtn.style.opacity = '0.5';
      dom.cartOrderWaBtn.style.pointerEvents = 'none';
      return;
    }

    dom.cartOrderWaBtn.style.opacity = '1';
    dom.cartOrderWaBtn.style.pointerEvents = 'auto';

    dom.cartItemsList.innerHTML = items.map(it => {
      const subtotal = it.price * it.qty;
      const unitStr = it.unit ? ` (${escapeHtml(it.unit)})` : '';
      return `
        <div class="cart-item-row" data-id="${it.id}">
          <img src="${escapeHtml(it.image || 'assets/brand/logo-rond.png')}" alt="${escapeHtml(it.name)}" class="cart-item-img" />
          <div class="cart-item-info">
            <span class="cart-item-name">${escapeHtml(it.name)}${unitStr}</span>
            <span class="cart-item-price price-tag">${window.aniCart.formatPrice(subtotal)}</span>
          </div>
          <div class="cart-qty-controls">
            <button class="cart-qty-btn btn-cart-minus" type="button" aria-label="Diminuer">-</button>
            <span class="cart-qty-num">${it.qty}</span>
            <button class="cart-qty-btn btn-cart-plus" type="button" aria-label="Augmenter">+</button>
          </div>
          <button class="cart-item-remove btn-cart-del" type="button" aria-label="Supprimer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      `;
    }).join('');

    dom.cartTotalPrice.textContent = window.aniCart.formatPrice(window.aniCart.getTotal());

    const s = catalogData.settings || {};
    dom.cartOrderWaBtn.href = window.aniCart.getWhatsAppUrl(s.whatsapp, s.name);

    // Écouteurs sur les lignes du panier
    dom.cartItemsList.querySelectorAll('.cart-item-row').forEach(row => {
      const pid = row.dataset.id;
      row.querySelector('.btn-cart-minus').addEventListener('click', () => {
        window.aniCart.updateQty(pid, -1);
      });
      row.querySelector('.btn-cart-plus').addEventListener('click', () => {
        window.aniCart.updateQty(pid, 1);
      });
      row.querySelector('.btn-cart-del').addEventListener('click', () => {
        window.aniCart.removeItem(pid);
      });
    });
  }

  // Mise à jour de l'UI du Panier (Badge + Barre Mobile)
  function updateCartUI() {
    const count = window.aniCart.getCount();
    const total = window.aniCart.getTotal();

    if (dom.cartCountBadge) {
      dom.cartCountBadge.textContent = count;
      dom.cartCountBadge.style.display = count > 0 ? 'flex' : 'none';
    }

    if (dom.mobileCartBar) {
      if (count > 0) {
        dom.mobileCartBar.classList.add('visible');
        if (dom.mobileCartCount) dom.mobileCartCount.textContent = `${count} article${count > 1 ? 's' : ''}`;
        if (dom.mobileCartTotal) dom.mobileCartTotal.textContent = window.aniCart.formatPrice(total);
      } else {
        dom.mobileCartBar.classList.remove('visible');
      }
    }

    // Rafraîchir l'intérieur du tiroir si ouvert
    if (dom.cartModalOverlay && dom.cartModalOverlay.classList.contains('active')) {
      renderCartDrawerItems();
    }
  }

  function animateCartIcon() {
    if (dom.cartCountBadge) {
      dom.cartCountBadge.classList.remove('bump');
      void dom.cartCountBadge.offsetWidth; // re-flow
      dom.cartCountBadge.classList.add('bump');
    }
  }

  // Recherche Plein Écran
  function openSearchOverlay() {
    dom.searchOverlay.classList.add('active');
    dom.searchOverlayInput.value = '';
    dom.searchOverlayResults.innerHTML = '';
    dom.searchOverlayInput.focus();
    document.body.style.overflow = 'hidden';
  }

  function closeSearchOverlay() {
    dom.searchOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  function handleOverlaySearch(query) {
    const q = query.toLowerCase().trim();
    if (!q) {
      dom.searchOverlayResults.innerHTML = '';
      return;
    }
    const products = (catalogData.products || []).filter(p => !p.hidden);
    const matches = products.filter(p => (p.name || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));

    if (matches.length === 0) {
      dom.searchOverlayResults.innerHTML = `
        <p style="color:var(--gold-l); text-align:center; padding:30px;">Aucun produit correspondant.</p>
      `;
      return;
    }

    dom.searchOverlayResults.innerHTML = matches.map(p => `
      <div class="cart-item-row" data-id="${p.id}" style="cursor:pointer; margin-bottom:12px; background:rgba(255,255,255,0.06); border-color:var(--gold);">
        <img src="${escapeHtml(p.images[0])}" alt="${escapeHtml(p.name)}" class="cart-item-img" />
        <div class="cart-item-info">
          <span class="cart-item-name" style="color:var(--white);">${escapeHtml(p.name)}</span>
          <span class="cart-item-price price-tag" style="color:var(--gold-l);">${window.aniCart.formatPrice(p.price)}</span>
        </div>
      </div>
    `).join('');

    dom.searchOverlayResults.querySelectorAll('.cart-item-row').forEach(row => {
      row.addEventListener('click', () => {
        const prod = matches.find(p => p.id === row.dataset.id);
        closeSearchOverlay();
        if (prod) openProductModal(prod);
      });
    });
  }

  // Gestion du Scroll & Hash
  function scrollToCatalog() {
    const el = document.getElementById('catalogue');
    if (el) {
      const topOffset = el.getBoundingClientRect().top + window.pageYOffset - 80;
      window.scrollTo({ top: topOffset, behavior: 'smooth' });
    }
  }

  function updateUrlHash() {
    if (activeCategory && activeCategory !== 'all') {
      window.history.replaceState(null, null, `#categorie=${activeCategory}`);
    } else {
      window.history.replaceState(null, null, ' ');
    }
  }

  function handleHashNavigation() {
    const hash = window.location.hash;
    if (!hash) return;
    if (hash.startsWith('#categorie=')) {
      const cat = hash.replace('#categorie=', '');
      selectCategory(cat);
    }
  }

  // Écouteurs d'événements
  function setupEventListeners() {
    // Panier événements
    window.addEventListener('ani:cart-updated', updateCartUI);

    if (dom.btnCartHeader) dom.btnCartHeader.addEventListener('click', openCart);
    if (dom.cartCloseBtn) dom.cartCloseBtn.addEventListener('click', closeCart);
    if (dom.btnMobileCart) dom.btnMobileCart.addEventListener('click', openCart);
    if (dom.cartModalOverlay) {
      dom.cartModalOverlay.addEventListener('click', (e) => {
        if (e.target === dom.cartModalOverlay) closeCart();
      });
    }

    // Fiche produit modale
    if (dom.productCloseBtn) dom.productCloseBtn.addEventListener('click', closeProductModal);
    if (dom.productModalOverlay) {
      dom.productModalOverlay.addEventListener('click', (e) => {
        if (e.target === dom.productModalOverlay) closeProductModal();
      });
    }

    if (dom.modalQtyMinus) {
      dom.modalQtyMinus.addEventListener('click', () => {
        if (currentModalQty > 1) {
          currentModalQty--;
          dom.modalQtyVal.textContent = currentModalQty;
          updateModalDirectWhatsAppUrl();
        }
      });
    }
    if (dom.modalQtyPlus) {
      dom.modalQtyPlus.addEventListener('click', () => {
        currentModalQty++;
        dom.modalQtyVal.textContent = currentModalQty;
        updateModalDirectWhatsAppUrl();
      });
    }
    if (dom.modalBtnAddToCart) {
      dom.modalBtnAddToCart.addEventListener('click', () => {
        if (currentModalProduct) {
          window.aniCart.addItem(currentModalProduct, currentModalQty);
          showToast(`« ${currentModalProduct.name} » ajouté au panier !`);
          animateCartIcon();
          closeProductModal();
        }
      });
    }

    // Recherche
    if (dom.btnSearchHeader) dom.btnSearchHeader.addEventListener('click', openSearchOverlay);
    if (dom.searchOverlayClose) dom.searchOverlayClose.addEventListener('click', closeSearchOverlay);
    if (dom.searchOverlayInput) {
      dom.searchOverlayInput.addEventListener('input', (e) => {
        handleOverlaySearch(e.target.value);
      });
    }

    if (dom.catalogSearchInput) {
      dom.catalogSearchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        if (dom.searchClearBtn) {
          dom.searchClearBtn.classList.toggle('visible', !!searchQuery);
        }
        displayedCount = PAGE_SIZE;
        renderCatalog();
      });
    }

    if (dom.searchClearBtn) {
      dom.searchClearBtn.addEventListener('click', () => {
        searchQuery = '';
        dom.catalogSearchInput.value = '';
        dom.searchClearBtn.classList.remove('visible');
        displayedCount = PAGE_SIZE;
        renderCatalog();
      });
    }

    if (dom.sortSelect) {
      dom.sortSelect.addEventListener('change', (e) => {
        activeSort = e.target.value;
        renderCatalog();
      });
    }

    if (dom.loadMoreBtn) {
      dom.loadMoreBtn.addEventListener('click', () => {
        displayedCount += PAGE_SIZE;
        renderCatalog();
      });
    }

    // Scroll header & retour haut
    window.addEventListener('scroll', () => {
      const scrollY = window.pageYOffset;
      if (dom.mainHeader) {
        dom.mainHeader.classList.toggle('scrolled', scrollY > 20);
      }
      if (dom.backToTop) {
        dom.backToTop.classList.toggle('visible', scrollY > 400);
      }
    });

    if (dom.backToTop) {
      dom.backToTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    // Touche Échap pour fermer les modales
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeCart();
        closeProductModal();
        closeSearchOverlay();
      }
    });
  }

  // Helper XSS
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Démarrage
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
