# Aura — Draft Konsep

> **Status: draft / masih dibahas.** Belum ada kode. Dokumen ini menampung ide dan
> pertanyaan terbuka sebelum diputuskan. Jangan diimplementasikan sebelum bagian
> "Pertanyaan terbuka" dijawab user.

---

## 1. Ide awal

Bola bisa punya efek aktif — **buff**, **debuff**, atau efek dari **trait** seperti
*berserk* — dan efek itu terlihat sebagai sesuatu yang **memancar dari bola atau dari
senjatanya**. Sementara ini sebutannya "aura".

Yang masih membingungkan:

1. Namanya apa? Apakah "aura" itu efeknya, atau tampilannya?
2. Bagaimana membedakan aura buff dan aura debuff?
3. Aura bisa keluar dari bola maupun dari senjata — bagaimana mengaturnya?

---

## 2. Usulan: pisahkan *efek* dan *tampilan*

Kebingungan nama muncul karena satu kata dipakai untuk dua hal. Usulannya dipecah jadi
tiga istilah yang masing-masing punya satu tugas:

| Istilah | Tugas | Sudah ada? |
|---|---|---|
| **Status** | Efeknya: stat berubah, damage per tick, stun, dll. Buff & debuff satu sistem (`polarity`). | ✅ `engine/status.ts` |
| **Trait** | Sumber/pemicu pasif yang memasang status. Mis. Trait Berserk → pasang status `berserk` saat HP < 30%. | ⏳ belum |
| **Aura** | Tampilan visual sebuah status yang sedang aktif, memancar dari bola atau senjata. | ⏳ belum |

Jadi alurnya:

```
Trait / Weapon / Ability  ──applyStatus()──►  Status (efek)  ──dirender sebagai──►  Aura (visual)
```

- Efek **selalu** berupa Status. Tidak ada sistem efek kedua.
- "Aura" murni lapisan render; engine tidak perlu tahu soal aura (determinism aman).
- Status tanpa aura tetap tampil seperti sekarang: ikon di HUD.

### Contoh: Berserk

| Bagian | Isi (angka belum final) |
|---|---|
| Trait `berserk` | Saat HP bola < 30% → `applyStatus(world, ball.id, 'berserk', ball.id)` |
| Status `berserk` | buff, `weaponSpin ×1.3`, `damageTaken ×1.2` |
| Aura | api merah naik dari bola |

---

## 3. Bentuk data yang diusulkan

Field visual opsional di `StatusDefinition` (atau di tabel terpisah di sisi renderer,
supaya engine tetap bersih dari urusan tampilan — lihat pertanyaan terbuka #4):

```ts
aura?: {
  anchor: 'ball' | 'weapon'   // dari mana aura memancar
  color: string               // warna utama
  style: 'rise' | 'ring-out' | 'drip' | 'ring-in' | 'flicker'
}
```

---

## 4. Membedakan buff dan debuff

Prinsip dari `ASSETS_PLAN.md`: bedakan lewat **bentuk/gerak**, bukan warna saja.

| | Buff | Debuff |
|---|---|---|
| Arah gerak | **keluar / naik** — api naik, sinar, ring mengembang | **menempel / turun** — partikel menetes, ring menyusut, kedip |
| Keluarga warna | hangat: emas, merah, oranye | dingin / sakit: hijau, ungu, biru-abu |
| Ikon HUD | bingkai terang | bingkai gelap |

Dengan aturan ini, dua aura berwarna mirip tetap bisa dibedakan dari arah geraknya.

Contoh pemetaan untuk status yang sudah ada:

| Status | Polarity | Anchor | Style | Warna |
|---|---|---|---|---|
| `slow` | debuff | ball | `ring-in` | biru-abu |
| `poison` | debuff | ball | `drip` | hijau |
| `stun` | debuff | weapon | `flicker` | kuning pucat |
| `berserk` (baru) | buff | ball | `rise` | merah |

---

## 5. Aura dari bola vs dari senjata

Ada dua tingkat yang perlu dibedakan:

1. **Tampil di senjata** (mudah): status tetap menempel di **bola**, hanya visualnya
   digambar di senjata (`anchor: 'weapon'`). Cocok untuk `stun` (senjata lemas) atau
   buff yang mengubah `weaponSpin`.
2. **Benar-benar milik senjata** (lebih besar): status menempel ke **satu senjata**,
   mis. trait "flaming blade" hanya di pedang, bukan di busur yang juga dibawa.
   Saat ini `statusEffects` hanya ada di `Ball`, jadi ini butuh perubahan engine.

Usulan: mulai dari tingkat 1. Tingkat 2 ditunda sampai keputusan
"Target Trait: ball, weapon, atau keduanya?" di `PROJECT_OVERVIEW.md` §4.2 dijawab.

---

## 6. Pertanyaan terbuka

1. **Nama** — "Aura" dipakai khusus untuk visualnya saja, setuju? Atau ada nama lain?
2. **Langkah pertama** —
   (a) aura visual dulu untuk status yang sudah ada (slow/poison/stun), atau
   (b) langsung status + Trait `berserk` sebagai contoh pertama?
3. **Aura milik senjata** (§5 tingkat 2) — perlu sekarang, atau cukup tingkat 1 dulu?
4. **Tempat data visual** — field `aura` di `StatusDefinition` (praktis, satu tempat),
   atau tabel terpisah di renderer (engine bersih dari data tampilan)?
5. **Banyak aura sekaligus** — kalau bola punya 3 status, semua aura digambar bertumpuk,
   atau hanya yang terpenting (mis. buff terkuat + debuff terkuat)?
6. **Aset** — aura digambar prosedural di canvas, atau pakai spritesheet pixel-art
   (masuk `ASSETS_PLAN.md`)?

---

## 7. Terkait

- `engine/status.ts` — sistem Status (buff/debuff, stacking, modifier, control).
- `docs/PROJECT_OVERVIEW.md` §4.2 — rencana Trait & Ability.
- `docs/ASSETS_PLAN.md` — aturan visual & ikon status HUD.
- `composables/useVersusDuel.ts` (`drawHud`) — tempat ikon status digambar saat ini.
