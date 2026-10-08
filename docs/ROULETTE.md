# Roulette — Catatan Fitur

Dokumen ini menjelaskan cara kerja fitur Roulette saat ini, file-file yang terlibat,
cara menambah roda baru, dan rencana jangka panjangnya.

---

## 1. Ringkasan

Roulette membuat sebuah **bola** dengan cara mengundi isinya lewat beberapa **roda**
secara berurutan. Saat ini ada dua roda: **Race** lalu **Weapon**.

- Roda berbentuk pixel-art, luas tiap irisan sebanding dengan **bobot** (bisa diatur user).
- Hasil undian ditentukan **seketika dan deterministik** dari sebuah seed; animasi roda
  hanya visual yang "mendarat" ke hasil tersebut.
- User tidak memasukkan seed. Seed dibuat acak setiap spin, tapi tetap **disimpan**
  bersama bola (untuk replay/test di masa depan).

---

## 2. Alur (flow) user

```
[Tahap 1: Weapon] ──Spin──► hasil ──(Spin again)──► ... ──Confirm──►
[Tahap 2: Trait ] ──Spin──► hasil ──Confirm──►
[Tahap N: ...   ] ──Spin──► hasil ──► isi "Ball name" ──Save──► Library
                                                        └──► "Roll another ball" (mulai dari tahap 1)
```

Aturan:

1. Setiap tahap = satu roda. User boleh **Spin again** sebanyak apa pun sebelum Confirm.
2. **Confirm** mengunci hasil tahap itu lalu pindah ke roda berikutnya.
3. Di **tahap terakhir**, tombol Confirm diganti **input nama bola (wajib, maks. 24 karakter) + Save**.
4. Penanda tahap di atas roda menunjukkan tahap aktif dan hasil tahap yang sudah dikunci (✓).
5. Slider peluang di bawah roda selalu milik roda **tahap aktif**.

> Saat ini tahapnya Race → Weapon: Race punya tombol Confirm, Weapon adalah tahap terakhir
> (input nama + Save).

**Toggle roda:** di atas penanda tahap ada checkbox untuk roda opsional (saat ini **Race**).
Weapon selalu aktif. Roda yang dimatikan dilewati, dan bola memakai nilai default
(mis. tanpa Race ⇒ HP 100, radius 32). Toggle hanya bisa diubah di tahap pertama sebelum
ada yang di-Confirm; mengubahnya me-reset roll. Status toggle disimpan di `stores/roulette.ts`
(`disabled`).

---

## 3. Arsitektur & file

| File | Peran |
|---|---|
| `engine/roulette.ts` | `spinWheel(seed, segments, which)`: undian berbobot, murni & deterministik. Generik, tidak tahu isinya weapon atau yang lain. |
| `components/RouletteWheel.vue` | Komponen roda pixel-art. Terima `slices` (id, weight, color, spriteId), expose `spinTo(id, landing, ms)`. Hanya visual. |
| `stores/roulette.ts` | Bobot tiap irisan per jenis roda (`WheelKind`), disimpan di localStorage. |
| `pages/roulette.vue` | Halaman + alur bertahap. Daftar tahap ada di konstanta `STEPS`. |
| `stores/library.ts` | Tempat bola hasil roulette disimpan (`SavedBall`). |

### 3.1 Undian (`spinWheel`)

- Input: `seed` (uint32) dan daftar `{ id, weight }`.
- Hanya irisan dengan `weight > 0` yang ikut; peluang = `weight / total`.
- Output: `{ seed, id, landing }`. `landing` ∈ [0.15, 0.85) = titik berhenti jarum di dalam
  irisan (kosmetik, tapi ikut deterministik).
- Seed + daftar irisan (id, urutan, bobot) yang sama ⇒ hasil selalu sama.
- Kalau semua bobot 0 ⇒ `EmptyRegistryError`.

### 3.2 Roda (`RouletteWheel.vue`)

- Digambar per piksel di canvas 192×192 lalu diperbesar dengan
  `image-rendering: pixelated` (tepi tajam, tanpa anti-aliasing).
- Rim gelap 2px, garis pemisah antar irisan, hub emas di tengah.
- Jarum: segi lima beraturan (bentuk gedung Pentagon) warna besi pedang, tetap di atas.
- Sprite tiap entri digambar di ukuran asli (32px) di tengah irisan, ikut berputar.
  Irisan < ~7% tidak menampilkan sprite (tidak muat).
- Animasi: 5 putaran penuh, ±3,5 detik, ease-out. `prefers-reduced-motion` ⇒ langsung ke hasil.
- Konstanta ukuran: `SIZE`, `R`, `RIM`, `HUB`; ukuran jarum: `PR` di `drawPointer`.

### 3.3 Bobot (`stores/roulette.ts`)

- `weights[kind][id]`, default `10`, rentang `0–100`. Bobot `0` = entri tidak muncul di roda.
- Tombol **Reset** mengembalikan semua bobot roda aktif ke default (peluang rata).

### 3.4 Data yang disimpan

```ts
SavedBall {
  id: string
  name: string                    // nama dari input user
  config: BallConfig              // raceId, weapons: [{ weaponId }], appearance, dll.
  seeds?: Record<string, number>  // satu seed per tahap, mis. { race: 42, weapon: 123456 }
}
```

---

## 4. Cara menambah roda baru (mis. Trait)

1. **Definisi + registry**: pastikan jenis baru punya registry (mis. `traitRegistry`) dengan
   `ids()` dan `get(id)` (minimal `name`, opsional `spriteId`/`iconId`).
2. **Jenis roda**: tambahkan ke `WheelKind` dan default `weights` di `stores/roulette.ts`:
   ```ts
   export type WheelKind = 'weapon' | 'trait'
   state: () => ({ weights: { race: {}, weapon: {}, trait: {} } })
   ```
3. **Tahap**: tambahkan entri di `STEPS` (`pages/roulette.vue`) sesuai urutan yang diinginkan:
   ```ts
   { kind: 'trait', label: 'Trait', optional: true, entries: () => traitRegistry.ids().map(...) }
   ```
4. **Simpan**: di `saveBall()`, petakan hasil tahap baru ke `BallConfig`
   (mis. `traits: [{ traitId: all.trait.id }]`). `seeds` otomatis ikut.
5. **Dokumen**: perbarui dokumen ini (tabel roda di bagian 5.1) dan `docs/PROJECT_OVERVIEW.md`.
   `optional: true` membuat roda bisa dimatikan lewat toggle.

Roda, slider peluang, Confirm, dan Save tidak perlu diubah.

---

## 5. Rencana jangka panjang

### 5.1 Urutan roda yang dituju

```
Race  →  Weapon  →  Trait  →  Ability  →  (nama + Save)
```

| Roda | Isi | Status |
|---|---|---|
| Race | Tubuh bola: HP, radius, speed, damageTaken, weaponSpin (`engine/races/`) | ✅ ada (Tier 1: Human, Elf, Orc) |
| Weapon | Senjata (sword, spear, hammer, bow, shuriken, …) | ✅ ada |
| Trait | Efek **pasif** (mis. vampiric, regen, spike) | ⏳ belum ada sistemnya |
| Ability | Skill **aktif** dengan cooldown (mis. dash, invisibility) | ⏳ belum ada sistemnya |

> **Penamaan (sudah dikonfirmasi):** **Trait = efek pasif** (bisa ke ball atau weapon),
> **Ability = skill aktif dengan cooldown**. Istilah "Skill" lama tidak dipakai lagi.

### 5.2 Hal yang perlu diputuskan sebelum menambah Trait / Ability

1. **Target Trait**: ke `ball` atau ke `weapon`? Satu Trait boleh valid untuk keduanya?
   - Jika berbeda target, roda Trait mungkin perlu dipecah, atau ada langkah kecil
     "terapkan ke ball/weapon" setelah undian.
2. **Kecocokan**: apakah ada kombinasi terlarang (mis. Trait tertentu tidak berlaku untuk Bow)?
   - Usulan: tiap entri punya `isCompatible(picks)`, dan roda tahap berikutnya hanya
     menampilkan entri yang cocok dengan hasil tahap sebelumnya.
3. **Jumlah slot**: berapa Trait/Ability per bola (mis. 1 weapon + 1 trait + 1 ability)?
   Jika lebih dari satu, sebuah tahap bisa diulang (mis. `Trait 1`, `Trait 2`) tanpa
   mengundi entri yang sama dua kali.
4. **Pemicu Ability (aktif)**: karena duel berjalan otomatis, tiap Ability butuh aturan
   kapan dipakai (mis. cooldown siap + musuh dalam jarak X), dan harus deterministik.

### 5.3 Peningkatan UX yang mungkin

- **Back**: kembali ke tahap sebelumnya (membatalkan Confirm) sebelum Save.
- **Ringkasan sebelum Save**: kartu berisi semua pilihan (ikon + nama) di atas input nama.
- **Rarity**: preset bobot (common/rare/epic) dan warna irisan per rarity,
  selain slider bobot manual.
- **Roda tampilan**: tahap opsional untuk warna/pattern bola (`appearance`).
- **Animasi hasil**: highlight irisan pemenang / efek spark saat jarum berhenti.

### 5.4 Integrasi dengan fitur lain

- **Library**: tampilkan `SavedBall.name`; bola lama yang tersimpan sebelum ada `name`
  perlu fallback (mis. `config.id`).
- **Versus**: pilih bola dari Library (saat ini Versus masih memakai bola default).
- **Replay/determinism**: `seeds` per tahap memungkinkan menyusun ulang hasil roulette
  persis, selama daftar entri dan bobotnya sama.

---

## 6. Catatan teknis & batasan saat ini

- Undian bergantung pada **urutan** entri dari registry; mengubah urutan registrasi
  akan mengubah hasil untuk seed yang sama.
- Bobot tidak ikut disimpan bersama bola; mereplay seed hanya akurat jika bobotnya sama.
  Jika replay penting, simpan juga snapshot bobot per tahap.
- Test yang belum dibuat: 17.2 (property test reproducibility) dan 17.6 (unit test
  roulette + library).

---

## 7. Untuk AI / coding agent

Bagian ini ditujukan untuk AI (Claude, Kiro, dll.) yang mengerjakan fitur Roulette.
Baca seluruh dokumen ini sebelum mengubah kode.

### 7.1 Invarian (jangan dilanggar)

- `spinWheel` di `engine/` **harus murni & deterministik**: tanpa `Math.random()`, tanpa
  waktu, tanpa import Vue/Nuxt. Randomness hanya untuk *membuat seed* di layer page.
- Hasil undian ditentukan **sebelum** animasi. `RouletteWheel.vue` tidak boleh memilih
  hasil; ia hanya memutar roda ke `id` + `landing` yang diberikan.
- Roda tetap **pixel-art**: rasterisasi per piksel + `image-rendering: pixelated`,
  sprite digambar dengan skala bulat (jangan skala < 1, piksel akan hilang).
- Seed **tidak** ditampilkan atau diinput user, tapi **wajib** tersimpan di `SavedBall.seeds`.
- Irisan dengan bobot 0 tidak boleh ikut undian maupun digambar.
- Generik: jangan menaruh logika khusus weapon di `spinWheel`, `RouletteWheel.vue`,
  atau `stores/roulette.ts`. Logika per jenis hanya di `STEPS` dan `saveBall()`.

### 7.2 Checklist saat menambah atau mengubah roda

- [ ] Jenis baru ditambahkan ke `WheelKind` **dan** default `weights` di `stores/roulette.ts`.
- [ ] Entri baru di `STEPS` (`pages/roulette.vue`) di posisi urutan yang benar.
- [ ] `saveBall()` memetakan hasil tahap baru ke `BallConfig`.
- [ ] Bagian 5.2 sudah diputuskan oleh user (target, kecocokan, slot, pemicu) — **tanya
      user jika belum**, jangan diasumsikan.
- [ ] Dokumen ini (dan `docs/PROJECT_OVERVIEW.md` bila perlu) diperbarui.
- [ ] `npx eslint .` dan `npx vue-tsc --noEmit -p .` lolos (Node 24: `nvm use 24`).

### 7.3 Konteks penting

- Sistem skill lama sudah **dihapus** (lihat task 16.8); kode lamanya ada di commit
  `548a969` dan bisa dijadikan referensi pola hook (`onHit`, `onHurt`, `onTick`, …)
  untuk Trait.
- Status effect (`engine/status.ts`) masih ada dan cocok untuk efek berdurasi Ability
  (invisible, regen, dll.).
- Konvensi repo: commit message bahasa Inggris dengan conventional commits, stage file
  spesifik (bukan `git add .`), konfirmasi user sebelum `git push`.
