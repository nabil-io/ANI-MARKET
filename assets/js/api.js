/**
 * ANI MARKET - Couche API & Abstraction Deux Modes (api.js)
 * Mode 1 : Direct (PHP actif, synchronisation temps réel)
 * Mode 2 : Export (Hébergement statique, brouillon local + export ZIP)
 */
(function() {
  'use strict';

  const DRAFT_KEY = 'ani_market_export_draft_v2';
  const PASS_KEY = 'ani_market_export_code_v2';
  const DB_NAME = 'ani_market_export_db';
  const STORE_NAME = 'uploads';

  // Helper IndexedDB pour Mode 2
  function openIndexedDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'path' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function storeImageInDB(path, blob) {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ path, blob });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getAllImagesFromDB() {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  class AniAPI {
    constructor() {
      this.mode = 'unknown'; // 'direct' ou 'export'
      this.detected = false;
      this.hasCode = false;
      this.activeCatalog = null;
      this.listeners = [];
    }

    // Détection automatique du mode
    async detectMode() {
      if (this.detected) return this.mode;

      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 4000);
        // Chemin relatif vers api.php depuis la racine ou depuis /admin
        const apiPath = window.location.pathname.includes('/admin') ? '../api.php' : 'api.php';
        const res = await fetch(`${apiPath}?r=ping&_=${Date.now()}`, {
          signal: ctrl.signal,
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
        clearTimeout(tid);

        if (res.ok) {
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await res.json();
            if (data && data.ok) {
              this.mode = 'direct';
              this.hasCode = !!data.has_code;
              this.detected = true;
              return this.mode;
            }
          }
        }
      } catch (e) {
        // En cas d'erreur ou timeout, basculer en mode export
      }

      this.mode = 'export';
      this.hasCode = !!localStorage.getItem(PASS_KEY);
      this.detected = true;
      return this.mode;
    }

    getApiPath() {
      return window.location.pathname.includes('/admin') ? '../api.php' : 'api.php';
    }

    getDataPath() {
      return window.location.pathname.includes('/admin') ? '../data/catalog.json' : 'data/catalog.json';
    }

    // Chargement du catalogue public / admin
    async loadCatalog(forceFresh = false) {
      await this.detectMode();

      // En mode export, vérifier s'il existe un brouillon local
      if (this.mode === 'export') {
        const draftRaw = localStorage.getItem(DRAFT_KEY);
        if (draftRaw) {
          try {
            const draft = JSON.parse(draftRaw);
            this.activeCatalog = draft;
            return draft;
          } catch (e) {
            console.warn('Brouillon local invalide');
          }
        }
      }

      // Lecture du fichier data/catalog.json
      const v = forceFresh ? Date.now() : (this.activeCatalog ? this.activeCatalog.version : Date.now());
      const res = await fetch(`${this.getDataPath()}?v=${v}`);
      if (!res.ok) {
        throw new Error('Impossible de charger le catalogue');
      }
      const data = await res.json();
      this.activeCatalog = data;
      return data;
    }

    // Premier lancement / Setup du code
    async setup(code) {
      await this.detectMode();
      if (this.mode === 'direct') {
        const res = await fetch(`${this.getApiPath()}?r=setup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify({ code })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.message || 'Erreur lors de la configuration du code');
        }
        this.hasCode = true;
        return data;
      } else {
        // Mode export : hachage simplifié dans le navigateur
        if (!code || code.length < 8) {
          throw new Error('Le code doit contenir au moins 8 caractères');
        }
        localStorage.setItem(PASS_KEY, btoa(code));
        sessionStorage.setItem('ani_export_session', 'true');
        this.hasCode = true;
        return { ok: true, message: 'Code configuré' };
      }
    }

    // Connexion
    async login(code) {
      await this.detectMode();
      if (this.mode === 'direct') {
        const res = await fetch(`${this.getApiPath()}?r=login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify({ code })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.message || 'Code incorrect');
        }
        return data;
      } else {
        // Mode export : vérification locale
        const stored = localStorage.getItem(PASS_KEY);
        if (!stored) {
          throw new Error('Aucun code configuré');
        }
        if (btoa(code) !== stored) {
          throw new Error('Code d\'accès incorrect');
        }
        sessionStorage.setItem('ani_export_session', 'true');
        return { ok: true, message: 'Connexion réussie' };
      }
    }

    // Déconnexion
    async logout() {
      await this.detectMode();
      if (this.mode === 'direct') {
        await fetch(`${this.getApiPath()}?r=logout`, {
          method: 'POST',
          headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });
      }
      sessionStorage.removeItem('ani_export_session');
      return { ok: true };
    }

    // Vérification de la session
    async checkSession() {
      await this.detectMode();
      if (this.mode === 'direct') {
        try {
          const res = await fetch(`${this.getApiPath()}?r=session&_=${Date.now()}`, {
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
          });
          if (res.ok) {
            const data = await res.json();
            return !!data.logged;
          }
        } catch (e) {}
        return false;
      } else {
        return sessionStorage.getItem('ani_export_session') === 'true';
      }
    }

    // Changement de code d'accès
    async changeCode(oldCode, newCode) {
      await this.detectMode();
      if (this.mode === 'direct') {
        const res = await fetch(`${this.getApiPath()}?r=change_code`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify({ old_code: oldCode, new_code: newCode })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.message || 'Erreur modification code');
        }
        return data;
      } else {
        const stored = localStorage.getItem(PASS_KEY);
        if (btoa(oldCode) !== stored) {
          throw new Error('L\'ancien code d\'accès est incorrect');
        }
        if (!newCode || newCode.length < 8) {
          throw new Error('Le nouveau code doit contenir au moins 8 caractères');
        }
        localStorage.setItem(PASS_KEY, btoa(newCode));
        return { ok: true, message: 'Code modifié' };
      }
    }

    // Envoi d'une image compressée
    async uploadImage(blob, fileName = 'upload.webp') {
      await this.detectMode();
      if (this.mode === 'direct') {
        const fd = new FormData();
        fd.append('image', blob, fileName);
        const res = await fetch(`${this.getApiPath()}?r=upload`, {
          method: 'POST',
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
          body: fd
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.message || 'Erreur lors de l\'envoi de l\'image');
        }
        return data.path;
      } else {
        // Mode export : stocker dans IndexedDB
        const ext = blob.type === 'image/jpeg' ? 'jpg' : (blob.type === 'image/png' ? 'png' : 'webp');
        const rand = Math.random().toString(36).substring(2, 8);
        const path = `uploads/img_${Date.now()}_${rand}.${ext}`;
        await storeImageInDB(path, blob);
        return path;
      }
    }

    // Sauvegarde d'un produit
    async saveProduct(product) {
      await this.detectMode();
      const currentVer = this.activeCatalog ? this.activeCatalog.version : 1;

      if (this.mode === 'direct') {
        const res = await fetch(`${this.getApiPath()}?r=product_save`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify({ product, version: currentVer })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.message || 'Erreur enregistrement produit');
        }
        await this.loadCatalog(true);
        return data;
      } else {
        // Mode export : modifier le catalogue en mémoire et dans localStorage
        const catalog = this.activeCatalog || (await this.loadCatalog());
        if (!catalog.products) catalog.products = [];

        const isNew = !product.id;
        const now = new Date().toISOString();
        if (isNew) {
          product.id = 'p_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
          product.createdAt = now;
        }
        product.updatedAt = now;

        const idx = catalog.products.findIndex(p => p.id === product.id);
        if (idx > -1) {
          catalog.products[idx] = product;
        } else {
          catalog.products.push(product);
        }
        catalog.version = (catalog.version || 1) + 1;
        this.activeCatalog = catalog;
        localStorage.setItem(DRAFT_KEY, JSON.stringify(catalog));
        return { ok: true, product, version: catalog.version };
      }
    }

    // Suppression d'un produit
    async deleteProduct(productId) {
      await this.detectMode();
      const currentVer = this.activeCatalog ? this.activeCatalog.version : 1;

      if (this.mode === 'direct') {
        const res = await fetch(`${this.getApiPath()}?r=product_delete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify({ id: productId, version: currentVer })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.message || 'Erreur suppression produit');
        }
        await this.loadCatalog(true);
        return data;
      } else {
        const catalog = this.activeCatalog || (await this.loadCatalog());
        catalog.products = (catalog.products || []).filter(p => p.id !== productId);
        catalog.version = (catalog.version || 1) + 1;
        this.activeCatalog = catalog;
        localStorage.setItem(DRAFT_KEY, JSON.stringify(catalog));
        return { ok: true, version: catalog.version };
      }
    }

    // Sauvegarde des catégories
    async saveCategories(categories) {
      await this.detectMode();
      const currentVer = this.activeCatalog ? this.activeCatalog.version : 1;

      if (this.mode === 'direct') {
        const res = await fetch(`${this.getApiPath()}?r=categories_save`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify({ categories, version: currentVer })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.message || 'Erreur sauvegarde catégories');
        }
        await this.loadCatalog(true);
        return data;
      } else {
        const catalog = this.activeCatalog || (await this.loadCatalog());
        catalog.categories = categories;
        catalog.version = (catalog.version || 1) + 1;
        this.activeCatalog = catalog;
        localStorage.setItem(DRAFT_KEY, JSON.stringify(catalog));
        return { ok: true, version: catalog.version };
      }
    }

    // Sauvegarde des réglages
    async saveSettings(settings) {
      await this.detectMode();
      const currentVer = this.activeCatalog ? this.activeCatalog.version : 1;

      if (this.mode === 'direct') {
        const res = await fetch(`${this.getApiPath()}?r=settings_save`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify({ settings, version: currentVer })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.message || 'Erreur sauvegarde réglages');
        }
        await this.loadCatalog(true);
        return data;
      } else {
        const catalog = this.activeCatalog || (await this.loadCatalog());
        catalog.settings = Object.assign({}, catalog.settings, settings);
        catalog.version = (catalog.version || 1) + 1;
        this.activeCatalog = catalog;
        localStorage.setItem(DRAFT_KEY, JSON.stringify(catalog));
        return { ok: true, version: catalog.version };
      }
    }

    // Télécharger le paquet ZIP en Mode Export
    async exportPackage() {
      if (typeof window.SimpleZip === 'undefined') {
        throw new Error('Module SimpleZip introuvable');
      }
      const zip = new window.SimpleZip();

      // Ajouter data/catalog.json
      const catalog = this.activeCatalog || (await this.loadCatalog());
      const catalogJson = JSON.stringify(catalog, null, 2);
      zip.add('data/catalog.json', catalogJson);

      // Ajouter les images stockées dans IndexedDB
      const uploads = await getAllImagesFromDB();
      for (const item of uploads) {
        if (item.blob) {
          const ab = await item.blob.arrayBuffer();
          zip.add(item.path, ab);
        }
      }

      const zipBlob = zip.buildBlob();
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ani-market-mise-a-jour-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 2000);

      return { count: uploads.length + 1 };
    }

    // Réinitialiser le brouillon Mode Export
    resetExportDraft() {
      localStorage.removeItem(DRAFT_KEY);
      this.activeCatalog = null;
    }
  }

  window.aniAPI = new AniAPI();
})();
