const API_ORDERS = 'https://690a91d51a446bb9cc22ec28.mockapi.io/api/v1/orders';

document.addEventListener('DOMContentLoaded', loadOrders);

async function loadOrders() {
  const container = document.getElementById('orders-container');
  if (!container) return;

  container.innerHTML = '<p>Загрузка заказов с Олимпа...</p>';

  try {
    const res = await fetch(API_ORDERS);
    if (!res.ok) throw new Error('Ошибка загрузки: ' + res.status);

    const data = await res.json();
    if (!data.length) {
      container.innerHTML = '<p>Пока нет заказов, достойных богов Олимпа 🍇</p>';
      return;
    }

    container.innerHTML = data.map(renderOrderCard).join('');
  } catch (err) {
    console.error('Order.js error:', err);
    container.innerHTML = '<p class="error">⚠️ Не удалось загрузить заказы с Олимпа.</p>';
  }
}

function renderOrderCard(order) {
  const items = (order.items || [])
    .map(it => `<li>${it.name} — ${it.qty} × ${it.price} ₽</li>`)
    .join('');
  const combos = (order.combos || [])
    .map(c => `
      <li>
        <strong>${c.title}</strong><br>
        ${c.items.map(i => `${i.name} (${i.price} ₽)`).join(' + ')} — <span class="price-highlight">${c.total} ₽</span>
      </li>
    `)
    .join('');

  return `
  <div class="order-card" data-id="${order.id}">
    <div class="order-header">
      <h3>Заказ #${order.id}</h3>
    </div>
    <div class="order-body">
      <p><strong>Имя:</strong> ${order.full_name || '—'}</p>
      <p><strong>Телефон:</strong> ${order.phone || '—'}</p>
      <p><strong>Сумма:</strong> <span class="price-highlight">${order.total_sum || 0} ₽</span></p>
      <details>
        <summary>Состав заказа</summary>
        <ul>
          ${items || '<li>—</li>'}
          ${combos || ''}
        </ul>
      </details>
    </div>
    <div class="order-actions">
      <button class="btn-edit" onclick="openEditModal('${order.id}')">✏️ Редактировать</button>
      <button class="btn-delete" onclick="deleteOrder('${order.id}')">🗑 Удалить</button>
    </div>
  </div>`;
}

// 🧺 --- Модалка редактирования (только удаление позиций) ---
async function openEditModal(id) {
  const res = await fetch(`${API_ORDERS}/${id}`);
  const order = await res.json();

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal edit-modal">
      <h3>Редактирование заказа #${id}</h3>
      <p><strong>${order.full_name}</strong> — ${order.phone}</p>
      <div class="edit-list">
        <h4>Блюда</h4>
        <ul>
          ${(order.items || []).map((i, idx) =>
            `<li>${i.name} (${i.qty} × ${i.price} ₽)
               <button class="remove-btn" data-type="item" data-index="${idx}">🗑</button>
             </li>`
          ).join('') || '<li>Нет блюд</li>'}
        </ul>

        <h4>Комбо</h4>
        <ul>
          ${(order.combos || []).map((c, idx) =>
            `<li>${c.title} — ${c.total} ₽
               <button class="remove-btn" data-type="combo" data-index="${idx}">🗑</button>
             </li>`
          ).join('') || '<li>Нет комбо</li>'}
        </ul>
      </div>
      <div class="modal-actions">
        <button id="saveChanges">💾 Сохранить</button>
        <button id="cancelEdit">Отмена</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Удаление позиций (без подтверждения)
  modal.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      const index = +btn.dataset.index;
      if (type === 'item') order.items.splice(index, 1);
      else order.combos.splice(index, 1);
      btn.parentElement.remove();
    });
  });

  modal.querySelector('#cancelEdit').onclick = () => modal.remove();
  modal.querySelector('#saveChanges').onclick = async () => {
    // пересчёт суммы
    const itemsSum = (order.items || []).reduce((s, i) => s + i.price * i.qty, 0);
    const combosSum = (order.combos || []).reduce((s, c) => s + (c.total || 0), 0);
    order.total_sum = itemsSum + combosSum;

    try {
      const res = await fetch(`${API_ORDERS}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order)
      });
      if (!res.ok) throw new Error('Ошибка при сохранении');
      modal.remove();
      loadOrders();
      alert('Изменения сохранены!');
    } catch (err) {
      alert('❌ Не удалось сохранить: ' + err.message);
    }
  };
}

// 🗑 --- Удаление заказа ---
async function deleteOrder(id) {
  if (!confirm('Удалить этот заказ?')) return;
  try {
    const res = await fetch(`${API_ORDERS}/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Ошибка удаления');
    alert('Заказ удалён');
    loadOrders();
  } catch (err) {
    alert('❌ ' + err.message);
  }
}
