(function () {

  const DISHES = (window.DISHES || []).slice(); // массив блюд, подключённый отдельным файлом
  const collator = new Intl.Collator('ru', { sensitivity: 'base' }); // сортировка по-русски (А=а, Ё=Е и т.д.)

  // Справочник по категориям: где рисовать карточки и какие скрытые поля заполнять для формы
  const CATS = {
    hot:     { title: 'Горячее', grid: document.getElementById('grid-hot'),     hidden: document.getElementById('hidden-hot'),     hiddenQty: mkHidden('hidden-hot-qty')     },
    snack:   { title: 'Закуски', grid: document.getElementById('grid-snack'),   hidden: document.getElementById('hidden-snack'),   hiddenQty: mkHidden('hidden-snack-qty')   },
    dessert: { title: 'Десерт',  grid: document.getElementById('grid-dessert'), hidden: document.getElementById('hidden-dessert'), hiddenQty: mkHidden('hidden-dessert-qty') },
    drink:   { title: 'Напитки', grid: document.getElementById('grid-drink'),   hidden: document.getElementById('hidden-drink'),   hiddenQty: mkHidden('hidden-drink-qty')   },
  };

  // Словарь для подписи внизу карточки
  const metaLabelByCat = { hot: 'Горячее', snack: 'Закуска', dessert: 'Десерт', drink: 'Напиток' };

  // если вдруг нет скрытого input — создаём и кладём в форму
  function mkHidden(id){
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('input');
      el.type = 'hidden';
      el.id = id;
      el.name = id.replace('hidden-','').replaceAll('-', '_'); // имя поля для отправки
      document.querySelector('form').appendChild(el);
    }
    return el;
  }

  // что выбрал пользователь в каждой категории
  // keyword — латинское имя блюда, qty — количество (0 если ничего не выбрано)
  const selected = {
    hot: { keyword: null, qty: 0 },
    snack: { keyword: null, qty: 0 },
    dessert: { keyword: null, qty: 0 },
    drink: { keyword: null, qty: 0 },
  };

  const totalEl = document.getElementById('summary-total'); // куда писать общую сумму

  // логика с временем: поле time активно только если выбран вариант «К указанному времени»
  (function setupTimeToggle(){
    const radios = document.querySelectorAll('input[name="when"]');
    const timeInput = document.getElementById('deliver_at');
    function toggle(){
      timeInput.disabled = !document.querySelector('input[name="when"][value="scheduled"]').checked;
    }
    radios.forEach(r => r.addEventListener('change', toggle));
    toggle(); // выставили корректное состояние при загрузке
  })();

  // готовим структуру «категория - список блюд», плюс сортируем по имени
  const byCat = Object.fromEntries(Object.keys(CATS).map(k => [k, []]));
  DISHES.forEach(d => { if (CATS[d.category]) byCat[d.category].push(d); });
  Object.keys(byCat).forEach(cat => byCat[cat].sort((a,b)=>collator.compare(a.name, b.name)));

  // рисуем карточки по категориям
  Object.keys(byCat).forEach(cat => {
    const grid = CATS[cat].grid; // контейнер-сетка для этой категории
    const frag = document.createDocumentFragment(); // рисуем во фрагмент, чтобы не дёргать DOM по сто раз

    byCat[cat].forEach(dish => {
      const card = document.createElement('div');
      card.className = 'plate-card';
      card.setAttribute('data-dish', dish.keyword); // data-атрибут с латинским ключом блюда

      // «галочка» в левом верхнем углу — просто визуальный чекбокс
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.style.pointerEvents = 'none'; // чтобы не кликался сам по себе
      card.appendChild(cb);

      // картинка блюда
      const img = document.createElement('img');
      img.src = dish.image;
      img.alt = dish.name;
      img.className = 'plate-img';
      card.appendChild(img);

      // текстовая часть карточки
      const info = document.createElement('div');
      info.className = 'plate-info';
      info.innerHTML = `
        <p class="plate-title">${dish.name}</p>
        ${dish.desc ? `<p class="plate-desc">${dish.desc}</p>` : ''}
        <p class="plate-meta">${dish.count ? dish.count + ' · ' : ''}${metaLabelByCat[dish.category] || 'Блюдо'}</p>
        <p class="plate-price">${dish.price} ₽</p>
      `;

      // панель количества (появится после «Добавить»)
      const qtyWrap = document.createElement('div');
      qtyWrap.className = 'qty';
      qtyWrap.innerHTML = `
        <button type="button" class="btn-qty" data-delta="-1" aria-label="Уменьшить">−</button>
        <span class="qty-num">1</span>
        <button type="button" class="btn-qty" data-delta="1" aria-label="Увеличить">+</button>
      `;
      qtyWrap.style.display = 'none'; // изначально скрыта

      // основная кнопка «Добавить» — выбираем блюдо и показываем +/−
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-primary';
      btn.textContent = 'Добавить';
      btn.addEventListener('click', () => {
        chooseDish(cat, dish); // записываем выбор (qty=1)
        showQtyControls(card, true); // показываем панель количества
      });

      info.appendChild(qtyWrap);
      info.appendChild(btn);
      card.appendChild(info);
      frag.appendChild(card);

      // обработка кликов по +/− внутри этой карточки
      qtyWrap.addEventListener('click', (e) => {
        const b = e.target.closest('.btn-qty');
        if (!b) return;
        const delta = Number(b.dataset.delta || 0); // +1 или -1
        adjustQty(cat, dish, delta); // пересчитали количество

        // обновили цифру на самой карточке
        const num = qtyWrap.querySelector('.qty-num');
        const st = selected[cat];
        num.textContent = st.keyword === dish.keyword ? st.qty : 1;

        // если количество стало 0 — прячем + - обратно, показываем «Добавить»
        if (!st.qty || st.keyword !== dish.keyword) {
          showQtyControls(card, false);
        }
      });
    });

    grid.innerHTML = ''; 
    grid.appendChild(frag); // за один проход вставили все карточки
  });

  // показать/спрятать у карточки панель количества и чекбокс-подсветку
  function showQtyControls(card, on){
    const cb = card.querySelector('input[type="checkbox"]');
    const btn = card.querySelector('.btn-primary');
    const qty = card.querySelector('.qty');
    if (on) {
      if (cb) cb.checked = true;
      if (btn) btn.style.display = 'none';
      if (qty) qty.style.display = 'flex';
    } else {
      if (cb) cb.checked = false;
      if (btn) btn.style.display = 'inline-block';
      if (qty) qty.style.display = 'none';
    }
  }

  // выбор блюда в категории (ставим qty = 1)
  function chooseDish(cat, dish){
    // если раньше было выбрано другое блюдо — скрываем у него панель количества
    const prev = selected[cat];
    if (prev.keyword && prev.keyword !== dish.keyword) {
      const oldCard = document.querySelector(`.plate-card[data-dish="${prev.keyword}"]`);
      if (oldCard) showQtyControls(oldCard, false);
    }

    // запоминаем выбор и прокидываем в скрытые инпуты для отправки формы
    selected[cat] = { keyword: dish.keyword, qty: 1 };
    CATS[cat].hidden.value = dish.keyword;
    CATS[cat].hiddenQty.value = '1';

    // на текущей карточке показываем «1» и панель количества
    const newCard = document.querySelector(`.plate-card[data-dish="${dish.keyword}"]`);
    if (newCard) {
      const num = newCard.querySelector('.qty-num');
      if (num) num.textContent = '1';
      showQtyControls(newCard, true);
    }

    renderSummary(); // обновили блок «Ваш заказ»
    renderTotal(); // пересчитали сумму
  }

  // изменение количества (delta = +1 или −1)
  function adjustQty(cat, dish, delta){
    const cur = selected[cat];

    // если жмём +/− на карточке, которая ещё не выбрана — сначала выбираем её
    if (cur.keyword !== dish.keyword) {
      chooseDish(cat, dish);
      return;
    }

    // новое количество в пределах 0..9
    let next = Math.max(0, Math.min(9, (cur.qty || 0) + delta));
    cur.qty = next;

    if (next === 0) {
      // обнулили — значит сняли выбор
      selected[cat] = { keyword: null, qty: 0 };
      CATS[cat].hidden.value = '';
      CATS[cat].hiddenQty.value = '';
      const card = document.querySelector(`.plate-card[data-dish="${dish.keyword}"]`);
      if (card) showQtyControls(card, false);
    } else {
      // просто обновили qty
      CATS[cat].hidden.value = dish.keyword;
      CATS[cat].hiddenQty.value = String(next);
    }

    renderSummary();
    renderTotal();
  }

  // перерисовка блока «Ваш заказ» слева
  function renderSummary() {
    Object.keys(CATS).forEach(cat => {
      const list = document.querySelector(`.summary-block[data-sum="${cat}"] .summary-list`);
      list.innerHTML = '';
      const { keyword, qty } = selected[cat];

      if (!keyword || !qty) {
        list.innerHTML = `<li class="empty">Блюдо не выбрано</li>`;
        return;
      }

      const dish = DISHES.find(d => d.keyword === keyword);
      if (!dish) { list.innerHTML = `<li class="empty">Блюдо не выбрано</li>`; return; }

      const subtotal = dish.price * qty; // стоимость по категории = цена × кол-во
      const li = document.createElement('li');
      li.innerHTML = `${dish.name} × ${qty} — <span class="price-highlight">${subtotal} ₽</span>`;
      list.appendChild(li);
    });
  }

  // считаем общую сумму по всем категориям
  function renderTotal() {
    const sum = Object.entries(selected).reduce((acc, [,v]) => {
      if (!v.keyword || !v.qty) return acc;
      const d = DISHES.find(x => x.keyword === v.keyword);
      return acc + (d ? d.price * v.qty : 0);
    }, 0);
    totalEl.textContent = `${sum} ₽`;
  }

  // при сбросе формы возвращаем всё к исходному состоянию
  document.querySelector('form').addEventListener('reset', () => {
    setTimeout(() => { // даём форме сброситься, потом чистим своё
      Object.keys(selected).forEach(cat => {
        selected[cat] = { keyword: null, qty: 0 };
        CATS[cat].hidden.value = '';
        CATS[cat].hiddenQty.value = '';
      });
      document.querySelectorAll('.plate-card').forEach(card => showQtyControls(card, false));
      renderSummary();
      renderTotal();
    }, 0);
  });

  // первичная отрисовка блока «Ваш заказ» и суммы при загрузке
  renderSummary();
  renderTotal();
})();
