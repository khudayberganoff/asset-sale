// Voronka bosqichlari (chapdan o'ngga). kind: open | won | lost
export const STAGES = [
  { key: 'new', title: 'Yangi lead', kind: 'open' },
  { key: 'info', title: 'Ma\'lumot berildi', kind: 'open' },
  { key: 'callback', title: 'Qayta bog\'lanish', hint: 'birinchi qo\'ng\'iroqda ko\'tarmasa', kind: 'open' },
  { key: 'meeting', title: 'Uchrashuv belgilandi', kind: 'open' },
  { key: 'visited', title: 'Ofisga keldi', kind: 'open' },
  { key: 'contract', title: 'Shartnoma qilindi', kind: 'won' },
  { key: 'junk', title: 'Sifatsiz lead', hint: 'Raqam xato yoki yo\'q', kind: 'lost' },
];
export const STAGE_KEYS = STAGES.map((s) => s.key);
export const stageTitle = (k) => STAGES.find((s) => s.key === k)?.title ?? k;
