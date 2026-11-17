/**
 * ANI MARKET - Gestion du Panier (cart.js)
 * Stockage localStorage avec gestion d'erreurs, événements réactifs
 */
(function() {
  'use strict';

  const STORAGE_KEY = 'ani_market_cart_v2';

  class AniCart {
    constructor() {
      this.items = this.load();
      this.listeners = [];
    }

    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        console.warn('Erreur lecture localStorage panier:', e);
        return [];
      }
    }

    save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
      } catch (e) {
        console.warn('Erreur sauvegarde localStorage panier:', e);
      }
      this.notify();
    }

    notify() {
      const detail = {
        items: this.items,
        count: this.getCount(),
        total: this.getTotal()
      };
      window.dispatchEvent(new CustomEvent('ani:cart-updated', { detail }));
      this.listeners.forEach(fn => fn(detail));
    }

    onChange(fn) {
      if (typeof fn === 'function') {
        this.listeners.push(fn);
        fn({
          items: this.items,
          count: this.getCount(),
          total: this.getTotal()
        });
      }
    }

    getItems() {
      return this.items;
    }

    getCount() {
      return this.items.reduce((acc, item) => acc + (item.qty || 1), 0);
    }

    getTotal() {
      return this.items.reduce((acc, item) => acc + ((item.price || 0) * (item.qty || 1)), 0);
    }

    addItem(product, qty = 1) {
      if (!product || !product.id) return;
      qty = parseInt(qty, 10) || 1;
      if (qty <= 0) qty = 1;

      const existingIndex = this.items.findIndex(it => it.id === product.id);
      if (existingIndex > -1) {
        this.items[existingIndex].qty += qty;
      } else {
        const img = (product.images && product.images.length > 0) ? product.images[0] : '';
        this.items.push({
          id: product.id,
          name: product.name,
          price: parseInt(product.price, 10) || 0,
          unit: product.unit || '',
          image: img,
          qty: qty
        });
      }
      this.save();
    }

    updateQty(productId, delta) {
      const idx = this.items.findIndex(it => it.id === productId);
      if (idx === -1) return;
      const newQty = (this.items[idx].qty || 1) + delta;
      if (newQty <= 0) {
        this.items.splice(idx, 1);
      } else {
        this.items[idx].qty = newQty;
      }
      this.save();
    }

    removeItem(productId) {
      const idx = this.items.findIndex(it => it.id === productId);
      if (idx > -1) {
        this.items.splice(idx, 1);
        this.save();
      }
    }

    clear() {
      this.items = [];
      this.save();
    }

    formatPrice(amount) {
      const n = Math.round(Number(amount) || 0);
      return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA';
    }

    getWhatsAppUrl(phone, shopName = 'ANI MARKET') {
      const cleanPhone = (phone || '2290196273834').replace(/[^0-9]/g, '');
      if (this.items.length === 0) {
        const text = encodeURIComponent(`Bonjour ${shopName}, je vous contacte depuis votre boutique en ligne.`);
        return `https://wa.me/${cleanPhone}?text=${text}`;
      }

      let text = `Bonjour ${shopName},\nJe souhaite passer la commande suivante :\n\n`;
      this.items.forEach((it, i) => {
        const subtotal = (it.price * it.qty);
        const unitPart = it.unit ? ` (${it.unit})` : '';
        text += `${i + 1}. *${it.name}*${unitPart}\n   Quantité : ${it.qty} × ${this.formatPrice(it.price)} = *${this.formatPrice(subtotal)}*\n`;
      });
      text += `\n*Total : ${this.formatPrice(this.getTotal())}*\n\nPourriez-vous me confirmer la disponibilité et les modalités de livraison ? Merci !`;

      return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    }

    getProductDirectWhatsAppUrl(phone, product, qty = 1, shopName = 'ANI MARKET') {
      const cleanPhone = (phone || '2290196273834').replace(/[^0-9]/g, '');
      const unitPart = product.unit ? ` (${product.unit})` : '';
      const total = (product.price || 0) * (qty || 1);
      const url = window.location.href.split('#')[0];
      
      let text = `Bonjour ${shopName},\nJe souhaite commander :\n\n`;
      text += `*${product.name}*${unitPart}\n`;
      text += `Quantité : ${qty}\n`;
      text += `Prix unitaire : ${this.formatPrice(product.price)}\n`;
      text += `Total : *${this.formatPrice(total)}*\n\n`;
      text += `Lien boutique : ${url}\n\n`;
      text += `Le produit est-il disponible ? Merci !`;

      return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    }
  }

  window.aniCart = new AniCart();
})();
