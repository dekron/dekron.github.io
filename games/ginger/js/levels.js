window.Ginger = window.Ginger || {};
(() => {
'use strict';
/* Themes, level layouts, and level-select artwork. */
const THEMES={
  kitchen:{sky:['#241226','#43203c','#6b3348'],night:false,cel:'window',far:'cabinets',mid:'lamps',
    top:'#f0b46e',lip:'#cf8f4e',body:'#5a3350',line:'rgba(255,200,140,.10)',deco:'knob',amb:'mote',farC:'#3a1c38',midC:'#2c142c'},
  yard:{sky:['#171c3a','#3a2f63','#c96f4a'],night:true,cel:'moon',far:'houses',mid:'trees',
    top:'#5ec96f',lip:'#3da152',body:'#4a3866',line:'rgba(140,110,190,.22)',deco:'grass',amb:'firefly',farC:'#241d4a',midC:'#1c1638'},
  garden:{sky:['#0c1f30','#14424a','#2a6b57'],night:true,cel:'moon',far:'trees',mid:'flowers',
    top:'#4fd0a0',lip:'#2fa87c',body:'#2e4a5e',line:'rgba(90,200,170,.13)',deco:'grass',amb:'firefly',farC:'#122f3c',midC:'#0d222e'},
  attic:{sky:['#221830','#3a2a44','#54406b'],night:false,cel:'roundwin',far:'rafters',mid:'boxes',
    top:'#c99a5e',lip:'#a87a44',body:'#4e3a5e',line:'rgba(220,180,120,.12)',deco:'plank',amb:'mote',farC:'#332448',midC:'#281c3a'},
  roof:{sky:['#0a0e2c','#1b1f4a','#3a2f6b'],night:true,cel:'moon',far:'skyline',mid:'chimneys',
    top:'#c96b6b',lip:'#a04f55',body:'#3a3060',line:'rgba(150,130,220,.16)',deco:'brick',amb:'none',farC:'#191741',midC:'#12102e'},
  storm:{sky:['#0e1626','#1e2f4a','#33506e'],night:true,cel:'none',far:'skyline',mid:'chimneys',
    top:'#6b8cc9',lip:'#4f6ba0',body:'#2e3a5e',line:'rgba(130,170,230,.15)',deco:'brick',amb:'rain',farC:'#16223c',midC:'#101a30'},
  tower:{sky:['#1c0e2e','#4a1e4e','#8a3a5e'],night:true,cel:'clock',far:'gears',mid:'beams',
    top:'#d67ab0',lip:'#b05588',body:'#4a2e5e',line:'rgba(230,140,200,.13)',deco:'brick',amb:'mote',farC:'#33163e',midC:'#26102e'},
  market:{sky:['#2a1a3e','#7a3a5e','#ffb26b'],night:false,cel:'sun',far:'stalls',mid:'bunting',
    top:'#ffb36b',lip:'#e08a4a',body:'#6b4a3a',line:'rgba(255,190,120,.15)',deco:'plank',amb:'petal',farC:'#4a2648',midC:'#38203c'}
};

/* ---------------- levels (hand-designed) ---------------- */
const LEVELS=[
{name:'Кухня',theme:'kitchen',w:72,story:'Полночь. Рыжик проснулся на кухне — пора в путь! Осторожно: <b>робот-пылесос</b> не спит и очень сердитый.',
 build(b){b.rect(0,71,12,13,'#');b.rect(14,19,10,11,'#');b.rect(23,26,8,8,'#');b.rect(30,33,6,6,'#');
  b.rect(44,49,10,11,'#');b.rect(53,56,9,9,'#');b.rect(60,62,10,11,'#');
  b.set(3,11,'P');b.set(16,8,'f');b.set(31,4,'f');b.set(54,7,'f');b.set(24,6,'y');
  b.set(40,11,'R');b.set(36,11,'K');b.set(66,11,'G');}},
{name:'Задний двор',theme:'yard',w:80,story:'За окном — двор. <b>Лужи мокрые</b> (фу!), у забора гуляет пёс, а ямы глубокие. Перепрыгивай!',
 build(b){b.rect(0,17,12,13,'#');b.rect(21,33,12,13,'#');b.rect(37,49,12,13,'#');b.rect(53,79,12,13,'#');
  b.set(12,11,'~');b.set(13,11,'~');b.set(44,11,'~');b.set(45,11,'~');b.set(46,11,'~');
  b.rect(22,23,10,10,'#');b.rect(26,28,8,8,'#');b.rect(40,42,7,7,'#');b.rect(58,59,10,10,'#');b.rect(62,64,8,8,'#');
  b.set(38,11,'S');b.set(3,11,'P');b.set(27,6,'f');b.set(41,5,'f');b.set(63,6,'f');b.set(48,10,'y');
  b.set(26,11,'D');b.set(60,11,'D');b.set(54,11,'K');b.set(74,11,'G');}},
{name:'Сад и забор',theme:'garden',w:88,story:'Через ночной сад — по забору и веткам. <b>Подушки-батуты</b> подбросят высоко, а доска-качели перевезёт через яму.',
 build(b){b.rect(0,87,12,13,'#');b.rect(20,22,12,13,'.');b.rect(40,43,12,13,'.');b.rect(62,63,12,13,'.');
  b.rect(10,11,10,11,'#');b.rect(14,15,8,9,'#');b.rect(48,51,7,7,'#');b.rect(54,55,10,11,'#');b.rect(58,59,8,9,'#');
  b.set(34,11,'~');b.set(35,11,'~');b.set(46,11,'S');b.set(41,10,'m');
  b.set(2,11,'P');b.set(14,6,'f');b.set(21,9,'f');b.set(49,5,'f');b.set(72,9,'y');
  b.set(30,11,'D');b.set(70,11,'D');b.set(44,11,'K');b.set(83,11,'G');}},
{name:'Чердак',theme:'attic',w:84,story:'Тихий чердак пахнет пылью и приключениями. Балки узкие, <b>гвозди острые</b> — смотри под лапы!',
 build(b){b.rect(0,15,12,13,'#');b.rect(70,83,12,13,'#');
  b.set(10,11,'^');b.set(11,11,'^');b.set(74,11,'^');b.set(75,11,'^');
  b.rect(18,22,10,10,'#');b.rect(26,29,8,8,'#');b.rect(33,36,6,6,'#');b.rect(40,43,8,8,'#');
  b.rect(50,53,5,5,'#');b.rect(57,60,7,7,'#');b.rect(64,67,9,9,'#');b.set(47,9,'v');
  b.set(2,11,'P');b.set(34,4,'f');b.set(19,8,'f');b.set(65,7,'f');b.set(51,3,'y');b.set(41,7,'K');b.set(80,11,'G');}},
{name:'Крыши',theme:'roof',w:96,story:'Ночные крыши под луной. Внизу — <b>высоко-высоко</b>! Доски-качели помогут перелететь между домами.',
 build(b){b.rect(0,13,8,13,'#');b.rect(17,27,10,13,'#');b.rect(31,41,9,13,'#');b.rect(46,56,7,13,'#');
  b.rect(60,70,9,13,'#');b.rect(74,84,8,13,'#');b.rect(88,95,9,13,'#');
  b.rect(24,25,8,9,'#');b.rect(53,54,5,6,'#');b.rect(65,67,4,4,'#');
  b.set(78,7,'^');b.set(79,7,'^');b.set(43,8,'m');b.set(62,8,'S');
  b.set(3,7,'P');b.set(24,6,'f');b.set(43,6,'f');b.set(66,2,'f');b.set(53,3,'y');
  b.set(36,8,'D');b.set(50,6,'K');b.set(92,8,'G');}},
{name:'Водосток',theme:'storm',w:92,story:'Пошёл дождь! Коты <b>не любят воду</b> — обходи лужи и потоки. Молнии только пугают, а вот вода — по-настоящему.',
 build(b){b.rect(0,11,10,13,'#');b.rect(15,25,11,13,'#');b.rect(31,41,9,13,'#');b.rect(46,56,10,13,'#');
  b.rect(61,71,8,13,'#');b.rect(75,91,10,13,'#');
  b.set(6,9,'~');b.set(7,9,'~');b.set(19,10,'~');b.set(20,10,'~');
  b.set(35,8,'~');b.set(36,8,'~');b.set(66,7,'~');b.set(67,7,'~');
  b.set(79,9,'^');b.set(80,9,'^');
  b.rect(40,43,4,4,'#');b.set(38,8,'S');b.set(28,9,'v');b.set(58,9,'m');
  b.set(3,9,'P');b.set(28,5,'f');b.set(41,2,'f');b.set(58,7,'f');b.set(83,7,'y');
  b.set(51,9,'D');b.set(63,7,'K');b.set(88,9,'G');}},
{name:'Часовая башня',theme:'tower',w:70,story:'Старая часовая башня. Выше, ещё выше! <b>Доска-лифт</b> справа поднимет почти к самой вершине.',
 build(b){b.rect(0,69,12,13,'#');
  b.rect(10,13,10,10,'#');b.rect(16,19,8,8,'#');b.rect(22,25,6,6,'#');b.rect(28,31,4,4,'#');b.rect(34,37,2,2,'#');
  b.rect(40,45,3,3,'#');b.set(48,7,'V');
  b.set(4,11,'P');b.set(23,4,'f');b.set(35,0,'f');b.set(56,10,'f');b.set(11,8,'y');
  b.set(30,11,'D');b.set(55,11,'R');b.set(29,3,'K');b.set(43,2,'G');}},
{name:'Рыбный рынок',theme:'market',w:100,story:'Последний рывок! Рынок просыпается на рассвете, и <b>самая свежая рыбка</b> уже ждёт. Всё, что ты умеешь — пригодится!',
 build(b){b.rect(0,15,12,13,'#');b.rect(19,31,12,13,'#');b.rect(36,48,11,13,'#');b.rect(52,64,12,13,'#');
  b.rect(69,81,9,13,'#');b.rect(85,99,11,13,'#');
  b.set(20,11,'~');b.set(21,11,'~');b.rect(22,23,10,10,'#');
  b.set(41,10,'^');b.set(42,10,'^');b.set(74,8,'^');b.set(75,8,'^');
  b.set(45,10,'S');b.rect(47,50,6,6,'#');b.set(33,10,'m');b.set(66,9,'v');
  b.set(3,11,'P');b.set(48,4,'f');b.set(66,5,'f');b.set(12,9,'f');b.set(88,9,'y');
  b.set(9,11,'R');b.set(28,11,'D');b.set(58,11,'D');b.set(53,11,'K');b.set(95,10,'G');}}
];
const LV_ICONS=[
 '<path d="M5 10h14v7a4 4 0 01-4 4H9a4 4 0 01-4-4z"/><path d="M3.5 10h17v2h-17z"/><path class="st" d="M9 7c0-1.5 1.5-1.5 1.5-3M13.5 7c0-1.5 1.5-1.5 1.5-3"/>',
 '<path d="M11 21v-6"/><circle cx="12" cy="9" r="6"/><circle cx="7.5" cy="12.5" r="3.4"/><circle cx="16.5" cy="12.5" r="3.4"/>',
 '<circle cx="12" cy="12" r="2.6"/><circle cx="12" cy="6" r="3"/><circle cx="12" cy="18" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="12" r="3"/>',
 '<path d="M4 8h16v12H4z"/><path d="M4 8l2-4h12l2 4"/><path class="st" d="M12 8v12"/>',
 '<path d="M4 12l8-7 8 7v9H4z"/><circle cx="18.5" cy="4.5" r="2.6"/>',
 '<path d="M7 15a5 5 0 01-.5-10A6 6 0 0118 6.5 4.2 4.2 0 0117.5 15z"/><path class="st" d="M8 18l-1 2.5M12.5 18l-1 2.5M17 18l-1 2.5"/>',
 '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.4"/><path class="st" d="M12 6.5V12l3.6 2.4"/>',
 '<path d="M2.5 12c2.4-3.6 5.8-5.6 9.3-5.6 3.4 0 6.5 2 8.7 5.6-2.2 3.6-5.3 5.6-8.7 5.6-3.5 0-6.9-2-9.3-5.6z"/><path d="M20.5 12l3-3.4v6.8z"/><circle cx="7.6" cy="10.9" r="1.15" fill="#1d1038"/>'
];
const LV_GRADS=[['#6b3348','#3a1c38'],['#3f6b4a','#241d4a'],['#2a6b57','#122f3c'],['#6b5480','#332448'],
                ['#4a4a8c','#191741'],['#33506e','#16223c'],['#8a3a5e','#33163e'],['#c97a4a','#4a2648']];

Object.assign(window.Ginger, { THEMES, LEVELS, LV_ICONS, LV_GRADS });
})();
