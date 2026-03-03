// ui.js

const UI = {
    loader: document.getElementById('loader-overlay'),
    toastContainer: document.getElementById('toast-container'),

    showLoader: function () {
        this.loader.classList.remove('hidden');
    },

    hideLoader: function () {
        this.loader.classList.add('hidden');
    },

    toast: function (message, type = 'success') {
        const el = document.createElement('div');
        el.className = `toast toast-${type}`;

        const icon = document.createElement('i');
        icon.className = type === 'success' ? 'ri-checkbox-circle-fill' : 'ri-error-warning-fill';

        const text = document.createElement('span');
        text.textContent = message;

        el.appendChild(icon);
        el.appendChild(text);
        this.toastContainer.appendChild(el);

        setTimeout(() => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(-20px)';
            el.style.transition = 'all 0.3s ease';
            setTimeout(() => el.remove(), 300);
        }, 3000);
    },

    renderItems: function () {
        const container = document.getElementById('inventory-list');
        container.innerHTML = '';

        const items = State.getFilteredItems();

        if (items.length === 0) {
            container.innerHTML = `
        <div class="empty-state">
          <i class="ri-inbox-archive-line"></i>
          <p>条件に一致するデータがありません。</p>
        </div>
      `;
            return;
        }

        items.forEach(item => {
            const isOut = Number(item.qty) <= 0;
            const isWarning = item.threshold && Number(item.qty) <= Number(item.threshold);

            const el = document.createElement('div');
            el.className = `item-card ${isOut ? 'is-out' : ''}`;

            let thumbnailHtml = '<i class="ri-image-line"></i>';
            if (item.photo_urls) {
                // Just take the first image if multiple
                const firstImg = item.photo_urls.split(',')[0];
                thumbnailHtml = `<img src="${firstImg}" loading="lazy" alt="${item.name}">`;
            }

            let badgesHtml = '';
            if (item.category) badgesHtml += `<span class="badge badge-primary">${item.category}</span>`;
            if (item.location) badgesHtml += `<span class="badge badge-primary">${item.location}</span>`;
            if (isOut) badgesHtml += `<span class="badge badge-danger">在庫なし</span>`;
            else if (isWarning) badgesHtml += `<span class="badge badge-warning">要発注</span>`;

            el.innerHTML = `
        <div class="item-thumbnail">${thumbnailHtml}</div>
        <div class="item-info">
          <div class="item-name">${item.name}</div>
          <div class="item-meta">${badgesHtml}</div>
          <div class="item-qty">
            <span class="qty-number ${isOut ? 'empty' : ''}">${item.qty} ${item.unit}</span>
            <button class="btn-primary btn-consume" data-id="${item.item_id}" ${isOut ? 'disabled' : ''}>消費する</button>
          </div>
        </div>
      `;
            container.appendChild(el);
        });

        // Add event listeners to consume buttons
        document.querySelectorAll('.btn-consume').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                App.openConsumeModal(id);
            });
        });
    },

    renderSelectOptions: function (selectId, options, defaultText) {
        const select = document.getElementById(selectId);
        if (!select) return;
        select.innerHTML = `<option value="">${defaultText}</option>`;
        options.forEach(opt => {
            const el = document.createElement('option');
            el.value = opt;
            el.textContent = opt;
            select.appendChild(el);
        });
    }
};
