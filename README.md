# asset-sale

Mijozlar o'zlariga kerakli aktiv/mulkni sotib olish uchun ariza qoldiradigan sayt.
Arizalar kelish tartibida **navbat (stek)** bo'lib saqlanadi. Keyingi bosqichda ular CRM'ga uzatiladi
(`applications.crm_synced_at` ustuni shu uchun tayyor). EDO tizimiga bog'liq emas.

## Imkoniyatlar
- `/` — mijozlar uchun: aktivlar ro'yxati va ariza formasi (F.I.Sh., telefon, manzil, izoh; ro'yxatda yo'q aktivni ham yozish mumkin). Ariza **"Yangi lead"** bosqichiga tushadi.
- `/admin` — **CRM (amoCRM uslubida kanban doska)**. Bosqichlar: Yangi lead → Ma'lumot berildi → Qayta bog'lanish → Uchrashuv belgilandi → Ofisga keldi → Shartnoma qilindi / Sifatsiz lead.
  - Kartochkani bosqichlar orasida sichqoncha bilan sudrab o'tkazish (ustunda soni va byudjet yig'indisi ko'rinadi)
  - Lead to'liq ma'lumoti: F.I.Sh., 2 ta telefon, manzil, pasport, tug'ilgan sana, email, manba, aktiv, byudjet, mas'ul xodim, keyingi aloqa sanasi (o'tib ketsa qizil), izoh
  - Har lead uchun tarix: bosqich o'zgarishlari avtomatik yoziladi, qo'lda izoh qo'shish mumkin
  - Qidiruv (ism, telefon, aktiv, manzil, pasport), "+ Yangi lead" (telefon/ofisdan kelganlarni qo'lda kiritish)
  - Bosqichlar `src/stages.js` da; yangi arizalar 30 soniyada o'zi paydo bo'ladi
- Himoya: telefon formati tekshiruvi, IP bo'yicha tezlik cheklovi (10 daqiqada 5 ariza), honeypot, CRM API paroli
- Eski bazalar (oddiy `status`: new/in_progress/done/rejected) birinchi ishga tushishda avtomatik yangi bosqichlarga o'tkaziladi

## Ishga tushirish
Node.js 22.13+ kerak (ichki `node:sqlite` ishlatiladi).
```bash
cp .env.example .env   # ADMIN_TOKEN ni to'ldiring
npm install
ADMIN_TOKEN=parol npm start   # http://localhost:3000
npm test
```

## API
| Yo'l | Tavsif |
|---|---|
| `GET /api/assets` | Faol aktivlar |
| `POST /api/applications` | Saytdan ariza: `{asset_id \| custom_asset, full_name, phone, address, comment}` |
| `GET /api/admin/stages` | Bosqichlar ro'yxati (Bearer `ADMIN_TOKEN`) |
| `GET /api/admin/leads[?q=]` | Barcha leadlar (har bosqichda eng eskisi birinchi) |
| `POST /api/admin/leads` | Lead qo'lda qo'shish |
| `GET/PATCH /api/admin/leads/:id` | Lead + tarix / maydonlar yoki `stage` ni yangilash |
| `POST /api/admin/leads/:id/notes` | Izoh qo'shish |
| `GET/POST /api/admin/assets`, `PATCH /api/admin/assets/:id` | Aktivlarni boshqarish |

Baza fayli `DB_PATH` (standart `./data/asset-sale.db`), birinchi ishga tushishda namunaviy aktivlar qo'shiladi.
