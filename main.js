const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { Wallet, JsonRpcProvider, Contract, formatEther, ethers } = require("ethers");

const walletFile = path.join(__dirname, "wallet.json");
const ethProvider = new JsonRpcProvider("https://eth-mainnet.public.blastapi.io");

const erc20Abi = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)"
];

const ui = {
  clear: () => process.stdout.write("\x1Bc"),
  input: (q) => new Promise((resolve) => {
    try { process.stdin.setRawMode(false); } catch {}
    process.stdin.pause();
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q, (a) => {
      rl.close();
      resolve(a.trim());
    });
  }),
  menu: (opts, title = "Pilih Opsi", defaultIndex = 0) => new Promise(resolve => {
    let i = defaultIndex;
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    const render = () => {
      ui.clear();
      console.log(`=== ${title} ===\n`);
      opts.forEach((o, j) => console.log(`${i === j ? "[✓]" : "[ ]"} ${o}`));
    };
    const onKey = key => {
      if (key === "\u0003") process.exit();
      else if (key === "\u001B[A" && i > 0) i--;
      else if (key === "\u001B[B" && i < opts.length - 1) i++;
      else if (key === "\r") {
        process.stdin.setRawMode(false);
        process.stdin.removeListener("data", onKey); ui.clear();
        resolve(opts[i]);
        return;
      }
      render();
    };
    process.stdin.on("data", onKey);
    render();
  }),
};

const utils = {
  fileExists: () => fs.existsSync(walletFile),
  readList: () => { try { const d = JSON.parse(fs.readFileSync(walletFile)); return Array.isArray(d) ? d : []; } catch { return []; } },
  saveList: (d) => fs.writeFileSync(walletFile, JSON.stringify(d, null, 2)),
  getPrimary: (list) => list.find(w => w.primary),
  getProvider: (wallet) => (wallet.currentNetwork || "Ethereum") === "Ethereum"
    ? ethProvider
    : new JsonRpcProvider(wallet.networks?.[wallet.currentNetwork]?.rpc || ""),
  short: (addr) => addr.slice(0, 6) + "..." + addr.slice(-4)
};

function renderMenuGridVertical(options, columnCount = 3, title = "Menu") {
  const totalWidth = 59;
  const colWidth = Math.floor(totalWidth / columnCount);

  const rowCount = Math.ceil(options.length / columnCount);
  const cols = Array.from({ length: columnCount }, (_, i) =>
    options.slice(i * rowCount, (i + 1) * rowCount)
  );

  const header = ` ${"─".repeat(25)} ${title} ${"─".repeat(totalWidth - 30 - title.length)}`;
  console.log(`\n${header}`);

  for (let row = 0; row < rowCount; row++) {
    const line = cols.map(col => (col[row] || "").padEnd(colWidth)).join("");
    console.log(" " + line.trimEnd());
  }

  console.log(" ────────────────────────────────────────────────────────");
}

function renderMenuAlwaysBottom(menu, columns = 2, title = "Menu") {
  const rows = process.stdout.rows;
  process.stdout.write(`\x1B[${rows - 7};0H`); // pindah ke 8 baris dari bawah
  renderMenuGridVertical(menu, columns, title);
}

async function generateWallet() {
  const wallet = Wallet.createRandom();
  const list = utils.readList().map(w => ({ ...w, primary: false }));
  const name = await promptName(list);
  const data = {
    name, address: wallet.address, privateKey: wallet.privateKey, mnemonic: wallet.mnemonic.phrase,
    primary: true, networks: {}, currentNetwork: "Ethereum"
  };
  list.push(data); utils.saveList(list);
  console.log("Wallet berhasil dibuat!");
  await showWallet(data);
}

async function promptName(list) {
  while (true) {
    const name = await ui.input("Nama wallet: ");
    if (!name) console.log("Tidak boleh kosong.");
    else if (list.some(w => w.name.toLowerCase() === name.toLowerCase())) console.log("⚠️  Nama sudah ada.");
    else return name;
  }
}

async function switchWallet() {
  const list = utils.readList();
  const current = utils.getPrimary(list);
  const options = list.map(w => `${w.name}${w.address === current.address ? " •" : ""}`);
  options.push("➕ Tambah Wallet");

  const pick = await ui.menu(options, "Ganti Wallet");

  if (pick === "➕ Tambah Wallet") {
    await initialMenu();
    return;
  }

  const idx = options.findIndex(o => o === pick);
  list.forEach((w, i) => w.primary = (i === idx));
  utils.saveList(list);
  await showWallet(list[idx]);
}

async function deleteWallet(wallet) {
  const confirm = await ui.input(` Hapus wallet '${wallet.name}'? (Y/n): `);
  if (confirm.toLowerCase() === "n") return;
  let list = utils.readList().filter(w => w.address !== wallet.address);
  if (list.length === 0) { fs.unlinkSync(walletFile); console.log("Wallet dihapus."); process.exit(0); }
  list[0].primary = true; utils.saveList(list);
  console.log("Wallet dihapus.");
  await showWallet(list[0]);
}

async function manageContracts(wallet) {
  const net = wallet.currentNetwork || "Ethereum";
  const list = utils.readList();
  const idx = list.findIndex(w => w.address === wallet.address);
  const tokens = list[idx].networks?.[net]?.tokens || [];

  const options = tokens.map(t => `${t.name} (${t.symbol})`) 
    .concat(["➕ Tambah Kontrak"]);

  const pick = await ui.menu(options, "Kontrak ERC-20");

  if (pick === "➕ Tambah Kontrak") {
    await addToken(wallet);
    return;
  }

  const tIdx = tokens.findIndex(t => `${t.name} (${t.symbol})` === pick);
  const conf = await ui.input(`Hapus kontrak ${tokens[tIdx].name}? (Y/n): `);
  if (conf.toLowerCase() === "n") return;

  tokens.splice(tIdx, 1);
  list[idx].networks[net].tokens = tokens;
  utils.saveList(list);
  console.log("Kontrak dihapus.");
}

async function addToken(wallet) {
  const provider = utils.getProvider(wallet);
  const ca = await ui.input("Contract Address: ");
  if (!/^0x[a-fA-F0-9]{40}$/.test(ca)) return console.log("Alamat tidak valid.");
  const c = new Contract(ca, erc20Abi, provider);
  try {
    const [name, symbol, decimals] = await Promise.all([c.name(), c.symbol(), c.decimals()]);
    console.log(`Nama : ${name}
Simbol : ${symbol}
Desimal : ${decimals}`);
    const conf = await ui.input("Simpan token ini? (Y/n): ");
    if (conf.toLowerCase() === "n") return;
    const list = utils.readList();
    const idx = list.findIndex(w => w.address === wallet.address);
    const net = wallet.currentNetwork || "Ethereum";
    list[idx].networks ||= {}; list[idx].networks[net] ||= { rpc: "", tokens: [] };
    const exists = list[idx].networks[net].tokens.some(t => t.address.toLowerCase() === ca.toLowerCase());
    if (!exists) {
      list[idx].networks[net].tokens.push({ name, symbol, decimals: Number(decimals), address: ca });
      utils.saveList(list); console.log("Token ditambahkan.");
    } else console.log("Token sudah ada.");
  } catch (err) {
    console.log("Gagal membaca kontrak.", err.message || err);
  }
}

async function sendAsset(wallet) {
  const provider = utils.getProvider(wallet);
  const signer = new Wallet(wallet.privateKey, provider);
  const net = wallet.currentNetwork || "Ethereum";

  const tokens = wallet.networks?.[net]?.tokens || [];
  const nativeSymbol = net === "Ethereum"
    ? "ETH"
    : (wallet.networks?.[net]?.symbol || "NATIVE");

  const assets = [
    { type: "native", symbol: nativeSymbol },
    ...tokens.map(t => ({ ...t, type: "erc20" }))
  ];

  const pick = await ui.menu(assets.map(a => `${a.symbol} (${a.type})`), "Pilih Aset");
  const asset = assets.find(a => `${a.symbol} (${a.type})` === pick);
  if (!asset) return console.log("❌ Aset tidak ditemukan.");

  const to = await ui.input("Alamat tujuan: ");
  const amtInput = await ui.input(`Jumlah ${asset.symbol}: `);
  const amt = parseFloat(amtInput);

  if (!/^0x[a-fA-F0-9]{40}$/.test(to) || isNaN(amt) || amt <= 0) {
    return console.log("❌ Data tidak valid.");
  }

  try {
    if (asset.type === "native") {
      const bal = await provider.getBalance(wallet.address);
      const val = ethers.parseEther(amt.toString());

      if (bal < val) return console.log("❌ Saldo tidak cukup.");

      const confirm = await ui.input(`Kirim ${amt} ${asset.symbol} ke ${to}? (Y/n): `);
      if (confirm.toLowerCase() === "n") return;

      const tx = await signer.sendTransaction({ to, value: val });
      console.log("✅ Transaksi berhasil dikirim.");
      console.log("Tx Hash:", tx.hash);
    } else {
      if (typeof asset.decimals !== "number") {
        return console.log("❌ Informasi token tidak lengkap.");
      }

      const c = new Contract(asset.address, erc20Abi, signer);
      const val = BigInt(Math.floor(amt * 10 ** asset.decimals));

      const confirm = await ui.input(`Kirim ${amt} ${asset.symbol} ke ${to}? (Y/n): `);
      if (confirm.toLowerCase() === "n") return;

      const tx = await c.transfer(to, val);
      console.log("✅ Transaksi token berhasil dikirim.");
      console.log("Tx Hash:", tx.hash);
    }
  } catch (err) {
    console.log("❌ Gagal mengirim transaksi.");
    console.log("Alasan:", err.reason || err.message || err);
  }
}

async function batchSend(wallet) {
  const provider = utils.getProvider(wallet);
  const signer = new Wallet(wallet.privateKey, provider);
  const net = wallet.currentNetwork || "Ethereum";

  const tokens = wallet.networks?.[net]?.tokens || [];
  const nativeSymbol = net === "Ethereum"
    ? "ETH"
    : (wallet.networks?.[net]?.symbol || "NATIVE");

  const assets = [
    { type: "native", symbol: nativeSymbol },
    ...tokens.map(t => ({ ...t, type: "erc20" }))
  ];

  const pick = await ui.menu(assets.map(a => `${a.symbol} (${a.type})`), "Aset Batch");
  const asset = assets.find(a => `${a.symbol} (${a.type})` === pick);
  if (!asset) return console.log("❌ Aset tidak ditemukan.");

  const inputMethod = await ui.menu(["Manual Input", "Import from .txt"], "Pilih Metode");

  let entries = [];

  if (inputMethod === "Manual Input") {
    console.log("\nMasukkan alamat dan jumlah per baris. Contoh:");
    console.log("0xABC123... 0.01\n0xDEF456... 0.05");
    console.log("\nKetik 'send' untuk mulai mengirim, atau kosongkan untuk batal.\n");

    while (true) {
      const line = await ui.input("> ");
      if (line.toLowerCase() === "send") break;
      if (!line.trim()) continue;
      const [addr, amt] = line.trim().split(/\s+/);
      if (!/^0x[a-fA-F0-9]{40}$/.test(addr) || isNaN(amt)) {
        console.log("❌ Format salah. Gunakan: <alamat> <jumlah>");
        continue;
      }
      entries.push({ address: addr, amount: parseFloat(amt) });
    }
  } else {
    const files = fs.readdirSync(".").filter(f => f.endsWith(".txt"));
    if (files.length === 0) return console.log("❌ Tidak ada file .txt ditemukan.");
    const filePick = await ui.menu(files, "Pilih File");
    const lines = fs.readFileSync(filePick, "utf-8").split("\n").filter(Boolean);
    for (const line of lines) {
      const [addr, amt] = line.trim().split(/\s+/);
      if (/^0x[a-fA-F0-9]{40}$/.test(addr) && !isNaN(amt)) {
        entries.push({ address: addr, amount: parseFloat(amt) });
      } else {
        console.log(`❌ Dilewati (tidak valid): ${line}`);
      }
    }
  }

  if (entries.length === 0) return console.log("❌ Tidak ada entri yang valid.");

  console.log("\n📤 Daftar Transaksi:");
  for (const e of entries) console.log(`  ${e.address} <= ${e.amount} ${asset.symbol}`);

  const konfirmasi = await ui.input("\nKetik 'Y' untuk konfirmasi kirim: ");
  if (konfirmasi.toLowerCase() !== "y") return console.log("❌ Dibatalkan.");

  console.log("\n⏳ Mengirim...");

  for (const [i, { address, amount }] of entries.entries()) {
    try {
      let tx;
      if (asset.type === "native") {
        const value = ethers.parseEther(amount.toString());
        tx = await signer.sendTransaction({ to: address, value });
      } else {
        const c = new Contract(asset.address, erc20Abi, signer);
        const val = BigInt(Math.floor(amount * 10 ** asset.decimals));
        tx = await c.transfer(address, val);
      }
      console.log(`✅ ${i + 1}/${entries.length} | ${amount} ${asset.symbol} => ${address}`);
      console.log(`   TX: ${tx.hash}`);
    } catch (err) {
      console.log(`❌ ${i + 1}/${entries.length} | Gagal kirim ke ${address}`);
      console.log(`   Alasan: ${err.reason || err.message}`);
    }
  }
}

async function switchNetwork(wallet) {
  const list = utils.readList();
  const idx = list.findIndex(w => w.address === wallet.address);
  const customNets = Object.keys(wallet.networks || {});
  const allNets = ["Ethereum", ...customNets.filter(n => n !== "Ethereum")];
  const options = [...allNets, "➕ Tambah jaringan"];
  const currentIndex = options.indexOf(wallet.currentNetwork || "Ethereum");
  const pick = await ui.menu(options, "Pilih Jaringan", currentIndex);

  if (pick === "➕ Tambah jaringan") {
    const name = await ui.input("🌐 Nama jaringan: ");
    const symbol = await ui.input("🔣 Simbol: ");
    const rpc = await ui.input("🔗 RPC URL: ");
    if (!name || !symbol || name.toLowerCase() === "ethereum" || !/^https?:\/\//.test(rpc)) {
      return console.log("❌ Tidak valid.");
    }
    list[idx].networks ||= {};
    list[idx].networks[name] = { rpc, symbol, tokens: [] };
    utils.saveList(list);
    return;
  }

  list[idx].currentNetwork = pick;
  utils.saveList(list);
  await showWallet(list[idx]);
}

function printBox(lines, width = 58) {
  const pad = (text = "") => {
    const plain = text.replace(/\x1b\[[0-9;]*m/g, ""); // hilangkan ANSI escape
    const space = width - plain.length;
    return `│ ${text}${" ".repeat(space - 1)}│`;
  };

  console.log("┌" + "─".repeat(width) + "┐");
  for (const line of lines) {
    console.log(pad(line));
  }
  console.log("└" + "─".repeat(width) + "┘");
}

async function showAbout() {
  ui.clear();

  const lines = [
    "\x1b[1mTentang CLI Wallet\x1b[0m",
    "",
    "🪙 CLI Wallet (Versi Lengkap)",
    "Dibuat oleh : Fuad",
    "Teknologi  : Node.js + Ethers.js",
    "Versi      : 1.0.0",
    "",
    "\x1b[1mFitur Utama:\x1b[0m",
    "1. Generate wallet baru",
    "2. Import wallet dari mnemonic/private key",
    "3. Multi-wallet dan pemilihan aktif",
    "4. Tampilkan saldo native & token ERC-20",
    "5. Kirim aset native (ETH, BNB, dll)",
    "6. Kirim token ERC-20",
    "7. Batch Send manual / file txt",
    "8. Tambah / hapus kontrak token",
    "9. Manajemen jaringan custom",
    "10. Hapus wallet"
  ];

  printBox(lines);
  await ui.input("\n Tekan Enter untuk kembali...");
}

async function showWallet(wallet) {
  ui.clear();
  const provider = utils.getProvider(wallet);
  const net = wallet.currentNetwork || "Ethereum";
  const nativeBal = await provider.getBalance(wallet.address);
  const nativeSymbol = net === "Ethereum" ? "ETH" : (wallet.networks?.[net]?.symbol || "NATIVE");
  console.log("┌────────────────────────────────────────────────────────┐");
  console.log("│                       \x1b[1mCLI Wallet\x1b[0m                       │");
  console.log("├────────────────────────────────────────────────────────┤");
  console.log(`│ Nama   : ${wallet.name.padEnd(46)}│`);
  console.log(`│ Alamat : ${wallet.address.slice(0, 43).padEnd(46)}│`);
  console.log(`│ Network: ${net.padEnd(46)}│`);
  console.log("└────────────────────────────────────────────────────────┘");
  
  console.log("\n ────────────────────────────────────────────────────────");
  console.log(" Assets:");
  console.log(" ────────────────────────────────────────────────────────");

  const totalWidth = 57;
const nameWidth = 24;const nativeName = net;
const nativeSymbolWithSpace = nativeSymbol + " ";
const nativeLeft = nativeName.padEnd(nameWidth);
const nativeBalStr = parseFloat(formatEther(nativeBal)).toFixed(4) + " ";
const nativeRightWidth = totalWidth - nameWidth - nativeSymbolWithSpace.length;
const nativeRight = nativeBalStr.padStart(nativeRightWidth) + nativeSymbolWithSpace;

console.log(" " + nativeLeft + nativeRight);

for (const t of wallet.networks?.[net]?.tokens || []) {
  const name = t.name || "";
  const symbol = t.symbol || "";
  const left = name.padEnd(nameWidth);
  const symbolWithSpace = symbol + " ";
  const rightWidth = totalWidth - nameWidth - symbolWithSpace.length;

  try {
    const contract = new Contract(t.address, erc20Abi, provider);
    const raw = await contract.balanceOf(wallet.address);
    const bal = Number(raw) / Math.pow(10, t.decimals);
    const balStr = bal.toFixed(4) + " ";
    const right = balStr.padStart(rightWidth) + symbolWithSpace;
    console.log(" " + left + right);
  } catch {
    const err = "(gagal membaca) ";
    const right = err.padStart(rightWidth) + symbolWithSpace;
    console.log(" " + left + right);
  }
}

  const menu = ["[1] Kirim", "[2] Batch Send", "[3] Refresh", "[4] Kontrak", "[5] Ganti Wallet", "[6] Jaringan", "[7] Hapus Wallet", "[8] About", "[0] Keluar"];
  renderMenuAlwaysBottom(menu, 3, "Menu");

  const c = await ui.input(" Pilih: ");
  process.stdout.write("\x1B[1A"); // naik satu baris
  process.stdout.write("\x1B[2K"); // bersihkan baris input

  if (c === "1") {
    await sendAsset(wallet);
    await ui.input("\nTekan Enter untuk kembali...");
  } else if (c === "2") {
    await batchSend(wallet);
    await ui.input("\nTekan Enter untuk kembali...");
  } else if (c === "3") await showWallet(utils.getPrimary(utils.readList()));
  else if (c === "4") await manageContracts(wallet);
  else if (c === "5") await switchWallet();
  else if (c === "6") await switchNetwork(wallet);
  else if (c === "7") await deleteWallet(wallet);
  else if (c === "8") {
    await showAbout();
    return await showWallet(wallet);
  }
  else if (c === "0") {
    const confirm = await ui.input(" Yakin ingin keluar? (Y/n): ");
    if (confirm.toLowerCase() === "n") {
      await showWallet(wallet);
    } else {
      ui.clear();
      process.exit(0);
    }
  }
}

async function initialMenu() {
  ui.clear();
  const option = await ui.menu(["Generate New Wallet", "Import Wallet"], "CLI Wallet");
  if (option === "Generate New Wallet") await generateWallet();
  else await importWallet();
}

async function importWallet() {
  const opt = await ui.menu(["Import from Mnemonic", "Import from Private Key"], "Import Wallet");
  const phrase = opt === "Import from Mnemonic"
    ? await ui.input("Masukkan mnemonic phrase: ")
    : await ui.input("Masukkan private key: ");
  try {
    const wallet = opt === "Import from Mnemonic"
      ? Wallet.fromPhrase(phrase)
      : new Wallet(phrase);
    const list = utils.readList().map(w => ({ ...w, primary: false }));
    const name = await promptName(list);
    const data = {
      name, address: wallet.address, privateKey: wallet.privateKey,
      mnemonic: opt === "Import from Mnemonic" ? phrase : null,
      primary: true, networks: {}, currentNetwork: "Ethereum"
    };
    list.push(data);
    utils.saveList(list);
    console.log("Wallet berhasil diimpor!");
    await showWallet(data);
  } catch {
    console.log("Data tidak valid.");
    await initialMenu();
  }
}

(async () => {
  ui.clear();
  if (!utils.fileExists()) await initialMenu();
  else {
    const list = utils.readList();
    const primary = utils.getPrimary(list);
    if (primary) await showWallet(primary);
    else await initialMenu();
  }
})();
