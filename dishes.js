// Категории: 'hot' | 'snack' | 'dessert' | 'drink' | 'combo'
// image — относительный путь к картинке
// count — масса/объем (строка)
// kind — подкатегория (для фильтрации: мясное/вегетарианское, горячие/холодные и т.д.)

window.DISHES = [
  { keyword: 'ariadna', name: 'Нить Ариадны', price: 285, category: 'hot', count: '300 г', image: 'ariadna.jpg',
    desc: 'Паста в нежном томатно-сливочном соусе', kind: 'veg' }, // вегетарианское

  { keyword: 'ambrosia', name: 'Амброзия', price: 330, category: 'hot', count: '320 г', image: 'ambrosia.jpg',
    desc: 'Сочное мясо с гарниром', kind: 'meat' }, // мясное

  { keyword: 'ares_shield', name: 'Щит Ареса', price: 320, category: 'hot', count: '320 г', image: 'ares.jpg',
    desc: 'Сытная запеканка из мяса и овощей', kind: 'meat' }, // мясное

  { keyword: 'aphrodite_charm', name: 'Чары Афродиты', price: 250, category: 'snack', count: '250 г', image: 'afrodita.jpg',
    desc: 'Свежий салат с нежной заправкой', kind: 'veg' }, // вегетарианское

  { keyword: 'hera_tears', name: 'Слёзы Геры', price: 240, category: 'snack', count: '220 г', image: 'geratears.jpg',
    desc: 'Картофельное пюре с зеленью', kind: 'veg' }, // вегетарианское

  { keyword: 'dionysus_nectar', name: 'Нектар Диониса', price: 230, category: 'dessert', count: '120 г', image: 'dionis.jpg',
    desc: 'Ягодный десерт в лёгком креме', kind: 'small' }, // маленькая порция

  { keyword: 'morpheus_dream',  name: 'Сон Морфея', price: 200, category: 'dessert', count: '220 г', image: 'morpheus.jpg',
    desc: 'Воздушный пирог с ореховой крошкой', kind: 'medium' }, // средняя порция

  { keyword: 'prometheus_cup',  name: 'Кубок Прометея', price: 150, category: 'drink', count: '250 мл', image: 'prometheus.jpg',
    desc: 'Бодрящий кофе с лёгкой кислинкой', kind: 'hotdrink' }, // горячий напиток

  { keyword: 'styx_river', name: 'Река Стикс', price: 120, category: 'drink', count: '300 мл', image: 'styx.jpg',
    desc: 'Прохладительный ягодный напиток', kind: 'colddrink' }, // холодный напиток

  // --- Готовые комбо как отдельные карточки каталога ---
  { keyword: 'combo_zevs', name: 'Трапеза Зевса', price: 675, category: 'combo', count: 'набор',
    image: 'combo_zevs.png', desc: 'Амброзия + Слёзы Геры + Кубок Прометея' },

  { keyword: 'combo_afrodita', name: 'Лёгкость Афродиты', price: 570, category: 'combo', count: 'набор',
    image: 'combo_afrodita.png', desc: 'Чары Афродиты + Сон Морфея + Река Стикс' },

  { keyword: 'combo_gefest', name: 'Завтрак Гефеста', price: 435, category: 'combo', count: 'набор',
    image: 'combo_gefest.png', desc: 'Нить Ариадны + Кубок Прометея' }
];
