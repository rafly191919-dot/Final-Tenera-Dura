import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCatvZdoiio60Is3QKVFzTANAvK_ybkl_g",
  authDomain: "rafly-45dc4.firebaseapp.com",
  projectId: "rafly-45dc4",
  storageBucket: "rafly-45dc4.firebasestorage.app",
  messagingSenderId: "556160858793",
  appId: "1:556160858793:web:1cf6085488902b10f0c7b8"
};

const USERNAME_EMAIL_MAP = {
  grading: "grading@dura.local",
  staff: "staff@dura.local",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let unsubscribeToday = null;
let cachedTodayData = [];

document.addEventListener("DOMContentLoaded", () => {
  setToday();
  bindValidation();

  onAuthStateChanged(auth, (user) => {
    if (user) {
      showApp(user);
      subscribeTodayData();
    } else {
      unsubscribeTodayListener();
      showLogin();
    }
  });
});

window.login = login;
window.logout = logout;
window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
window.showPage = showPage;
window.saveTransaction = saveTransaction;
window.generateWA = generateWA;
window.copyWA = copyWA;
window.sendWA = sendWA;
window.refreshToday = refreshToday;
window.deleteTransaction = deleteTransaction;
window.exportExcel = exportExcel;

function showLogin() {
  document.getElementById("loginPage").classList.remove("hidden");
  document.getElementById("appPage").classList.add("hidden");
}

function showApp(user) {
  document.getElementById("loginPage").classList.add("hidden");
  document.getElementById("appPage").classList.remove("hidden");
  document.getElementById("userInfo").textContent = user.email || "User";
  setSyncInfo("Realtime aktif");
}

async function login() {
  const username = document.getElementById("username").value.trim().toLowerCase();
  const password = document.getElementById("password").value;
  const loginBtn = document.getElementById("loginBtn");
  const msg = document.getElementById("loginMessage");

  msg.textContent = "";

  if (!username || !password) {
    msg.textContent = "Username dan password wajib diisi.";
    return;
  }

  const email = USERNAME_EMAIL_MAP[username];
  if (!email) {
    msg.textContent = "Username tidak dikenal.";
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = "Memproses...";

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    msg.textContent = "Login gagal. Periksa akun Firebase Auth Anda.";
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Login";
  }
}

async function logout() {
  await signOut(auth);
  document.getElementById("username").value = "";
  document.getElementById("password").value = "";
  document.getElementById("loginMessage").textContent = "";
}

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("active");
  document.getElementById("overlay").classList.toggle("active");
}

function closeSidebar() {
  document.getElementById("sidebar").classList.remove("active");
  document.getElementById("overlay").classList.remove("active");
}

function showPage(pageId) {
  const pages = document.querySelectorAll(".page");
  pages.forEach((page) => page.classList.add("hidden"));
  document.getElementById(pageId).classList.remove("hidden");

  if (pageId === "dashboardPage") {
    renderDashboard(cachedTodayData);
  }
}

function setSyncInfo(text) {
  const el = document.getElementById("syncInfo");
  if (el) el.textContent = text;
}

function setToday() {
  const tanggalInput = document.getElementById("tanggal");
  if (tanggalInput) {
    tanggalInput.value = new Date().toISOString().split("T")[0];
  }
}

function bindValidation() {
  const tenera = document.getElementById("tenera");
  const dura = document.getElementById("dura");
  if (tenera) tenera.addEventListener("input", validateForm);
  if (dura) dura.addEventListener("input", validateForm);
}

function validateForm() {
  const tenera = Number(document.getElementById("tenera").value || 0);
  const dura = Number(document.getElementById("dura").value || 0);
  const total = tenera + dura;

  document.getElementById("previewTotal").textContent = total;
  document.getElementById("previewTenera").textContent = tenera;
  document.getElementById("previewDura").textContent = dura;

  const statusBox = document.getElementById("statusBox");
  const saveBtn = document.getElementById("saveBtn");

  if (total === 100) {
    statusBox.textContent = "Valid: Tenera + Dura = 100";
    statusBox.classList.remove("invalid");
    statusBox.classList.add("valid");
    saveBtn.disabled = false;
  } else {
    statusBox.textContent = "Tidak valid: Tenera + Dura harus 100";
    statusBox.classList.remove("valid");
    statusBox.classList.add("invalid");
    saveBtn.disabled = true;
  }
}

function formatTime(dateValue) {
  const d = new Date(dateValue);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return hh + ":" + mm;
}

function generateTrxId(dateStr, count) {
  const rawDate = dateStr.replace(/-/g, "");
  return "TRX-" + rawDate + "-" + String(count).padStart(3, "0");
}

async function getDaySequence(dateStr) {
  const q = query(
    collection(db, "transactions"),
    where("tanggal", "==", dateStr),
    where("deleted", "==", false)
  );
  const snap = await getDocs(q);
  return snap.size + 1;
}

async function saveTransaction() {
  const saveBtn = document.getElementById("saveBtn");
  const saveMessage = document.getElementById("saveMessage");

  const tanggal = document.getElementById("tanggal").value;
  const supplier = document.getElementById("supplier").value.trim();
  const sopir = document.getElementById("sopir").value.trim();
  const plat = document.getElementById("plat").value.trim();
  const tenera = Number(document.getElementById("tenera").value || 0);
  const dura = Number(document.getElementById("dura").value || 0);

  if (!tanggal || !supplier || !sopir || !plat) {
    saveMessage.textContent = "Semua field wajib diisi.";
    return;
  }

  if (tenera + dura !== 100) {
    saveMessage.textContent = "Tenera + Dura harus 100.";
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = "Menyimpan...";
  saveMessage.textContent = "Sedang menyimpan...";
  setSyncInfo("Menyimpan...");

  try {
    const seq = await getDaySequence(tanggal);
    const now = new Date().toISOString();

    await addDoc(collection(db, "transactions"), {
      trx_id: generateTrxId(tanggal, seq),
      tanggal,
      jam: formatTime(now),
      supplier,
      sopir,
      plat,
      tenera,
      dura,
      total: tenera + dura,
      persen_tenera: tenera,
      persen_dura: dura,
      created_by: auth.currentUser ? auth.currentUser.email : null,
      created_at: now,
      deleted: false
    });

    saveMessage.textContent = "Data berhasil disimpan.";
    setSyncInfo("Realtime aktif");
    resetForm();
  } catch (error) {
    saveMessage.textContent = "Gagal simpan: " + error.message;
    setSyncInfo("Gagal sinkron");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Simpan";
  }
}

function resetForm() {
  document.getElementById("supplier").value = "";
  document.getElementById("sopir").value = "";
  document.getElementById("plat").value = "";
  document.getElementById("tenera").value = "";
  document.getElementById("dura").value = "";

  document.getElementById("previewTotal").textContent = "0";
  document.getElementById("previewTenera").textContent = "0";
  document.getElementById("previewDura").textContent = "0";

  const statusBox = document.getElementById("statusBox");
  statusBox.textContent = "Belum valid";
  statusBox.classList.remove("valid");
  statusBox.classList.add("invalid");
  document.getElementById("saveBtn").disabled = true;
}

function refreshToday() {
  subscribeTodayData(true);
}

function unsubscribeTodayListener() {
  if (typeof unsubscribeToday === "function") {
    unsubscribeToday();
    unsubscribeToday = null;
  }
}

function subscribeTodayData(force = false) {
  const today = new Date().toISOString().split("T")[0];
  if (unsubscribeToday && !force) return;

  unsubscribeTodayListener();
  setSyncInfo("Menyambung realtime...");

  const q = query(
    collection(db, "transactions"),
    where("tanggal", "==", today),
    where("deleted", "==", false),
    orderBy("created_at", "desc")
  );

  unsubscribeToday = onSnapshot(
    q,
    (snapshot) => {
      cachedTodayData = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderDashboard(cachedTodayData);
      setSyncInfo("Realtime aktif");
    },
    () => {
      setSyncInfo("Gagal sinkron");
    }
  );
}

function renderDashboard(data) {
  document.getElementById("dashTotalTransaksi").textContent = data.length;
  document.getElementById("dashTotalTenera").textContent = data.reduce((sum, item) => sum + (item.tenera || 0), 0);
  document.getElementById("dashTotalDura").textContent = data.reduce((sum, item) => sum + (item.dura || 0), 0);

  const tbody = document.getElementById("dashboardTableBody");
  tbody.innerHTML = "";

  if (data.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="12">Belum ada data hari ini.</td>';
    tbody.appendChild(tr);
    return;
  }

  data.forEach((item) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.trx_id || ""}</td>
      <td>${item.tanggal || ""}</td>
      <td>${item.jam || ""}</td>
      <td>${item.supplier || ""}</td>
      <td>${item.sopir || ""}</td>
      <td>${item.plat || ""}</td>
      <td>${item.tenera || 0}</td>
      <td>${item.dura || 0}</td>
      <td>${item.total || 0}</td>
      <td>${item.persen_tenera || 0}%</td>
      <td>${item.persen_dura || 0}%</td>
      <td><span class="action-link" onclick="deleteTransaction('${item.id}')">Hapus</span></td>
    `;
    tbody.appendChild(tr);
  });
}

async function deleteTransaction(id) {
  const ok = confirm("Hapus data ini?");
  if (!ok) return;

  setSyncInfo("Menghapus...");
  try {
    await updateDoc(doc(db, "transactions", id), { deleted: true });
    setSyncInfo("Realtime aktif");
  } catch (error) {
    alert("Gagal hapus: " + error.message);
    setSyncInfo("Gagal sinkron");
  }
}

function generateWA() {
  const data = cachedTodayData;

  if (!data.length) {
    document.getElementById("waText").value = "Belum ada data untuk laporan hari ini.";
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  const totalTransaksi = data.length;
  const totalTenera = data.reduce((sum, item) => sum + (item.tenera || 0), 0);
  const totalDura = data.reduce((sum, item) => sum + (item.dura || 0), 0);
  const totalKeseluruhan = totalTenera + totalDura;
  const persenTenera = totalKeseluruhan ? ((totalTenera / totalKeseluruhan) * 100).toFixed(2) : "0.00";
  const persenDura = totalKeseluruhan ? ((totalDura / totalKeseluruhan) * 100).toFixed(2) : "0.00";
  const dominan = totalTenera >= totalDura ? "Tenera" : "Dura";

  const supplierMap = {};
  const sopirMap = {};

  data.forEach((item) => {
    if (!supplierMap[item.supplier]) supplierMap[item.supplier] = { transaksi: 0, tenera: 0, dura: 0 };
    supplierMap[item.supplier].transaksi += 1;
    supplierMap[item.supplier].tenera += item.tenera || 0;
    supplierMap[item.supplier].dura += item.dura || 0;

    if (!sopirMap[item.sopir]) sopirMap[item.sopir] = { transaksi: 0, tenera: 0, dura: 0 };
    sopirMap[item.sopir].transaksi += 1;
    sopirMap[item.sopir].tenera += item.tenera || 0;
    sopirMap[item.sopir].dura += item.dura || 0;
  });

  const topSupplier = Object.entries(supplierMap).sort((a, b) => b[1].transaksi - a[1].transaksi)[0];
  const topSopir = Object.entries(sopirMap).sort((a, b) => b[1].transaksi - a[1].transaksi)[0];

  let text = "";
  text += "LAPORAN HARIAN DURA TENERA\n";
  text += "Tanggal: " + today + "\n\n";
  text += "TOTAL\n";
  text += "- Total transaksi: " + totalTransaksi + "\n";
  text += "- Total Tenera: " + totalTenera + "\n";
  text += "- Total Dura: " + totalDura + "\n\n";
  text += "PERSENTASE\n";
  text += "- % Tenera: " + persenTenera + "%\n";
  text += "- % Dura: " + persenDura + "%\n\n";
  text += "KESIMPULAN\n";
  text += "- Dominan: " + dominan + "\n";
  text += "- Supplier tertinggi: " + (topSupplier ? topSupplier[0] : "-") + "\n";
  text += "- Sopir tertinggi: " + (topSopir ? topSopir[0] : "-") + "\n\n";
  text += "DETAIL PER SUPPLIER\n";

  Object.entries(supplierMap).forEach(([nama, val]) => {
    const subtotal = val.tenera + val.dura;
    const pT = subtotal ? ((val.tenera / subtotal) * 100).toFixed(2) : "0.00";
    const pD = subtotal ? ((val.dura / subtotal) * 100).toFixed(2) : "0.00";
    text += "- " + nama + ": " + val.transaksi + " transaksi | Tenera " + val.tenera + " | Dura " + val.dura + " | " + pT + "% : " + pD + "%\n";
  });

  text += "\nDETAIL PER SOPIR\n";
  Object.entries(sopirMap).forEach(([nama, val]) => {
    const subtotal = val.tenera + val.dura;
    const pT = subtotal ? ((val.tenera / subtotal) * 100).toFixed(2) : "0.00";
    const pD = subtotal ? ((val.dura / subtotal) * 100).toFixed(2) : "0.00";
    text += "- " + nama + ": " + val.transaksi + " transaksi | Tenera " + val.tenera + " | Dura " + val.dura + " | " + pT + "% : " + pD + "%\n";
  });

  document.getElementById("waText").value = text;
}

async function copyWA() {
  const text = document.getElementById("waText").value;
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    alert("Pesan berhasil disalin.");
  } catch {
    alert("Gagal menyalin pesan.");
  }
}

function sendWA() {
  const text = document.getElementById("waText").value.trim();
  if (!text) {
    alert("Generate pesan dulu.");
    return;
  }

  const encoded = encodeURIComponent(text);
  window.open("https://wa.me/?text=" + encoded, "_blank");
}

function exportExcel() {
  if (!cachedTodayData.length) {
    alert("Belum ada data untuk diexport.");
    return;
  }

  const rows = cachedTodayData.map((item) => ({
    "ID Transaksi": item.trx_id || "",
    "Tanggal": item.tanggal || "",
    "Jam": item.jam || "",
    "Supplier": item.supplier || "",
    "Sopir": item.sopir || "",
    "Plat": item.plat || "",
    "Tenera": item.tenera || 0,
    "Dura": item.dura || 0,
    "Total": item.total || 0,
    "% Tenera": item.persen_tenera || 0,
    "% Dura": item.persen_dura || 0,
    "Input Oleh": item.created_by || ""
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Transaksi Hari Ini");

  const today = new Date().toISOString().split("T")[0];
  XLSX.writeFile(wb, `dura-tenera-${today}.xlsx`);
}
