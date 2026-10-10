# BallBrawler — Project Overview (untuk AI / coding agent)

Dokumen ini memberi gambaran besar proyek: apa game-nya, apa saja weapon-nya,
dan apa yang akan dikerjakan berikutnya. Baca ini dulu, lalu dokumen detail yang
dirujuk di bawah sebelum mengubah kode.

> Nilai angka di dokumen ini adalah snapshot. **Sumber kebenaran selalu kode**
> (`engine/weapons/*.ts`, `engine/engine.ts`). Kalau beda, ikuti kode dan perbarui dokumen ini.

---

## 1. Game ini apa

**Ball Battle Simulator** — web app yang terinspirasi video viral "ball vs ball":
dua bola memantul di arena dan bertarung **otomatis** (tanpa input pemain) memakai
weapon masing-masing sampai salah satu HP-nya habis.

Fitur utama:

| Halaman | Fungsi |
|---|---|
| `/roulette` | Membuat bola dengan mengundi isinya lewat roda pixel-art berbobot (saat ini hanya roda **Weapon**), lalu memberi nama dan menyimpannya ke Library. |
| `/library` | Daftar bola tersimpan, hapus, export/import JSON (Library + Settings). |
| `/versus` | Pilih 2 bola (default + Library), jalankan duel di canvas. Start, Rematch (seed sama), debug *Show hitboxes*. |
| `/recordings` | Rekaman duel (WebM via MediaRecorder; blob di IndexedDB). |
| `/settings` | Resolusi, aspect ratio, suara, kecepatan simulasi, aksesibilitas. |
| `/login`, `/register` | Akun (API sudah ada, UI belum — lihat Roadmap). |

Gaya visual: **retro pixel-art** di seluruh app (`imageSmoothingEnabled = false`,
integer scaling, sprite 32×32, ikon 16×16, font bitmap 8px).

### Tech stack

Nuxt 3 + TypeScript, Tailwind, Pinia (persisted ke localStorage), `nuxt-auth-utils`,
PostgreSQL + Drizzle ORM, Canvas 2D, Vitest (+ fast-check). **Tanpa library fisika** —
collision ditulis manual. Node 24 (`nvm use 24`).

### Arsitektur singkat

```
pages/ (Vue)  ──►  composables/useVersusDuel (rAF loop, render, FX, audio)  ──►  engine/ (pure TS)
stores/ (Pinia: library, roulette, settings, recordings)
server/ (Nitro API: auth, requireUser, can()) ──► PostgreSQL (Drizzle)
```

- `engine/` — simulasi murni: `createEngine(DuelConfig)` → `World`; `step()` = 1/60 s.
  Urutan step tetap: gerak → collision → weapon clash → damage + knockback → status effect → cek menang.
  Emit `EngineEvent`: `damage`, `weaponClash`, `ballDied`, `projectileReflected`,
  `projectileBlocked`, `wallSlam`, `matchEnded`.
- `engine/weapons/` — satu file per weapon, divalidasi & didaftarkan di `weaponRegistry`.
  Geometri hitbox & resolusi clash di `combat.ts`.
- `engine/roulette.ts` — `spinWheel(seed, segments)`: undian berbobot deterministik.
- `composables/useVersusDuel.ts` — hanya **membaca** state engine; interpolasi, hit-stop, partikel, hit-flash.

### Invarian penting (jangan dilanggar)

1. **Deterministik**: seed + `DuelConfig` sama ⇒ duel identik. RNG mulberry32 (`world.rng`),
   fixed timestep, urutan entity stabil. Di `engine/` dilarang `Math.random()`, `Date`,
   `performance.now()`, dan import Vue/Nuxt.
2. **Single damage gateway**: semua perubahan HP lewat `applyDamage(...)` (`engine/damage.ts`).
   Damage source: `contact`, `weapon`, `projectile` (union bisa diperluas).
3. **`engineVersion`** (`engine/engine.ts`, saat ini `1.3.0`) wajib di-bump bila perubahan
   bisa mengubah hasil duel (fisika, combat, stat weapon, RNG). Minor = balance, major = format.
4. Tidak ada state per-frame di reactivity Vue; engine dibuat saat mount, dibuang saat unmount.
5. Hitbox (data engine) terpisah dari sprite (visual). Engine tidak pernah membaca sprite.
6. Otorisasi server lewat `requireUser(event)` + `can(user, action)`.

---

## 2. Bola & Race

Stat tubuh bola berasal dari **race** (`BallConfig.raceId`, didefinisikan di `engine/races/`,
diresolusi engine lewat `ballStats()` seperti weapon). Bola lama tanpa race memakai
`maxHp`/`radius` dari config dengan multiplier netral (setara Human).

| Race | maxHp | radius | speed | damageTaken | weaponSpin |
|---|---|---|---|---|---|
| Human | 100 | 32 | ×1.00 | ×1.00 | ×1.00 |
| Elf | 85 | 28 | ×1.20 | ×1.00 | ×1.15 |
| Orc | 115 | 36 | ×0.85 | ×1.00 | ×0.85 |

- `speed` mengalikan kecepatan awal & `cruiseSpeed`; `damageTaken` mengalikan setiap damage
  yang masuk (di `applyDamage`); `weaponSpin` mengalikan putaran semua weapon (termasuk sapuan
  bidik Bow, tapi bukan interval tembak).
- Tier 2 (Dwarf, Goblin, Giant) menyusul setelah Tier 1 stabil.

| Atribut lain | Nilai |
|---|---|
| Kecepatan awal | ≈ 201 px/s (`hypot(180, 90)`), arah & posisi acak dari seed (`placeForDuel` di `utils/duel.ts`) |
| `weapons` | 1 weapon dari Roulette (array, secara desain boleh 0+) |
| `appearance` | warna / pattern / image (visual saja) |

Durasi duel median ≈ 55 detik, batas 90 detik saat uji balance (timeout = HP% lebih tinggi menang).

---

## 3. Weapon

Semua weapon memakai `mode: 'orbit'` (berputar mengelilingi bola: `angle += angularSpeed * dt`).
Bola di slot ganjil (bola kedua) mulai dengan arah putar terbalik, agar mirror match tetap bisa clash.

### 3.1 Tabel atribut

| Weapon | Length | Damage | Angular speed (rad/s) | Weight | Hit cooldown (ms) | Hitbox |
|---|---|---|---|---|---|---|
| **Sword** | 48 | 8 | 4.0 | 10 | 500 | segment 48 × 10 |
| **Hammer** | 42 | 10 | 2.4 | 30 | 1100 | circle r16 (kepala) |
| **Spear** | 72 | 6 | 3.0 | 8 | 600 | segment 72 × 8 |
| **Bow** | 24 | 0 (lewat panah) | 2.8 | 5 | 400 | segment 24 × 8 |
| **Scythe** | 46 | 6 | 3.6 | 15 | 800 | circle r14 (bilah) |

### 3.2 Skill unik per weapon

- **Sword — Riposte** (`riposte`): setiap clash di mana sword *tidak* ter-disarm, riposte siap selama **60 step (1 s)**:
  hit berikutnya **×2**, bilah berputar **2.5×** lebih cepat menghadap lawan, dan proyektil
  lawan yang disentuh **dipantulkan** balik ke penembaknya.
- **Hammer — Heavy blow** : terberat (30), jadi tidak pernah di-parry weapon lain; hit melempar bola lawan dengan
  `launchSpeed: 540`; `reboundOnHit` (spin berbalik setelah kena); **Wall slam**: jika bola
  yang terkena menabrak dinding dalam 45 step (0.75 s) → +6 damage.
  Visual (renderer saja): hit-stop lebih lama saat kontak (0.2 s), dan wall slam memunculkan
  shockwave abu-abu dari titik kontak dinding yang melebar sambil menipis sampai hilang.
- **Spear — Tip strike** (`tipStrike`): hit di **20% ujung** tombak → damage **×2**.
- **Bow — Projectile**: menembak panah (speed 320, radius 4, damage 7) tiap 100 step,
  hanya jika mengarah ±5° ke lawan; arah dibidik dengan *lead* ke posisi lawan berikutnya.
  `projectileBlockable`: panah bisa ditepis weapon melee lawan.
- **Scythe — Reap** (`reap`): hit memulai reap selama **60 step (1 s)**: bilah berputar **10×**
  lebih cepat dan bisa mengenai bola yang sama lagi tiap **4 step**. Hit scythe tidak memberi
  knockback (bilah terus memotong). Setelah reap selesai, lawan aman selama hit cooldown normal
  (800 ms), jadi reap tidak bisa berantai. Rata-rata ≈ 2.2 hit per reap (maks ≈ 7); win rate
  46% (20 seed × kedua slot vs 5 weapon lain), lemah vs Bow (15%). Renderer: swing trail abu-abu
  selama reap.

### 3.3 Aturan combat umum

- **Weapon clash** (weapon vs weapon) bukan damage; hasilnya satu dari `parry` / `bounce` /
  `disarm`, ditentukan oleh `weight` + RNG (`resolveClash` di `combat.ts`):
  - selisih bobot < 10% → `parry` (weapon sejenis selalu parry);
  - selain itu `disarm` dengan peluang = porsi bobot yang lebih berat, **dibatasi 60%**
    (`MAX_DISARM_CHANCE`), sisanya `bounce`.
  - Disarm = weapon yang kalah stun **18 step** (tidak bisa memberi damage).
  - Visual (renderer saja): parry memunculkan shockwave **putih** kecil di titik benturan
    (wall slam Hammer memakai shockwave abu-abu yang lebih besar).
- Hit weapon memberi knockback dasar 50 (Hammer memakai `launchSpeed`); clash knockback 120.
- **Hit cooldown** per pasangan attacker–target, agar satu ayunan tidak kena tiap frame.

### 3.4 Status balance terakhir

Win rate (engine 1.1.0, 20 seed × kedua slot, batas 90 s): Sword 62%, Hammer 68%, Spear 44%,
Shuriken 33%, Bow 43%. **Matchup individual masih timpang** (mis. Hammer 75% vs Sword,
Sword 78% vs Spear/Shuriken, Spear 83% vs Shuriken).
(Angka historis; Shuriken sudah dihapus di engine 1.4.0.)
Perubahan kecil bisa membalik seluruh matchup — ukur ulang setelah tiap perubahan stat.

### 3.5 Menambah weapon

1. Buat `engine/weapons/<id>.ts` berisi `WeaponDefinition`, panggil `weaponRegistry.register(def)`.
2. Import di `engine/weapons/index.ts`.
3. Sprite di `public/sprites/weapons/<id>.png` + entri di `assets/sprites/manifest.ts`;
   atur `spriteId`, `pivot`, `spriteReach` agar cocok dengan hitbox (cek *Show hitboxes*).
4. Otomatis muncul di roda Roulette. Bump `engineVersion`.

Field opsional yang tersedia: `projectile`, `launchSpeed`, `reboundOnHit`,
`wallSlam`, `riposte`, `reap`, `tipStrike`, `projectileBlockable` (lihat `engine/weapons/types.ts`).

---

## 4. Roadmap / rencana berikutnya

### 4.1 Pekerjaan terbuka

| Prioritas | Item | Catatan |
|---|---|---|
| Tinggi | **Balance pass lanjutan** | Fokus ke matchup yang timpang & tidak tergantung seed, bukan hanya win rate rata-rata. |
| Tinggi | **Balance race Tier 1**, lalu Tier 2 & tampilan race | Orc sedikit kuat, Elf lemah; sangat tergantung weapon (mis. Bow). |
| Tinggi | **Trait & Ability** (pengganti sistem Skill lama) | Lihat 4.2. |
| Sedang | **UI Login / Register / Logout** | API `/api/auth/*` sudah ada; butuh PostgreSQL jalan. |
| Sedang | **Home page** | Intro singkat + link ke Roulette & Versus. |
| Sedang | **Final checkpoint** | Semua test lolos + cek manual roulette, FX versus, settings, recording. |
| Rendah | Test opsional | Banyak property test belum dibuat, mis. reproducibility roulette, unit roulette + library. |

### 4.2 Trait & Ability (fitur besar berikutnya)

Penamaan sudah dikonfirmasi user: **Trait = efek pasif** (ke ball atau weapon),
**Ability = skill aktif dengan cooldown**. Istilah "Skill" lama tidak dipakai lagi.
Sistem skill lama (Vampire, Spike, Blaster, Splitter, Grower) **sudah dihapus**;
kodenya di commit `548a969` bisa jadi referensi pola hook (`onTick`, `onHit`, `onHurt`,
`onWallBounce`, `onDeath`). `engine/status.ts` (status effect berdurasi) cocok untuk efek
Trait/Ability: satu sistem untuk buff & debuff (`polarity`), pasang lewat `applyStatus()`,
stat efektif dihitung ulang tiap step dari `ball.base` + modifier (`recomputeStats`).
Debuff yang sudah ada: `slow` (modifier), `poison` (DoT, stack s/d 3), `stun` (control).
Belum ada sumber yang memasangnya — weapon/Trait/Ability yang memakai status masih ⏳.

Urutan roda Roulette yang dituju:

```
Race (✅ ada)  →  Weapon (✅ ada)  →  Trait (⏳)  →  Ability (⏳)  →  nama + Save
```

**Keputusan yang harus ditanyakan ke user sebelum implementasi** (jangan diasumsikan):

1. Target Trait: ball, weapon, atau keduanya?
2. Kecocokan: kombinasi terlarang? (usulan: `isCompatible(picks)` per entri)
3. Jumlah slot Trait/Ability per bola.
4. Pemicu Ability: kapan dipakai secara otomatis & deterministik (mis. cooldown siap + lawan dalam jarak X).

### 4.3 Ide lanjutan (belum dijadwalkan)

- Roulette: tombol Back, ringkasan sebelum Save, preset rarity, roda appearance, animasi hasil.
- Simpan snapshot bobot roda bersama bola agar seed bisa di-replay persis.
- Damage source baru yang sudah disiapkan union-nya: `area`, `dot`, `environment`, `beam`, `summon`, `reflect`.
- Roles: buat permission map nyata; **sebelum deploy publik `DEFAULT_ROLE` di `shared/roles.ts`
  wajib diubah dari `superuser` ke `viewer`**.

---

## 5. Rujukan

| Dokumen | Isi |
|---|---|
| `README.md` | Setup lokal, arsitektur, cara extend (weapon, damage source, trait/ability), determinism, roles. |
| `engine/README.md` | Detail engine. |
| `docs/ROULETTE.md` | Fitur Roulette & rencana Trait/Ability (bahasa Indonesia). |
| `docs/ASSETS_PLAN.md` | Katalog aset pixel-art (ukuran, pivot, hitbox, prompt). |

### Konvensi kerja

- Cek kualitas: `npm test`, `npx eslint .`, `npx vue-tsc --noEmit -p .` (setelah `nvm use 24`).
- Commit: bahasa Inggris, conventional commits (`feat:`, `fix:`, …), stage file spesifik
  (bukan `git add .`), konfirmasi user sebelum `git push`.
