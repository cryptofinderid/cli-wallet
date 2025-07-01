
# 🪙 CLI Wallet

CLI Wallet berbasis Node.js dan Ethers.js yang mendukung manajemen multi-wallet Ethereum & EVM-compatible secara lokal.  
Proyek ini memungkinkan pengguna untuk mengelola wallet, menambahkan jaringan, mengirim aset native maupun token ERC-20, serta melakukan batch transfer langsung dari terminal.

---

## 🚀 Fitur Utama

- 🔐 Generate wallet baru (mnemonic + private key)
- 📥 Import wallet dari mnemonic atau private key
- 🔄 Multi-wallet dengan fitur pemilihan wallet aktif
- 💰 Tampilkan saldo aset native (ETH, BNB, dll) dan token ERC-20
- ✉️ Kirim aset native atau token ke alamat tujuan
- 📦 Batch Send dari input manual atau file `.txt`
- 🔗 Tambah dan hapus kontrak token ERC-20
- 🌐 Manajemen jaringan kustom (RPC, simbol, token)
- 🧼 UI CLI bersih, terstruktur, dan profesional

---

## 📦 Instalasi

### 1. Clone Repositori

```bash
git clone https://github.com/cryptofinderid/cli-wallet.git
cd cli-wallet
````

### 2. Instal Dependensi

```bash
npm install
```

### 3. Jalankan Aplikasi

```bash
node main.js
```

---

## 🛠️ Struktur Proyek

```
📁 cli-wallet/
├── main.js              # Entry point aplikasi
├── wallet.json         # File penyimpanan wallet lokal (dibuat otomatis)
├── package.json         # File dependensi dan konfigurasi Node.js
└── README.md           # Dokumentasi
```

---

## 📄 Format File Batch (.txt)

Untuk fitur batch send, file `.txt` harus berisi daftar alamat dan jumlah token dalam format berikut:

```
0xABC123... 0.01
0xDEF456... 0.05
```

---

## ⚠️ Catatan Keamanan

* **Selalu lindungi file `wallet.json`**, karena berisi private key.
* Jangan pernah membagikan isi file ini kepada siapapun.
* Semua proses dilakukan secara **lokal tanpa server eksternal**.

---

## 🧠 Teknologi

* [Node.js](https://nodejs.org/)
* [Ethers.js](https://docs.ethers.org/)
* CLI Interface: native `readline`, `process.stdin`

---

## 👤 Kontributor

* 🧑‍💻 Dibuat oleh: **Fuad (Crypto Finder ID)**
* 📧 [Email](cryptofinderid@gmail.com)
* 🌐 [Telegram](https://t.me/cryptofinderid)

---

## 📜 Lisensi

Proyek ini dirilis di bawah lisensi **MIT**. Silakan gunakan, ubah, dan distribusikan dengan tetap mencantumkan atribusi.

---

## 🧪 Contoh Tampilan CLI

```
┌────────────────────────────────────────────────────────┐
│                       CLI Wallet                                 │
├────────────────────────────────────────────────────────┤
│ Nama   : MyWallet                                                │
│ Alamat : 0xABC123...DEF456                                       │
│ Network: Ethereum                                                │
└────────────────────────────────────────────────────────┘

 ────────────────────────────────────────────────────────
 Assets:
 ────────────────────────────────────────────────────────
 Ethereum                 0.1234 ETH
 USDT                    150.0000 USDT




 ───────────────────── Menu ──────────────────────────────
 [1] Kirim        [4] Kontrak        [7] Hapus
 [2] Batch Send   [5] Ganti Wallet   [8] About
 [3] Refresh      [6] Jaringan       [0] Keluar
 ────────────────────────────────────────────────────────
 Pilih:
```

---

## 🛠 Perintah CLI (Ringkasan)

| Menu        | Deskripsi                                               |
| ----------- | ------------------------------------------------------- |
| 1. Kirim    | Kirim aset native atau token ke satu alamat             |
| 2. Batch    | Kirim ke banyak alamat (manual atau import dari `.txt`) |
| 3. Refresh  | Perbarui tampilan saldo dan token                       |
| 4. Kontrak  | Tambah atau hapus token ERC-20                          |
| 5. Ganti    | Beralih ke wallet lain yang tersedia                    |
| 6. Jaringan | Pilih jaringan aktif atau tambahkan jaringan baru       |
| 7. Hapus    | Hapus wallet aktif dari sistem                          |
| 8. About    | Tampilkan informasi aplikasi                            |
| 0. Keluar   | Keluar dari CLI Wallet                                  |

---

```
