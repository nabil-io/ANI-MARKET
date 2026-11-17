/**
 * ANI MARKET - Logique Espace Administrateur (admin.js)
 * Cahier des charges v2.0 - Gestion en 2 modes automatiques
 */

(function() {
  'use strict';

  let catalog = null;
  let activeTab = 'tab-products';
  let editingProduct = null;
  let uploadedImages = []; // Array of strings (URLs/paths)
  let pendingDeleteProduct = null;
  let undoTimer = null;
  let undoSecondsLeft = 8;

  // DOM Elements
  const dom = {
    // Auth & Wrappers
    authSection: document.getElementById('auth-section'),
    adminDashboard: document.getElementById('admin-dashboard'),
    authForm: document.getElementById('auth-form'),
    authTitle: document.getElementById('auth-title'),
    authDesc: document.getElementById('auth-desc'),
    authCodeInput: document.getElementById('auth-code-input'),
    authCodeConfirmGroup: document.getElementById('auth-code-confirm-group'),
    authCodeConfirmInput: document.getElementById('auth-code-confirm-input'),
    authSubmitBtn: document.getElementById('auth-submit-btn'),
    authTogglePass: document.getElementById('auth-toggle-pass'),
    authErrorMsg: document.getElementById('auth-error-msg'),

    // Mode Banner
    modeBanner: document.getElementById('mode-banner'),
    modeBannerText: document.getElementById('mode-banner-text'),
    modeBannerAction: document.getElementById('mode-banner-action'),

    // Tabs
    tabNavBtns: document.querySelectorAll('.nav-tab-btn'),
    tabPanes: document.querySelectorAll('.admin-tab-pane'),

    // Tab 1 : Produits
    adminSearchInput: document.getElementById('admin-search-input'),
    adminCatFilter: document.getElementById('admin-cat-filter'),
    btnAddProduct: document.getElementById('btn-add-product'),
    adminProductsList: document.getElementById('admin-products-list'),

    // Modale Éditeur Produit
    editorOverlay: document.getElementById('editor-modal-overlay'),
    editorForm: document.getElementById('editor-form'),
    editorTitle: document.getElementById('editor-modal-title'),
    editorCloseBtn: document.getElementById('editor-close-btn'),
    editorCancelBtn: document.getElementById('editor-cancel-btn'),
    editorSaveBtn: document.getElementById('editor-save-btn'),
    
    // Champs éditeur
    prodName: document.getElementById('editor-prod-name'),
    prodCat: document.getElementById('editor-prod-cat'),
    prodPrice: document.getElementById('editor-prod-price'),
    prodUnit: document.getElementById('editor-prod-unit'),
    prodDesc: document.getElementById('editor-prod-desc'),
    prodBadge: document.getElementById('editor-prod-badge'),
    prodAvailable: document.getElementById('editor-prod-available'),
    prodImageInput: document.getElementById('editor-image-input'),
    imageSlotsContainer: document.getElementById('image-slots-container'),

    // Aperçu direct dans l'éditeur
    prevThumb: document.getElementById('prev-thumb'),
    prevBadge: document.getElementById('prev-badge'),
    prevTitle: document.getElementById('prev-title'),
    prevPrice: document.getElementById('prev-price'),
    prevUnit: document.getElementById('prev-unit'),

    // Tab 2 : Catégories
    categoriesList: document.getElementById('categories-list'),
    newCatForm: document.getElementById('new-cat-form'),
    newCatName: document.getElementById('new-cat-name'),

    // Tab 3 : Réglages
    settingsForm: document.getElementById('settings-form'),
    settName: document.getElementById('sett-name'),
    settTagline: document.getElementById('sett-tagline'),
    settPunchline: document.getElementById('sett-punchline'),
    settWhatsapp: document.getElementById('sett-whatsapp'),
    settGroupUrl: document.getElementById('sett-group-url'),
    settLocation: document.getElementById('sett-location'),
    settDelivery: document.getElementById('sett-delivery'),
    settPayment: document.getElementById('sett-payment'),
    settShowCredit: document.getElementById('sett-show-credit'),
    logoFileInput: document.getElementById('sett-logo-file'),
    currentLogoImg: document.getElementById('current-logo-img'),

    // Tab 4 : Compte & Système
    systemModeText: document.getElementById('system-mode-text'),
    btnExportZip: document.getElementById('btn-export-zip'),
    btnResetDraft: document.getElementById('btn-reset-draft'),
    changeCodeForm: document.getElementById('change-code-form'),
    oldCodeInput: document.getElementById('old-code-input'),
    newCodeInput: document.getElementById('new-code-input'),
    btnLogout: document.getElementById('btn-logout'),

    // Undo Snackbar & Toast
    undoSnackbar: document.getElementById('undo-snackbar'),
    undoText: document.getElementById('undo-text'),
    undoBtn: document.getElementById('undo-btn'),
    adminToast: document.getElementById('admin-toast')
  };

  // Notification Toast
  function showToast(msg) {
    if (!dom.adminToast) return;
    dom.adminToast.textContent = msg;
    dom.adminToast.classList.add('show');
    setTimeout(() => {
      dom.adminToast.classList.remove('show');
    }, 3000);
  }

  // Initialisation
  async function init() {
    setupEvents();
    const mode = await window.aniAPI.detectMode();
    renderModeBanner(mode);

    const isLogged = await window.aniAPI.checkSession();
    if (isLogged) {
      showDashboard();
    } else {
      showAuth();
    }
  }

  // Rendu du bandeau de mode
  function renderModeBanner(mode) {
    if (mode === 'direct') {
      dom.modeBanner.className = 'mode-banner direct';
      dom.modeBannerText.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <span>Mode direct : vos modifications sont publiées immédiatement sur le site.</span>
      `;
      dom.modeBannerAction.innerHTML = '';
      if (dom.systemModeText) {
        dom.systemModeText.textContent = 'Mode Direct (Serveur PHP connecté). Les modifications écrivent directement sur le serveur.';
      }
    } else {
      dom.modeBanner.className = 'mode-banner export';
      dom.modeBannerText.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>Mode export : vos modifications sont enregistrées en brouillon local.</span>
      `;
      dom.modeBannerAction.innerHTML = `
        <button class="btn-admin btn-admin-gold" id="btn-banner-export" style="height:34px; font-size:0.8rem;">Télécharger le paquet</button>
      `;
      const btnExp = document.getElementById('btn-banner-export');
      if (btnExp) btnExp.addEventListener('click', handleExportZip);
      if (dom.systemModeText) {
        dom.systemModeText.textContent = 'Mode Export (Hébergement statique pur). Téléchargez le paquet ZIP et déposez-le sur votre hébergeur pour publier vos changements.';
      }
    }
  }

  // Gestion Écran Authentification (Setup vs Login)
  function showAuth() {
    dom.authSection.style.display = 'block';
    dom.adminDashboard.style.display = 'none';

    if (!window.aniAPI.hasCode) {
      dom.authTitle.textContent = 'Créer mon code d\'accès';
      dom.authDesc.textContent = 'Bienvenue ! Veuillez choisir votre code personnel d\'administration (au moins 8 caractères).';
      dom.authCodeConfirmGroup.style.display = 'block';
      dom.authSubmitBtn.textContent = 'Créer mon code et ouvrir l\'espace';
    } else {
      dom.authTitle.textContent = 'Connexion Administrateur';
      dom.authDesc.textContent = 'Entrez votre code d\'accès pour gérer votre boutique ANI MARKET.';
      dom.authCodeConfirmGroup.style.display = 'none';
      dom.authSubmitBtn.textContent = 'Accéder à l\'administration';
    }
  }

  async function handleAuthSubmit(e) {
    e.preventDefault();
    dom.authErrorMsg.textContent = '';
    const code = dom.authCodeInput.value.trim();

    if (!window.aniAPI.hasCode) {
      const confirm = dom.authCodeConfirmInput.value.trim();
      if (code.length < 8) {
        dom.authErrorMsg.textContent = 'Le code doit contenir au moins 8 caractères.';
        return;
      }
      if (code !== confirm) {
        dom.authErrorMsg.textContent = 'Les deux codes ne correspondent pas.';
        return;
      }
      try {
        await window.aniAPI.setup(code);
        showToast('Code d\'accès créé avec succès !');
        showDashboard();
      } catch (err) {
        dom.authErrorMsg.textContent = err.message || 'Erreur lors de la configuration.';
      }
    } else {
      try {
        await window.aniAPI.login(code);
        showDashboard();
      } catch (err) {
        dom.authErrorMsg.textContent = err.message || 'Code d\'accès incorrect.';
      }
    }
  }

  // Affichage du Dashboard
  async function showDashboard() {
    dom.authSection.style.display = 'none';
    dom.adminDashboard.style.display = 'block';
    await loadAdminCatalog();
  }

  async function loadAdminCatalog() {
    try {
      catalog = await window.aniAPI.loadCatalog(true);
      renderProductsTab();
      renderCategoriesTab();
      renderSettingsTab();
    } catch (e) {
      showToast('Erreur chargement données admin');
    }
  }

  // Navigation par Onglets
  function switchTab(targetId) {
    activeTab = targetId;
    dom.tabNavBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === targetId);
    });
    dom.tabPanes.forEach(pane => {
      pane.classList.toggle('active', pane.id === targetId);
    });
  }

  // --------------------------------------------------------------------------
  // TAB 1 : PRODUITS
  // --------------------------------------------------------------------------
  function renderProductsTab() {
    if (!catalog) return;

    // Remplir le filtre de catégorie
    const cats = catalog.categories || [];
    let catOptions = '<option value="all">Toutes les catégories</option>';
    cats.forEach(c => {
      catOptions += `<option value="${c.id}">${escapeHtml(c.name)}</option>`;
    });
    dom.adminCatFilter.innerHTML = catOptions;

    filterAndRenderProducts();
  }

  function filterAndRenderProducts() {
    if (!catalog) return;
    const q = (dom.adminSearchInput.value || '').toLowerCase().trim();
    const cat = dom.adminCatFilter.value;

    let list = catalog.products || [];
    if (cat !== 'all') {
      list = list.filter(p => p.categoryId === cat);
    }
    if (q) {
      list = list.filter(p => (p.name || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
    }

    if (list.length === 0) {
      dom.adminProductsList.innerHTML = `
        <div style="text-align:center; padding:40px; color:var(--ink-light);">
          <p>Aucun produit ne correspond à ces critères.</p>
        </div>
      `;
      return;
    }

    dom.adminProductsList.innerHTML = list.map(p => {
      const isAvail = p.available !== false;
      const catObj = (catalog.categories || []).find(c => c.id === p.categoryId);
      const catName = catObj ? catObj.name : 'Autre';
      const img = (p.images && p.images.length > 0) ? p.images[0] : '../assets/brand/logo-rond.png';
      const priceStr = (p.price || 0).toLocaleString('fr-FR') + ' FCFA';

      return `
        <div class="product-row ${!isAvail ? 'sold-out' : ''}" data-id="${p.id}">
          <img src="../${escapeHtml(img)}" alt="${escapeHtml(p.name)}" class="product-row-thumb" />
          <div class="product-row-info">
            <div class="product-row-name">${escapeHtml(p.name)}</div>
            <div class="product-row-sub">
              <span><strong>${priceStr}</strong></span>
              <span>•</span>
              <span>${escapeHtml(catName)}</span>
              ${p.unit ? `<span>(${escapeHtml(p.unit)})</span>` : ''}
              ${p.hidden ? '<span style="color:#d32f2f;">[Masqué]</span>' : ''}
            </div>
          </div>
          <div class="product-row-actions">
            <!-- Interrupteur Disponible / Épuisé rapide -->
            <label class="switch-box" title="Disponibilité en stock">
              <span class="switch">
                <input type="checkbox" class="toggle-avail-check" ${isAvail ? 'checked' : ''} />
                <span class="slider"></span>
              </span>
            </label>
            <button class="btn-admin btn-admin-outline btn-edit-prod" title="Modifier le produit">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            </button>
            <button class="btn-admin btn-admin-outline btn-hide-prod" title="${p.hidden ? 'Rendre visible' : 'Masquer'}">
              ${p.hidden ? 
                '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' :
                '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22"/></svg>'
              }
            </button>
            <button class="btn-admin btn-admin-danger btn-del-prod" title="Supprimer le produit">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Attacher les écouteurs de la liste
    dom.adminProductsList.querySelectorAll('.product-row').forEach(row => {
      const pid = row.dataset.id;
      const prod = catalog.products.find(p => p.id === pid);
      if (!prod) return;

      // Toggle Disponibilité
      row.querySelector('.toggle-avail-check').addEventListener('change', async (e) => {
        prod.available = e.target.checked;
        await window.aniAPI.saveProduct(prod);
        filterAndRenderProducts();
        showToast(prod.available ? 'Produit marqué disponible' : 'Produit marqué épuisé');
      });

      // Modifier
      row.querySelector('.btn-edit-prod').addEventListener('click', () => {
        openProductEditor(prod);
      });

      // Masquer / Rendre visible
      row.querySelector('.btn-hide-prod').addEventListener('click', async () => {
        prod.hidden = !prod.hidden;
        await window.aniAPI.saveProduct(prod);
        filterAndRenderProducts();
        showToast(prod.hidden ? 'Produit masqué sur le site' : 'Produit visible sur le site');
      });

      // Supprimer avec annulation de 8 secondes
      row.querySelector('.btn-del-prod').addEventListener('click', () => {
        confirmDeleteProduct(prod);
      });
    });
  }

  // --------------------------------------------------------------------------
  // MODALE ÉDITEUR PRODUIT (AJOUT / MODIFICATION)
  // --------------------------------------------------------------------------
  function openProductEditor(product = null) {
    editingProduct = product;
    uploadedImages = product && product.images ? [...product.images] : [];

    dom.editorTitle.textContent = product ? 'Modifier le produit' : 'Ajouter un nouveau produit';

    // Remplir la liste des catégories dans l'éditeur
    const cats = (catalog && catalog.categories) ? catalog.categories : [];
    dom.prodCat.innerHTML = cats.map(c => `
      <option value="${c.id}" ${product && product.categoryId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>
    `).join('');

    if (product) {
      dom.prodName.value = product.name || '';
      dom.prodPrice.value = product.price || '';
      dom.prodUnit.value = product.unit || '';
      dom.prodDesc.value = product.description || '';
      dom.prodBadge.value = product.badge || '';
      dom.prodAvailable.checked = product.available !== false;
    } else {
      dom.prodName.value = '';
      dom.prodPrice.value = '';
      dom.prodUnit.value = '';
      dom.prodDesc.value = '';
      dom.prodBadge.value = '';
      dom.prodAvailable.checked = true;
    }

    renderImageSlots();
    updateLivePreview();

    dom.editorOverlay.classList.add('active');
  }

  function closeProductEditor() {
    dom.editorOverlay.classList.remove('active');
    editingProduct = null;
    uploadedImages = [];
  }

  function renderImageSlots() {
    dom.imageSlotsContainer.innerHTML = '';
    // Jusqu'à 4 images
    for (let i = 0; i < 4; i++) {
      const imgPath = uploadedImages[i];
      const slot = document.createElement('div');
      slot.className = 'img-slot';

      if (imgPath) {
        slot.innerHTML = `
          <img src="../${escapeHtml(imgPath)}" alt="Slot ${i + 1}" />
          <button type="button" class="img-slot-del" data-index="${i}">✕</button>
        `;
        slot.querySelector('.img-slot-del').addEventListener('click', (e) => {
          e.stopPropagation();
          uploadedImages.splice(i, 1);
          renderImageSlots();
          updateLivePreview();
        });
      } else {
        slot.innerHTML = `
          <div style="font-size:0.75rem; color:#aaa; text-align:center;">
            + Photo ${i + 1}
          </div>
        `;
        slot.style.cursor = 'pointer';
        slot.addEventListener('click', () => {
          dom.prodImageInput.click();
        });
      }
      dom.imageSlotsContainer.appendChild(slot);
    }
  }

  // Compression automatique d'image côté client (Canvas)
  async function compressImageFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxSide = 1200;
          let w = img.width;
          let h = img.height;
          if (w > maxSide || h > maxSide) {
            if (w > h) {
              h = Math.round((h * maxSide) / w);
              w = maxSide;
            } else {
              w = Math.round((w * maxSide) / h);
              h = maxSide;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);

          // WebP ou JPEG ~0.82
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Erreur compression image'));
          }, 'image/webp', 0.82);
        };
        img.onerror = () => reject(new Error('Image invalide'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Lecture fichier échouée'));
      reader.readAsDataURL(file);
    });
  }

  async function handleImageUpload(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    for (const f of files) {
      if (uploadedImages.length >= 4) {
        showToast('Maximum 4 photos par produit');
        break;
      }
      try {
        showToast('Optimisation de la photo...');
        const compressedBlob = await compressImageFile(f);
        const path = await window.aniAPI.uploadImage(compressedBlob, f.name);
        uploadedImages.push(path);
      } catch (err) {
        showToast('Erreur envoi image : ' + err.message);
      }
    }
    dom.prodImageInput.value = '';
    renderImageSlots();
    updateLivePreview();
  }

  // Aperçu en direct dans l'éditeur
  function updateLivePreview() {
    const name = dom.prodName.value.trim() || 'Nom du produit';
    const price = parseInt(dom.prodPrice.value, 10) || 0;
    const unit = dom.prodUnit.value.trim();
    const badge = dom.prodBadge.value;
    const img = uploadedImages.length > 0 ? uploadedImages[0] : 'assets/brand/logo-rond.png';

    dom.prevTitle.textContent = name;
    dom.prevPrice.textContent = price.toLocaleString('fr-FR') + ' FCFA';
    dom.prevUnit.textContent = unit ? `(${unit})` : '';
    dom.prevThumb.src = `../${img}`;

    if (badge === 'new') {
      dom.prevBadge.textContent = 'Nouveau';
      dom.prevBadge.style.display = 'inline-block';
      dom.prevBadge.className = 'card-badge badge-new';
    } else if (badge === 'popular') {
      dom.prevBadge.textContent = 'Populaire';
      dom.prevBadge.style.display = 'inline-block';
      dom.prevBadge.className = 'card-badge badge-popular';
    } else {
      dom.prevBadge.style.display = 'none';
    }
  }

  async function handleSaveProduct(e) {
    e.preventDefault();
    const name = dom.prodName.value.trim();
    if (!name) {
      showToast('Le nom du produit est obligatoire');
      return;
    }

    const prodData = {
      id: editingProduct ? editingProduct.id : '',
      name: name,
      categoryId: dom.prodCat.value,
      price: parseInt(dom.prodPrice.value, 10) || 0,
      unit: dom.prodUnit.value.trim(),
      description: dom.prodDesc.value.trim(),
      available: dom.prodAvailable.checked,
      badge: dom.prodBadge.value,
      hidden: editingProduct ? (editingProduct.hidden || false) : false,
      images: uploadedImages
    };

    dom.editorSaveBtn.disabled = true;
    dom.editorSaveBtn.textContent = 'Enregistrement...';

    try {
      await window.aniAPI.saveProduct(prodData);
      showToast('Produit enregistré avec succès !');
      closeProductEditor();
      await loadAdminCatalog();
    } catch (err) {
      showToast('Erreur enregistrement : ' + err.message);
    } finally {
      dom.editorSaveBtn.disabled = false;
      dom.editorSaveBtn.textContent = 'Enregistrer le produit';
    }
  }

  // Suppression avec Annulation de 8 secondes
  function confirmDeleteProduct(product) {
    if (!confirm(`Confirmez-vous la suppression de « ${product.name} » ?`)) {
      return;
    }

    pendingDeleteProduct = product;
    // Retirer temporairement de l'affichage
    catalog.products = catalog.products.filter(p => p.id !== product.id);
    filterAndRenderProducts();

    // Lancer le compte à rebours 8s
    undoSecondsLeft = 8;
    dom.undoText.textContent = `Produit supprimé. Annuler (${undoSecondsLeft}s)`;
    dom.undoSnackbar.classList.add('show');

    if (undoTimer) clearInterval(undoTimer);
    undoTimer = setInterval(async () => {
      undoSecondsLeft--;
      if (undoSecondsLeft > 0) {
        dom.undoText.textContent = `Produit supprimé. Annuler (${undoSecondsLeft}s)`;
      } else {
        clearInterval(undoTimer);
        dom.undoSnackbar.classList.remove('show');
        if (pendingDeleteProduct) {
          try {
            await window.aniAPI.deleteProduct(pendingDeleteProduct.id);
            pendingDeleteProduct = null;
            showToast('Suppression définitive effectuée.');
          } catch (e) {
            showToast('Erreur lors de la suppression');
          }
        }
      }
    }, 1000);
  }

  function handleUndoDelete() {
    if (undoTimer) clearInterval(undoTimer);
    dom.undoSnackbar.classList.remove('show');
    if (pendingDeleteProduct) {
      catalog.products.push(pendingDeleteProduct);
      pendingDeleteProduct = null;
      filterAndRenderProducts();
      showToast('Suppression annulée !');
    }
  }

  // --------------------------------------------------------------------------
  // TAB 2 : CATÉGORIES
  // --------------------------------------------------------------------------
  function renderCategoriesTab() {
    if (!catalog) return;
    const cats = catalog.categories || [];
    const products = catalog.products || [];

    dom.categoriesList.innerHTML = cats.map((c, idx) => {
      const count = products.filter(p => p.categoryId === c.id).length;
      return `
        <div class="product-row" data-id="${c.id}" style="margin-bottom:8px;">
          <div style="font-weight:700; color:var(--gold-d); width:28px;">#${idx + 1}</div>
          <div class="product-row-info">
            <div class="product-row-name">${escapeHtml(c.name)}</div>
            <div class="product-row-sub">
              <span>${count} produit${count > 1 ? 's' : ''}</span>
              ${c.hidden ? '<span style="color:#d32f2f;">[Masquée]</span>' : ''}
            </div>
          </div>
          <div class="product-row-actions">
            <button class="btn-admin btn-admin-outline btn-cat-up" ${idx === 0 ? 'disabled style="opacity:0.4"' : ''} title="Monter">↑</button>
            <button class="btn-admin btn-admin-outline btn-cat-down" ${idx === cats.length - 1 ? 'disabled style="opacity:0.4"' : ''} title="Descendre">↓</button>
            <button class="btn-admin btn-admin-outline btn-cat-toggle" title="${c.hidden ? 'Afficher' : 'Masquer'}">
              ${c.hidden ? 'Afficher' : 'Masquer'}
            </button>
            <button class="btn-admin btn-admin-outline btn-cat-rename" title="Renommer">Renommer</button>
          </div>
        </div>
      `;
    }).join('');

    // Écouteurs catégories
    dom.categoriesList.querySelectorAll('.product-row').forEach((row, idx) => {
      const cid = row.dataset.id;
      const cat = cats.find(c => c.id === cid);
      if (!cat) return;

      const btnUp = row.querySelector('.btn-cat-up');
      if (btnUp) {
        btnUp.addEventListener('click', async () => {
          if (idx > 0) {
            const temp = cats[idx];
            cats[idx] = cats[idx - 1];
            cats[idx - 1] = temp;
            cats.forEach((c, i) => c.order = i + 1);
            await window.aniAPI.saveCategories(cats);
            renderCategoriesTab();
            showToast('Ordre mis à jour');
          }
        });
      }

      const btnDown = row.querySelector('.btn-cat-down');
      if (btnDown) {
        btnDown.addEventListener('click', async () => {
          if (idx < cats.length - 1) {
            const temp = cats[idx];
            cats[idx] = cats[idx + 1];
            cats[idx + 1] = temp;
            cats.forEach((c, i) => c.order = i + 1);
            await window.aniAPI.saveCategories(cats);
            renderCategoriesTab();
            showToast('Ordre mis à jour');
          }
        });
      }

      row.querySelector('.btn-cat-toggle').addEventListener('click', async () => {
        cat.hidden = !cat.hidden;
        await window.aniAPI.saveCategories(cats);
        renderCategoriesTab();
        showToast(cat.hidden ? 'Catégorie masquée' : 'Catégorie affichée');
      });

      row.querySelector('.btn-cat-rename').addEventListener('click', async () => {
        const newName = prompt('Nouveau nom pour la catégorie :', cat.name);
        if (newName && newName.trim() && newName.trim() !== cat.name) {
          cat.name = newName.trim();
          await window.aniAPI.saveCategories(cats);
          renderCategoriesTab();
          showToast('Catégorie renommée');
        }
      });
    });
  }

  async function handleAddCategory(e) {
    e.preventDefault();
    const name = dom.newCatName.value.trim();
    if (!name) return;

    const cats = catalog.categories || [];
    const id = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    cats.push({
      id: id || 'cat_' + Date.now(),
      name: name,
      order: cats.length + 1,
      hidden: false
    });

    try {
      await window.aniAPI.saveCategories(cats);
      dom.newCatName.value = '';
      renderCategoriesTab();
      showToast('Nouvelle catégorie ajoutée !');
    } catch (err) {
      showToast('Erreur ajout catégorie : ' + err.message);
    }
  }

  // --------------------------------------------------------------------------
  // TAB 3 : RÉGLAGES
  // --------------------------------------------------------------------------
  function renderSettingsTab() {
    if (!catalog || !catalog.settings) return;
    const s = catalog.settings;
    dom.settName.value = s.name || '';
    dom.settTagline.value = s.tagline || '';
    dom.settPunchline.value = s.punchline || '';
    dom.settWhatsapp.value = s.whatsapp || '';
    dom.settGroupUrl.value = s.groupUrl || '';
    dom.settLocation.value = s.location || '';
    dom.settDelivery.value = s.delivery || '';
    dom.settPayment.value = s.payment || '';
    dom.settShowCredit.checked = !!s.showCredit;
    if (s.logo) {
      dom.currentLogoImg.src = `../${s.logo}`;
    }
  }

  async function handleSaveSettings(e) {
    e.preventDefault();
    const settings = {
      name: dom.settName.value.trim(),
      tagline: dom.settTagline.value.trim(),
      punchline: dom.settPunchline.value.trim(),
      whatsapp: dom.settWhatsapp.value.trim(),
      groupUrl: dom.settGroupUrl.value.trim(),
      location: dom.settLocation.value.trim(),
      delivery: dom.settDelivery.value.trim(),
      payment: dom.settPayment.value.trim(),
      showCredit: dom.settShowCredit.checked
    };

    try {
      await window.aniAPI.saveSettings(settings);
      showToast('Réglages enregistrés avec succès !');
    } catch (err) {
      showToast('Erreur sauvegarde réglages : ' + err.message);
    }
  }

  async function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      showToast('Téléversement du logo...');
      const blob = await compressImageFile(file);
      const path = await window.aniAPI.uploadImage(blob, 'logo_' + file.name);
      await window.aniAPI.saveSettings({ logo: path });
      dom.currentLogoImg.src = `../${path}`;
      showToast('Logo mis à jour avec succès !');
    } catch (err) {
      showToast('Erreur logo : ' + err.message);
    }
  }

  // --------------------------------------------------------------------------
  // TAB 4 : COMPTE & SYSTÈME
  // --------------------------------------------------------------------------
  async function handleExportZip() {
    try {
      showToast('Génération du paquet ZIP...');
      const res = await window.aniAPI.exportPackage();
      showToast(`Paquet ZIP téléchargé (${res.count} fichier(s)) !`);
    } catch (err) {
      showToast('Erreur génération ZIP : ' + err.message);
    }
  }

  function handleResetDraft() {
    if (confirm('Voulez-vous réinitialiser votre brouillon local et recharger les données du serveur ?')) {
      window.aniAPI.resetExportDraft();
      location.reload();
    }
  }

  async function handleChangeCode(e) {
    e.preventDefault();
    const oldCode = dom.oldCodeInput.value.trim();
    const newCode = dom.newCodeInput.value.trim();

    if (newCode.length < 8) {
      showToast('Le nouveau code doit contenir au moins 8 caractères');
      return;
    }

    try {
      await window.aniAPI.changeCode(oldCode, newCode);
      showToast('Code d\'accès modifié avec succès !');
      dom.oldCodeInput.value = '';
      dom.newCodeInput.value = '';
    } catch (err) {
      showToast('Erreur : ' + err.message);
    }
  }

  async function handleLogout() {
    await window.aniAPI.logout();
    location.reload();
  }

  // --------------------------------------------------------------------------
  // Écouteurs Globaux
  // --------------------------------------------------------------------------
  function setupEvents() {
    // Auth
    dom.authForm.addEventListener('submit', handleAuthSubmit);
    dom.authTogglePass.addEventListener('click', () => {
      const type = dom.authCodeInput.type === 'password' ? 'text' : 'password';
      dom.authCodeInput.type = type;
      dom.authTogglePass.textContent = type === 'password' ? '👁' : '🙈';
    });

    // Navigation Tabs
    dom.tabNavBtns.forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Filtres Produits
    dom.adminSearchInput.addEventListener('input', filterAndRenderProducts);
    dom.adminCatFilter.addEventListener('change', filterAndRenderProducts);
    dom.btnAddProduct.addEventListener('click', () => openProductEditor());

    // Modale Éditeur
    dom.editorCloseBtn.addEventListener('click', closeProductEditor);
    dom.editorCancelBtn.addEventListener('click', closeProductEditor);
    dom.editorForm.addEventListener('submit', handleSaveProduct);
    dom.prodImageInput.addEventListener('change', handleImageUpload);

    // Live preview inputs
    ['input', 'change'].forEach(evt => {
      dom.prodName.addEventListener(evt, updateLivePreview);
      dom.prodPrice.addEventListener(evt, updateLivePreview);
      dom.prodUnit.addEventListener(evt, updateLivePreview);
      dom.prodBadge.addEventListener(evt, updateLivePreview);
    });

    // Undo delete
    dom.undoBtn.addEventListener('click', handleUndoDelete);

    // Catégories
    dom.newCatForm.addEventListener('submit', handleAddCategory);

    // Réglages
    dom.settingsForm.addEventListener('submit', handleSaveSettings);
    dom.logoFileInput.addEventListener('change', handleLogoUpload);

    // Système
    if (dom.btnExportZip) dom.btnExportZip.addEventListener('click', handleExportZip);
    if (dom.btnResetDraft) dom.btnResetDraft.addEventListener('click', handleResetDraft);
    dom.changeCodeForm.addEventListener('submit', handleChangeCode);
    dom.btnLogout.addEventListener('click', handleLogout);
  }

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
