# asset-sale

Mijozlar o'zlariga kerakli aktiv/mulkni sotib olish uchun ariza qoldiradigan sayt.
Arizalar kelish tartibida **navbat (stek)** bo'lib saqlanadi. Keyingi bosqichda ular CRM'ga uzatiladi
(`applications.crm_synced_at` ustuni shu uchun tayyor). EDO tizimiga bog'liq emas.

## Imkoniyatlar
- `/` — aktivlar ro'yxati va ariza formasi (F.I.Sh., telefon, izoh; ro'yxatda yo'q aktivni ham yozish mumkin)
- `/admin` — arizalar navbati (eng eskisi tepada), status: Yangi → Jarayonda → Bajarildi / Rad etildi
- Himoya: telefon formati tekshiruvi, IP bo'yicha tezlik cheklovi (10 daqiqada 5 ariza), honeypot, admin API paroli

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
| `POST /api/applications` | Ariza: `{asset_id \| custom_asset, full_name, phone, comment}` |
| `GET /api/admin/applications[?status=]` | Navbat (Bearer `ADMIN_TOKEN`) |
| `PATCH /api/admin/applications/:id` | `{status}` |
| `GET/POST /api/admin/assets`, `PATCH /api/admin/assets/:id` | Aktivlarni boshqarish |

Baza fayli `DB_PATH` (standart `./data/asset-sale.db`), birinchi ishga tushishda namunaviy aktivlar qo'shiladi.
