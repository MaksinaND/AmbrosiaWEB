(async function () {
  /* ===== 0) ЗАГРУЗКА ДАННЫХ ИЗ API ПЕРЕД ВСЕМ ОСТАЛЬНЫМ ===== */
  const API_URL = 'https://raw.githubusercontent.com/MaksinaND/ambrosia-data/main/dishes.json';
  const BASE_IMG = 'https://maksinand.github.io/ambrosia-data/';

  let apiData = [];
  try {
    const res = await fetch(API_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    // поддерживаем оба формата: [{...}] или { dishes: [...] }
    apiData = Array.isArray(json) ? json : (json.dishes || []);
    // делаем пути к картинкам абсолютными, если вдруг относительные
    apiData = apiData.map(d => ({
      ...d,
      image: d?.image && !/^https?:\/\//i.test(d.image) ? (BASE_IMG + d.image.replace(/^\.?\/*/, '')) : d?.image
    }));
  } catch (e) {
    console.warn('Не удалось загрузить блюда с API, fallback на window.DISHES', e);
    apiData = (window.DISHES || []);
  }
  window.DISHES = apiData;


  const DISHES = (window.DISHES || []).slice();
  const collator = new Intl.Collator('ru', { sensitivity: 'base' });
  const byId = (id) => document.getElementById(id);

  function ensureHidden(id){
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('input');
      el.type = 'hidden';
      el.id = id;
      el.name = id.replace('hidden-','').replaceAll('-', '_');
      document.querySelector('form')?.appendChild(el);
    }
    return el;
  }

  // ---- refs ----
  const CATS = {
    hot:     { title: 'Горячее',        grid: byId('grid-hot'),     hidden: byId('hidden-hot'),     hiddenQty: ensureHidden('hidden-hot-qty')     },
    snack:   { title: 'Закуски',        grid: byId('grid-snack'),   hidden: byId('hidden-snack'),   hiddenQty: ensureHidden('hidden-snack-qty')   },
    dessert: { title: 'Десерт',         grid: byId('grid-dessert'), hidden: byId('hidden-dessert'), hiddenQty: ensureHidden('hidden-dessert-qty') },
    drink:   { title: 'Напитки',        grid: byId('grid-drink'),   hidden: byId('hidden-drink'),   hiddenQty: ensureHidden('hidden-drink-qty')   },
    combo:   { title: 'Готовые комбо',  grid: byId('grid-combo'),   hidden: byId('hidden-combo'),   hiddenQty: ensureHidden('hidden-combo-qty')  }
  };
  const hiddenCombos = ensureHidden('hidden-combos'); // JSON с комбо

  // ---- state ----
  // обычный заказ (как и раньше)
  const selected = {
    hot:     { keyword: null, qty: 0 },
    snack:   { keyword: null, qty: 0 },
    dessert: { keyword: null, qty: 0 },
    drink:   { keyword: null, qty: 0 },
    combo:   { keyword: null, qty: 0 }
  };

  // список добавленных КОМБО, собранных конструктором (строгий режим)
  const combos = []; // {id, cats, title, items:[{cat,keyword,qty,name,price}], total}
  let comboSeq = 1;

  // отдельный выбор в текущем КОМБО — НЕ влияет на selected
  let planPick = null; // {hot:'k1', drink:'k2', ...}

  // ---- данные ----
  const byCat = { hot:[], snack:[], dessert:[], drink:[], combo:[] };
  DISHES.forEach(d => { if (byCat[d.category]) byCat[d.category].push(d); });
  Object.keys(byCat).forEach(cat => byCat[cat].sort((a,b)=>collator.compare(a.name,b.name)));

  // ---- фильтры (по желанию) ----
  const FILTERS = {
    hot:     [{key:'meat',label:'Мясное'},{key:'veg',label:'Вегетарианское'}],
    snack:   [{key:'light',label:'Лёгкое'},{key:'veg',label:'Вегетарианское'}],
    dessert: [{key:'small',label:'Мал.порция'},{key:'medium',label:'Ср.порция'}],
    drink:   [{key:'hotdrink',label:'Горячие'},{key:'colddrink',label:'Холодные'}],
    combo:   [] // у комбо нет подфильтров
  };
  const activeFilter = { hot:null, snack:null, dessert:null, drink:null, combo:null };

  function renderFilters(cat){
    const wrap = document.querySelector(`[data-filters="${cat}"]`);
    if (!wrap) return; wrap.innerHTML='';
    (FILTERS[cat]||[]).forEach(f=>{
      const b=document.createElement('button');
      b.type='button';
      b.className='filter-btn'+(activeFilter[cat]===f.key?' active':'');
      b.textContent=f.label;
      b.dataset.kind=f.key;
      b.onclick=()=>{ activeFilter[cat]=(activeFilter[cat]===f.key)?null:f.key; renderCategory(cat); };
      wrap.appendChild(b);
    });
  }

  // ---- строгий режим комбо ----
  // null | { cats:['hot','drink'], strict:true, title:'Комбо: ...' }
  let activePlan = null;

  const PLAN_TITLES = {
    'hot+drink': 'Комбо: Горячее + Напиток',
    'snack+drink': 'Комбо: Закуска + Напиток',
    'hot+snack+drink': 'Комбо: Горячее + Закуска + Напиток'
  };

  document.querySelectorAll('.combo-chip[data-plan]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const key = (btn.dataset.plan||'').split('+').filter(Boolean).join('+');
      const cats = key.split('+').filter(Boolean);
      setPlan(cats, PLAN_TITLES[key]||'Комбо');
      document.querySelectorAll('.combo-chip').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Мягкая прокрутка к секции по клику на иконку-ссылку (готовые комбо)
  document.addEventListener('click', (e) => {
    const link = e.target.closest('.combo-chip[href^="#"]');
    if (!link) return;

    // куда ведёт ссылка
    let id = (link.getAttribute('href') || '').slice(1);

    if (id === 'combo-sets') id = 'grid-combo';

    const target = document.getElementById(id) || document.querySelector(`[id="${id}"]`);
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });

      target.classList.add('pulse-once');
      setTimeout(() => target.classList.remove('pulse-once'), 900);
    }
  });

  function setPlan(cats, title){
    // включаем режим; отдельный контейнер для выбора в комбо
    activePlan = { cats, strict:true, title };
    planPick = {}; // новый набор — всё выбираем заново (НЕ трогаем selected)

    drawGuide();
    const first = firstMissingCat();
    if (first) CATS[first].grid.scrollIntoView({behavior:'smooth', block:'start'});
    Object.keys(CATS).forEach(renderCategory); // заглушим лишние категории
  }

  // делегатор на «Сбросить комбо»
  document.addEventListener('click',(e)=>{
    const r = e.target.closest('.guide-reset');
    if (r){ e.preventDefault(); resetPlan(); Object.keys(CATS).forEach(renderCategory); }
  });

  function resetPlan(){
    activePlan=null;
    planPick=null;
    const g = byId('combo-guide');
    if (g){ g.hidden=true; g.innerHTML=''; }
    document.querySelectorAll('.combo-chip').forEach(b=>b.classList.remove('active'));
    Object.keys(CATS).forEach(c=>CATS[c].grid.classList.remove('disabled'));
    // убрать визуальные отметки «picked» из карточек
    document.querySelectorAll('.plate-card.picked').forEach(el=>el.classList.remove('picked'));
  }

  const firstMissingCat = () => (activePlan ? activePlan.cats.find(c=>!planPick || !planPick[c]) : null);
  const isPlanComplete = () => (!!activePlan?.strict && activePlan.cats.every(c=>planPick && !!planPick[c]));

  // когда комбо собрано — добавляем как отдельную позицию (selected НЕ трогаем)
  function finalizePlanAsCombo(){
    if (!activePlan) return;

    const items = activePlan.cats.map(cat=>{
      const k = planPick?.[cat];
      const d = DISHES.find(x=>x.keyword===k);
      return { cat, keyword:k, qty:1, name:d?.name||'', price:d?.price||0 };
    });

    const total = items.reduce((s,i)=>s+i.price,0);
    const combo = { id:'c'+(comboSeq++), cats: activePlan.cats.slice(), title: activePlan.title, items, total };
    combos.push(combo);

    // выключить режим 
    resetPlan();

    renderSummary();
    renderTotal();
    Object.keys(CATS).forEach(renderCategory);

    toast(`${combo.title} добавлено в заказ`);
  }

  function drawGuide(){
    const box = byId('combo-guide');
    if (!activePlan){ if (box){box.hidden=true; box.innerHTML='';} return; }
    if (!box) return;
    box.hidden=false;

    const pills = activePlan.cats.map(cat=>{
      const ok = !!(planPick && planPick[cat]);
      return `<span class="guide-pill ${ok?'done':''}">${CATS[cat].title}${ok?' ✓':''}</span>`;
    }).join(' ');

    box.innerHTML = `
      <strong>${activePlan.title}</strong>
      ${pills}
      <span class="guide-actions">
        <button type="button" class="guide-reset">Сбросить комбо</button>
      </span>
    `;
  }

  // ---- рендер карточек ----
  function renderCategory(cat){
    renderFilters(cat);

    const grid = CATS[cat].grid;
    const frag = document.createDocumentFragment();

    const items = byCat[cat].filter(d=>!activeFilter[cat] || d.kind===activeFilter[cat]);

    // combo, как и dessert, не блокируем в строгом режиме
    const enabled = !activePlan?.strict || activePlan.cats.includes(cat) || cat==='dessert' || cat==='combo';
    if (!enabled) grid.classList.add('disabled'); else grid.classList.remove('disabled');

    items.forEach(dish=>{
      const card = document.createElement('div');
      card.className='plate-card';
      card.dataset.dish=dish.keyword;
      card.dataset.category = cat;

      // если этот dish выбран в текущем плане — подсветим
      if (activePlan?.strict && planPick && planPick[cat] === dish.keyword) {
        card.classList.add('picked');
      }

      const cb=document.createElement('input'); cb.type='checkbox'; cb.style.pointerEvents='none'; card.appendChild(cb);

      const img=document.createElement('img'); img.src=dish.image; img.alt=dish.name; img.className='plate-img'; card.appendChild(img);

      const info=document.createElement('div'); info.className='plate-info';
      info.innerHTML=`
        <p class="plate-title">${dish.name}</p>
        <p class="plate-desc">${dish.desc||''}</p>
        <p class="plate-meta">${dish.count?dish.count+' · ':''}${CATS[cat].title}</p>
        <p class="plate-price">${dish.price} ₽</p>
      `;

      const qtyWrap=document.createElement('div');
      qtyWrap.className='qty';
      qtyWrap.innerHTML=`
        <button type="button" class="btn-qty" data-delta="-1" aria-label="Уменьшить">−</button>
        <span class="qty-num">1</span>
        <button type="button" class="btn-qty" data-delta="1" aria-label="Увеличить">+</button>
      `;
      qtyWrap.style.display='none';

      const btn=document.createElement('button');
      btn.type='button'; btn.className='btn-primary'; btn.textContent='Добавить';
      btn.disabled=!enabled;

      btn.onclick=()=>{
        if (!enabled){ toast('В выбранном комбо эта категория недоступна'); return; }
        chooseDish(cat,dish);
        // в обычном режиме показываем qty; в комбо — только помечаем «picked»
        if (!(activePlan?.strict && activePlan.cats.includes(cat))) {
          showQtyControls(card,true);
        }
      };

      qtyWrap.addEventListener('click',(e)=>{
        const b=e.target.closest('.btn-qty'); if(!b) return;

        if (activePlan?.strict && activePlan.cats.includes(cat)) {
          toast('В режиме комбо количество фиксировано: 1');
          return;
        }

        const delta=Number(b.dataset.delta||0);
        adjustQty(cat,dish,delta);

        const num=qtyWrap.querySelector('.qty-num');
        const st=selected[cat];
        num.textContent = st.keyword===dish.keyword ? st.qty : 1;

        if (!st.qty || st.keyword!==dish.keyword) showQtyControls(card,false);
      });

      info.appendChild(qtyWrap);
      info.appendChild(btn);
      card.appendChild(info);
      frag.appendChild(card);

      // восстановление состояния обычного выбора
      const st=selected[cat];
      if (st.keyword===dish.keyword && st.qty>0 && !(activePlan?.strict && activePlan.cats.includes(cat))) {
        cb.checked=true; qtyWrap.style.display='flex'; btn.style.display='none';
        qtyWrap.querySelector('.qty-num').textContent=st.qty;
      }
    });

    grid.innerHTML=''; grid.appendChild(frag);
  }

  function showQtyControls(card, on){
    const btn = card.querySelector('.btn-primary');
    const qty = card.querySelector('.qty');

    if (on) {
      card.classList.add('selected');
      if (btn) btn.style.display = 'none';
      if (qty) qty.style.display = 'flex';
    } else {
      card.classList.remove('selected');
      if (btn) btn.style.display = 'inline-block';
      if (qty) qty.style.display = 'none';
    }
  }

  // ---- выбор / количество ----
  function chooseDish(cat,dish){
    // если режим комбо и категория входит в план — пишем В ОТДЕЛЬНУЮ корзинку planPick
    if (activePlan?.strict && activePlan.cats.includes(cat)) {
      // снять предыдущую пометку «picked» в этой категории
      const prevKey = planPick?.[cat];
      if (prevKey && prevKey !== dish.keyword) {
        const prevCard = document.querySelector(`.plate-card[data-dish="${prevKey}"]`);
        prevCard?.classList.remove('picked');
      }
      if (!planPick) planPick = {};
      planPick[cat] = dish.keyword;

      // визуально пометить текущую карточку
      const curCard = document.querySelector(`.plate-card[data-dish="${dish.keyword}"]`);
      curCard?.classList.add('picked');

      drawGuide();

      if (isPlanComplete()) { finalizePlanAsCombo(); return; }

      // перейти к следующей категории плана
      const next = firstMissingCat();
      if (next) setTimeout(()=>CATS[next].grid.scrollIntoView({behavior:'smooth',block:'start'}), 350);

      return; // ВАЖНО: не трогаем selected[]
    }

    // обычный режим (вне комбо) — как было
    const prev=selected[cat];
    if (prev.keyword && prev.keyword!==dish.keyword){
      const old=document.querySelector(`.plate-card[data-dish="${prev.keyword}"]`);
      if (old) showQtyControls(old,false);
    }

    selected[cat]={ keyword:dish.keyword, qty:1 };
    CATS[cat].hidden.value=dish.keyword;
    CATS[cat].hiddenQty.value='1';

    const cur=document.querySelector(`.plate-card[data-dish="${dish.keyword}"]`);
    if (cur){
      const num=cur.querySelector('.qty-num'); if (num) num.textContent='1';
      showQtyControls(cur,true);
    }

    renderSummary(); renderTotal(); drawGuide();
  }

  function adjustQty(cat,dish,delta){
    const cur=selected[cat];
    if (cur.keyword!==dish.keyword){ chooseDish(cat,dish); return; }

    let next=Math.max(0, Math.min(9, (cur.qty||0)+delta));
    cur.qty=next;

    if (next===0){
      selected[cat]={ keyword:null, qty:0 };
      CATS[cat].hidden.value=''; CATS[cat].hiddenQty.value='';
      const card=document.querySelector(`.plate-card[data-dish="${dish.keyword}"]`);
      if (card) showQtyControls(card,false);
    } else {
      CATS[cat].hidden.value=dish.keyword;
      CATS[cat].hiddenQty.value=String(next);
    }

    renderSummary(); renderTotal(); drawGuide();
  }


  const totalEl = byId('summary-total');

  function renderSummary(){
    // обычные категории (включая combo)
    Object.keys(CATS).forEach(cat=>{
      const list=document.querySelector(`.summary-block[data-sum="${cat}"] .summary-list`);
      if (!list) return;
      list.innerHTML='';
      const {keyword, qty}=selected[cat];

      if (!keyword || !qty){
        list.innerHTML=`<li class="empty">Блюдо не выбрано</li>`;
        return;
      }
      const d=DISHES.find(x=>x.keyword===keyword);
      if (!d){ list.innerHTML=`<li class="empty">Блюдо не выбрано</li>`; return; }

      const subtotal=d.price*qty;
      const li=document.createElement('li');
      li.innerHTML=`${d.name} × ${qty} — <span class="price-highlight">${subtotal} ₽</span>`;
      list.appendChild(li);
    });

    // --- КОМБО (конструктор): выводим единым списком в блоке "Горячее" ---
    const hotBlock = document.querySelector(`.summary-block[data-sum="hot"]`);
    if (hotBlock){
      hotBlock.querySelector('.combo-list')?.remove();
      if (combos.length){
        const wrap=document.createElement('div');
        wrap.className='combo-list';
        wrap.style.margin='0 0 10px 0';
        wrap.innerHTML = combos.map(c=>{
          const itemsText = c.items.map(i=>i.name).join(' + ');
          return `<div style="margin:4px 0;">» <strong>${c.title}</strong>: ${itemsText} — <span class="price-highlight">${c.total} ₽</span></div>`;
        }).join('');
        hotBlock.prepend(wrap);
      }
    }

    hiddenCombos.value = JSON.stringify(combos);
  }

  function renderTotal(){
    const itemsSum = Object.entries(selected).reduce((acc,[,v])=>{
      if (!v.keyword||!v.qty) return acc;
      const d=DISHES.find(x=>x.keyword===v.keyword);
      return acc + (d ? d.price*v.qty : 0);
    },0);
    const combosSum = combos.reduce((s,c)=>s+c.total,0);
    if (totalEl) totalEl.textContent = `${itemsSum + combosSum} ₽`;
  }

  // ---- форма / модалка ----
  const form=document.querySelector('form');

  // время доставки
  (function(){
    const radios=document.querySelectorAll('input[name="when"]');
    const timeInput=byId('deliver_at');
    function toggle(){
      const sched=document.querySelector('input[name="when"][value="scheduled"]');
      if (timeInput && sched) timeInput.disabled=!sched.checked;
    }
    radios.forEach(r=>r.addEventListener('change',toggle));
    toggle();
  })();

  form?.addEventListener('reset',()=>{
    setTimeout(()=>{
      Object.keys(selected).forEach(cat=>{
        selected[cat]={keyword:null,qty:0};
        CATS[cat].hidden.value=''; CATS[cat].hiddenQty.value='';
      });
      combos.length=0; hiddenCombos.value='[]';
      document.querySelectorAll('.plate-card').forEach(card=>showQtyControls(card,false));
      renderSummary(); renderTotal(); resetPlan();
    },0);
  });

  form?.addEventListener('submit',(e)=>{
    // если строгий режим активен — требуем все категории плана, а затем сразу превращаем в комбо
    if (activePlan?.strict){
      const missing=activePlan.cats.filter(c=>!planPick || !planPick[c]);
      if (missing.length){
        e.preventDefault();
        showModal('Не все блюда выбраны. Выберите: ' + missing.map(c=>CATS[c].title).join(', ') + '.');
        return;
      }
      finalizePlanAsCombo(); // превратили текущий план в отдельную позицию
    }

    // если выбрано готовое КОМБО как блюдо — пропускаем остальные проверки
    const hasReadyComboAsDish = !!selected.combo?.keyword && selected.combo.qty > 0;
    if (hasReadyComboAsDish) {
      return; // позволяем форме отправиться
    }

    // общие правила: напиток обязателен + (горячее или закуска)
    const hasDrink = !!selected.drink.keyword || combos.some(c=>c.cats.includes('drink'));
    const hasHot   = !!selected.hot.keyword   || combos.some(c=>c.cats.includes('hot'));
    const hasSnack = !!selected.snack.keyword || combos.some(c=>c.cats.includes('snack'));

    if (!hasDrink && !hasHot && !hasSnack) { e.preventDefault(); showModal('Ничего не выбрано. Выберите блюда для заказа.'); return; }
    if (!hasDrink)                          { e.preventDefault(); showModal('Выберите напиток.'); return; }
    if (!hasHot && !hasSnack)               { e.preventPreventDefault(); showModal('Выберите горячее или закуску.'); return; }
  });

  function showModal(message){
    const ov=document.createElement('div');
    ov.className='modal-overlay';
    ov.innerHTML=`
      <div class="modal" role="dialog" aria-modal="true">
        <p>${message}</p>
        <button class="ok" type="button">Хорошо</button>
      </div>`;
    document.body.appendChild(ov);
    function close(){ ov.remove(); }
    ov.querySelector('.ok')?.addEventListener('click', close);
    ov.addEventListener('click',(e)=>{ if(e.target===ov) close(); });
    document.addEventListener('keydown', function esc(e){ if(e.key==='Escape'){ close(); document.removeEventListener('keydown',esc); }});
  }
  const toast = (m)=>showModal(m);

  // ---- первичный рендер ----
  Object.keys(byCat).forEach(cat=>renderCategory(cat));
  renderSummary(); renderTotal();


  /* ===== Готовые комбо (qty=0 по умолчанию, «–» удаляет из корзины) ===== */

  // Поиск блюда по названию из DISHES
  function findDishByName(name) {
    return (DISHES || []).find(d => d && d.name === name);
  }

  // Конфигурация наборов (иконки-комбо сверху)
  const READY_COMBOS = {
    zeus: {
      title: 'Комбо: Трапеза Зевса',
      items: ['Амброзия', 'Слёзы Геры', 'Кубок Прометея'],
      priceOverride: 675
    },
    aphrodite: {
      title: 'Комбо: Лёгкость Афродиты',
      items: ['Чары Афродиты', 'Сон Морфея', 'Река Стикс'],
      priceOverride: 570
    },
    hephaestus: {
      title: 'Комбо: Завтрак Гефеста',
      items: ['Нить Ариадны', 'Кубок Прометея'],
      priceOverride: 435
    }
  };

  // Добавление набора в combos[]
  function addReadyComboToOrder(key, qty = 1) {
    const cfg = READY_COMBOS[key];
    if (!cfg || qty <= 0) return;

    const items = (cfg.items || []).map(n => {
      const d = findDishByName(n);
      return {
        cat: d?.category || '',
        keyword: d?.keyword || '',
        qty: 1,
        name: d?.name || n,
        price: d?.price || 0
      };
    });

    const base = items.reduce((s, i) => s + (i.price || 0), 0);
    const onePrice = cfg.priceOverride ?? base;

    for (let i = 0; i < qty; i++) {
      combos.push({
        id: 'rc-' + key + '-' + Date.now() + '-' + i,
        isReady: true,
        cats: items.map(it => it.cat).filter(Boolean),
        title: cfg.title,
        items: items,
        qty: 1,
        total: onePrice
      });
    }

    renderSummary && renderSummary();
    renderTotal && renderTotal();
    showModal && showModal(`${cfg.title} добавлено в заказ`);
  }

  // Удаление одного такого комбо из заказа (последнего добавленного)
  function removeReadyComboFromOrder(key, count = 1) {
    let removed = 0;
    for (let i = combos.length - 1; i >= 0 && removed < count; i--) {
      const c = combos[i];
      if (c && typeof c.id === 'string' && c.id.startsWith('rc-' + key + '-')) {
        combos.splice(i, 1);
        removed++;
      }
    }
    if (removed) {
      renderSummary && renderSummary();
      renderTotal && renderTotal();
      showModal && showModal('Комбо удалено из заказа');
    }
  }

  // helpers для +/− и текста кнопки
  function getComboQtyFromCard(card) {
    const span = card.querySelector('.combo-qty');
    return Math.max(0, Math.min(9, parseInt(span?.textContent || '0', 10) || 0));
  }
  function setComboQtyInCard(card, q) {
    const span = card.querySelector('.combo-qty');
    if (span) span.textContent = String(Math.max(0, Math.min(9, q)));
    updateAddButtonTotal(card);
  }
  function updateAddButtonTotal(card) {
    const key = card.dataset.key;
    const cfg = READY_COMBOS[key];
    const btn = card.querySelector('.add-ready-combo');
    if (!cfg || !btn) return;
    const qty = getComboQtyFromCard(card);
    if (qty === 0) {
      btn.textContent = 'Выберите количество';
      btn.disabled = true;
    } else {
      const price = (cfg.priceOverride ?? 0) * qty;
      btn.textContent = `Добавить — ${price} ₽`;
      btn.disabled = false;
    }
  }

  document.addEventListener('click', (e) => {
    const ctrl = e.target.closest('.combo-controls .plus, .combo-controls .minus');
    if (ctrl) {
      const card = ctrl.closest('.ready-combo-card');
      if (card) {
        let q = getComboQtyFromCard(card);
        if (ctrl.classList.contains('plus')) {
          q = Math.min(9, q + 1);
        } else {
          if (q > 0) {
            q = Math.max(0, q - 1);
          } else {
            const key = card.dataset.key;
            removeReadyComboFromOrder(key, 1);
          }
        }
        setComboQtyInCard(card, q);
      }
      return;
    }

    const addBtn = e.target.closest('.add-ready-combo');
    if (addBtn) {
      const card = addBtn.closest('.ready-combo-card');
      const key = addBtn.dataset.key || card?.dataset.key;
      const qty = card ? getComboQtyFromCard(card) : 0;
      addReadyComboToOrder(key, qty);
      if (card) setComboQtyInCard(card, 0);
    }
  });

  document.querySelectorAll('.ready-combo-card').forEach(card => {
    setComboQtyInCard(card, getComboQtyFromCard(card));
  });

})();
