// ==========================================
// 0. INISIALISASI FIREBASE REALTIME DATABASE
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyBV5K_7j19i9ghtTsYYtefxWL2Sl_xQTcc",
  authDomain: "monopoly-multiplayer-ad825.firebaseapp.com",
  databaseURL: "https://monopoly-multiplayer-ad825-default-rtdb.asia-southeast1.firebasedatabase.app/", // <-- Pastikan ada asia-southeast1
  projectId: "monopoly-multiplayer-ad825",
  storageBucket: "monopoly-multiplayer-ad825.firebasestorage.app",
  messagingSenderId: "213475983234",
  appId: "1:213475983234:web:4fd4c812361608c85c199b",
  measurementId: "G-ENCCHST6SC"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ==========================================
// 1. SISTEM LOBBY & PEMAIN
// ==========================================
let activeRoomCode = null;
let isHostPlayer = false;

// Path folder gambar pion, ruko, dan hotel per pemain
const PILIHAN_PION = [
    { img: "pion/player1.png", rukoImg: "pion/ruko1.png", hotelImg: "pion/hotel1.png", warna: "#ef4444" },
    { img: "pion/player2.png", rukoImg: "pion/ruko2.png", hotelImg: "pion/hotel2.png", warna: "#07ce32" },
    { img: "pion/player3.png", rukoImg: "pion/ruko3.png", hotelImg: "pion/hotel3.png", warna: "#e7fa16" },
    { img: "pion/player4.png", rukoImg: "pion/ruko4.png", hotelImg: "pion/hotel4.png", warna: "#0b13f5" }
];

let paraPemain = [];
let giliranSekarang = 0;
let sudahLemparDadu = false;
let kasPajakTerkumpul = 0;
let daduTerakhir = 0;

const HARGA_RUKO = 250000;
const HARGA_HOTEL = 500000;

function buatRoom() {
    const nameInput = document.getElementById('player-name-input').value.trim() || "Pemain 1";
    activeRoomCode = hasilkanKodeRoom();
    isHostPlayer = true;

    paraPemain = [
        {
            id: 0,
            nama: nameInput,
            uang: 10000000,
            posisi: 0,
            warna: PILIHAN_PION[0].warna,
            pionImg: PILIHAN_PION[0].img,
            rukoImg: PILIHAN_PION[0].rukoImg,
            hotelImg: PILIHAN_PION[0].hotelImg,
            isHost: true,
            diPenjara: false,
            sudahLewatStart: false,
            jumlahLewatStart: 0,
            kartuBebasPenjara: 0
        }
    ];

    // Simpan data room ke Firebase
    db.ref('rooms/' + activeRoomCode).set({
        status: "waiting",
        host: nameInput,
        players: paraPemain,
        giliranId: 0
    }).then(() => {
        console.log("Room berhasil tersimpan di Firebase:", activeRoomCode);
        tampilkanRuangTunggu();
        pantauPerubahanRoom(); // Aktifkan listener real-time
    }).catch((err) => {
        console.error("Gagal menyimpan room:", err);
        alert("Gagal terhubung ke Firebase!");
    });
}

function gabungRoom() {
    const nameInput = document.getElementById('player-name-input').value.trim() || "Pemain Baru";
    const codeInput = document.getElementById('join-code-input').value.trim();

    if (codeInput.length !== 8) {
        alert("Kode undangan harus berjumlah 8 digit angka!");
        return;
    }

    // Cek keberadaan room di Firebase sebelum bergabung
    db.ref('rooms/' + codeInput).get().then((snapshot) => {
        if (!snapshot.exists()) {
            alert("Room tidak ditemukan! Periksa kembali kode room.");
            return;
        }

        const roomData = snapshot.val();
        if (roomData.status !== "waiting") {
            alert("Permainan di room ini sudah dimulai!");
            return;
        }

        activeRoomCode = codeInput;
        isHostPlayer = false;

        const newPlayerId = roomData.players ? roomData.players.length : 0;
        const pionIndex = newPlayerId % PILIHAN_PION.length;

        const pemainBaru = {
            id: newPlayerId,
            nama: nameInput,
            uang: 10000000,
            posisi: 0,
            warna: PILIHAN_PION[pionIndex].warna,
            pionImg: PILIHAN_PION[pionIndex].img,
            rukoImg: PILIHAN_PION[pionIndex].rukoImg,
            hotelImg: PILIHAN_PION[pionIndex].hotelImg,
            isHost: false,
            diPenjara: false,
            sudahLewatStart: false,
            jumlahLewatStart: 0,
            kartuBebasPenjara: 0
        };

        // Tambahkan pemain baru ke daftar pemain di Firebase
        const updatedPlayers = roomData.players || [];
        updatedPlayers.push(pemainBaru);

        db.ref('rooms/' + activeRoomCode + '/players').set(updatedPlayers).then(() => {
            paraPemain = updatedPlayers;
            tampilkanRuangTunggu();
            pantauPerubahanRoom();
        });
    }).catch((err) => {
        console.error("Gagal gabung room:", err);
        alert("Gagal terhubung ke server.");
    });
}

// Fungsi pendukung untuk menyinkronkan data antar-pemain secara otomatis
function pantauPerubahanRoom() {
    db.ref('rooms/' + activeRoomCode).on('value', (snapshot) => {
        const data = snapshot.val();
        if (data && data.players) {
            paraPemain = data.players;
            if (typeof perbaruiTampilanLobby === 'function') {
                perbaruiTampilanLobby();
            }
        }
    });
}

function tambahPemainManual() {
    if (paraPemain.length >= 4) {
        alert("Room sudah penuh! (Maksimal 4 pemain)");
        return;
    }

    const idx = paraPemain.length;
    const nextPion = PILIHAN_PION[idx];

    paraPemain.push({
        id: idx,
        nama: `Pemain ${idx + 1}`,
        uang: 10000000,
        posisi: 0,
        warna: nextPion.warna,
        pionImg: nextPion.img,
        rukoImg: nextPion.rukoImg,
        hotelImg: nextPion.hotelImg,
        isHost: false,
        diPenjara: false,
        sudahLewatStart: false,
        jumlahLewatStart: 0,
        kartuBebasPenjara: 0
    });

    renderDaftarPemainLobby();
}

function tampilkanRuangTunggu() {
    document.getElementById('lobby-options').classList.add('hidden');
    document.getElementById('room-waiting').classList.remove('hidden');
    document.getElementById('display-room-code').innerText = activeRoomCode;

    renderDaftarPemainLobby();
}

function renderDaftarPemainLobby() {
    const listElem = document.getElementById('room-players-list');
    const countElem = document.getElementById('player-count');
    const startBtn = document.getElementById('btn-start-game');

    listElem.innerHTML = '';
    countElem.innerText = paraPemain.length;

    paraPemain.forEach(p => {
        listElem.innerHTML += `
            <div class="room-player-item">
                <img src="${p.pionImg}" alt="Pion">
                <span style="color: ${p.warna}; font-weight: bold;">${p.nama}</span>
                ${p.isHost ? '<span class="host-tag">HOST</span>' : ''}
            </div>
        `;
    });

    startBtn.disabled = (paraPemain.length < 2);
}

function keluarLobby() {
    paraPemain = [];
    activeRoomCode = null;
    document.getElementById('room-waiting').classList.add('hidden');
    document.getElementById('lobby-options').classList.remove('hidden');
}

function mulaiGame() {
    if (paraPemain.length < 2) return;

    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');

    deckKesempatan = [...kartuKesempatan];
    deckDanaUmum = [...kartuDanaUmum];

    initBoardTiles();
    renderSemuaPionDanBangunan();
    perbaruiTampilan();
    catatLog(`Game dimulai dalam Room ${activeRoomCode}!`, "bonus");
    catatLog(`--- Giliran ${paraPemain[giliranSekarang].nama} ---`, "turn");
}

// ==========================================
// 2. KARTU KESEMPATAN & DANA UMUM
// ==========================================
const kartuKesempatan = [
    { langkah: -3, gambar: "Kartu_game/kartu_merahbiru/Kesempatan1.png" },
    { kePosisi: 0, hadiah: 200000, gambar: "Kartu_game/kartu_merahbiru/Kesempatan2.png" },
    { masukPenjara: true, gambar: "Kartu_game/kartu_merahbiru/Kesempatan3.png" },
    { denda: 100000, gambar: "Kartu_game/kartu_merahbiru/Kesempatan4.png" },
    { denda: 500000, gambar: "Kartu_game/kartu_merahbiru/Kesempatan5.png" },
    { denda: 1000000, gambar: "Kartu_game/kartu_merahbiru/Kesempatan6.png" },
    { hadiah: 1500000, gambar: "Kartu_game/kartu_merahbiru/Kesempatan7.png" },
    { kePosisi: 0, gambar: "Kartu_game/kartu_merahbiru/Kesempatan8.png" },
    { denda: 500000, gambar: "Kartu_game/kartu_merahbiru/Kesempatan9.png" },
    { perbaikanRumah: 200000, perbaikanHotel: 450000, gambar: "Kartu_game/kartu_merahbiru/Kesempatan10.png" },
    { denda: 250000, gambar: "Kartu_game/kartu_merahbiru/Kesempatan11.png" },
    { perbaikanRumah: 100000, perbaikanHotel: 250000, gambar: "Kartu_game/kartu_merahbiru/Kesempatan12.png" },
    { kePosisi: 37, gambar: "Kartu_game/kartu_merahbiru/Kesempatan13.png" },
    { bebasPenjara: true, gambar: "Kartu_game/kartu_merahbiru/Kesempatan14.png" }
];

const kartuDanaUmum = [
    { hadiah: 150000, gambar: "Kartu_game/kartu_merahbiru/Dana_Umum1.png" },
    { hadiah: 550000, gambar: "Kartu_game/kartu_merahbiru/Dana_Umum2.png" },
    { denda: 50000, gambar: "Kartu_game/kartu_merahbiru/Dana_Umum3.png" },
    { denda: 230000, gambar: "Kartu_game/kartu_merahbiru/Dana_Umum4.png" },
    { hadiah: 500000, gambar: "Kartu_game/kartu_merahbiru/Dana_Umum5.png" },
    { hadiah: 360000, gambar: "Kartu_game/kartu_merahbiru/Dana_Umum6.png" },
    { denda: 360000, gambar: "Kartu_game/kartu_merahbiru/Dana_Umum7.png" },
    { hadiah: 730000, gambar: "Kartu_game/kartu_merahbiru/Dana_Umum8.png" },
    { hadiah: 10000, gambar: "Kartu_game/kartu_merahbiru/Dana_Umum9.png" },
    { hadiah: 1890000, gambar: "Kartu_game/kartu_merahbiru/Dana_Umum10.png" },
    { denda: 50000, gambar: "Kartu_game/kartu_merahbiru/Dana_Umum11.png" },
    { hadiah: 450000, gambar: "Kartu_game/kartu_merahbiru/Dana_Umum12.png" },
    { denda: 100000, gambar: "Kartu_game/kartu_merahbiru/Dana_Umum13.png" },
    { denda: 50000, gambar: "Kartu_game/kartu_merahbiru/Dana_Umum14.png" }
];

let deckKesempatan = [];
let deckDanaUmum = [];
let kartuBebasPenjaraRef = null;

// ==========================================
// 3. DATABASE 40 KOTAK PROPERTI INDONESIA
// ==========================================
const daftarKotak = {
    0: { nama: "START (Pangkalan Ojol)", tipe: "start" },
    1: { nama: "Sabang", gambarCard: "Kartu_game/Kartu_tanah/komplek1.png", harga: 150000, sewaTanah: 60000, sewaRuko1: 90000, sewaRuko2: 120000, sewaRuko3: 150000, sewaRuko4: 180000, sewaHotel: 200000, hipotik: 50000, jumlahRuko: 0, adaHotel: false, statusHipotik: false, pemilik: null },
    2: { nama: "Dana Umum", tipe: "kartu" },
    3: { nama: "Merauke", gambarCard: "Kartu_game/Kartu_tanah/komplek2.png", harga: 200000, sewaTanah: 80000, sewaRuko1: 110000, sewaRuko2: 150000, sewaRuko3: 180000, sewaRuko4: 200000, sewaHotel: 300000, hipotik: 100000, jumlahRuko: 0, adaHotel: false, statusHipotik: false, pemilik: null },
    4: { nama: "PPh (Pajak)", pajak: 500000, tipe: "pajak" },
    5: { nama: "Stasiun KAI", gambarCard: "Kartu_game/Kartu_tanah/aset3.png", harga: 1500000, sewa: 150000, hipotik: 1250000, statusHipotik: false, pemilik: null, tipe: "infrastruktur" },
    6: { nama: "Malang", gambarCard: "Kartu_game/Kartu_tanah/komplek3.png", harga: 400000, sewaTanah: 100000, sewaRuko1: 130000, sewaRuko2: 160000, sewaRuko3: 190000, sewaRuko4: 210000, sewaHotel: 350000, hipotik: 200000, jumlahRuko: 0, adaHotel: false, statusHipotik: false, pemilik: null },
    7: { nama: "Kesempatan", tipe: "kartu" },
    8: { nama: "Bukittinggi", gambarCard: "Kartu_game/Kartu_tanah/komplek4.png", harga: 450000, sewaTanah: 110000, sewaRuko1: 140000, sewaRuko2: 180000, sewaRuko3: 210000, sewaRuko4: 240000, sewaHotel: 370000, hipotik: 225000, jumlahRuko: 0, adaHotel: false, statusHipotik: false, pemilik: null },
    9: { nama: "Yogyakarta", gambarCard: "Kartu_game/Kartu_tanah/komplek5.png", harga: 500000, sewaTanah: 120000, sewaRuko1: 150000, sewaRuko2: 180000, sewaRuko3: 210000, sewaRuko4: 240000, sewaHotel: 400000, hipotik: 250000, jumlahRuko: 0, adaHotel: false, statusHipotik: false, pemilik: null },
    10: { nama: "POS POLRI / PENJARA", tipe: "penjara" },
    11: { nama: "Solo", gambarCard: "Kartu_game/Kartu_tanah/komplek6.png", harga: 700000, sewaTanah: 200000, sewaRuko1: 230000, sewaRuko2: 260000, sewaRuko3: 290000, sewaRuko4: 310000, sewaHotel: 420000, hipotik: 350000, jumlahRuko: 0, adaHotel: false, statusHipotik: false, pemilik: null },
    12: { nama: "PDAM", gambarCard: "Kartu_game/Kartu_tanah/aset4.png", harga: 500000, sewa: 40000, hipotik: 250000, statusHipotik: false, pemilik: null, tipe: "utilitas" },
    13: { nama: "Semarang", gambarCard: "Kartu_game/Kartu_tanah/komplek7.png", harga: 750000, sewaTanah: 220000, sewaRuko1: 250000, sewaRuko2: 280000, sewaRuko3: 310000, sewaRuko4: 340000, sewaHotel: 450000, hipotik: 375000, jumlahRuko: 0, adaHotel: false, statusHipotik: false, pemilik: null },
    14: { nama: "Bandung", gambarCard: "Kartu_game/Kartu_tanah/komplek8.png", harga: 800000, sewaTanah: 240000, sewaRuko1: 260000, sewaRuko2: 290000, sewaRuko3: 310000, sewaRuko4: 340000, sewaHotel: 500000, hipotik: 400000, jumlahRuko: 0, adaHotel: false, statusHipotik: false, pemilik: null },
    15: { nama: "Bandara Soekarno Hatta", gambarCard: "Kartu_game/Kartu_tanah/aset6.png", harga: 1750000, sewa: 200000, hipotik: 1400000, statusHipotik: false, pemilik: null, tipe: "infrastruktur" },
    16: { nama: "Medan", gambarCard: "Kartu_game/Kartu_tanah/komplek9.png", harga: 900000, sewaTanah: 270000, sewaRuko1: 300000, sewaRuko2: 330000, sewaRuko3: 360000, sewaRuko4: 390000, sewaHotel: 550000, hipotik: 450000, jumlahRuko: 0, adaHotel: false, statusHipotik: false, pemilik: null },
    17: { nama: "Dana Umum", tipe: "kartu" },
    18: { nama: "Makassar", gambarCard: "Kartu_game/Kartu_tanah/komplek10.png", harga: 950000, sewaTanah: 290000, sewaRuko1: 320000, sewaRuko2: 350000, sewaRuko3: 380000, sewaRuko4: 410000, sewaHotel: 575000, hipotik: 475000, jumlahRuko: 0, adaHotel: false, statusHipotik: false, pemilik: null },
    19: { nama: "Surabaya", gambarCard: "Kartu_game/Kartu_tanah/komplek11.png", harga: 1000000, sewaTanah: 310000, sewaRuko1: 340000, sewaRuko2: 380000, sewaRuko3: 410000, sewaRuko4: 440000, sewaHotel: 600000, hipotik: 500000, jumlahRuko: 0, adaHotel: false, statusHipotik: false, pemilik: null },
    20: { nama: "Parkir Bebas", tipe: "parkir" },
    21: { nama: "Palembang", gambarCard: "Kartu_game/Kartu_tanah/komplek12.png", harga: 1100000, sewaTanah: 360000, sewaRuko1: 390000, sewaRuko2: 420000, sewaRuko3: 450000, sewaRuko4: 480000, sewaHotel: 650000, hipotik: 550000, jumlahRuko: 0, adaHotel: false, statusHipotik: false, pemilik: null },
    22: { nama: "Kesempatan", tipe: "kartu" },
    23: { nama: "Balikpapan", gambarCard: "Kartu_game/Kartu_tanah/komplek13.png", harga: 1150000, sewaTanah: 390000, sewaRuko1: 420000, sewaRuko2: 450000, sewaRuko3: 480000, sewaRuko4: 510000, sewaHotel: 675000, hipotik: 575000, jumlahRuko: 0, adaHotel: false, statusHipotik: false, pemilik: null },
    24: { nama: "Denpasar", gambarCard: "Kartu_game/Kartu_tanah/komplek14.png", harga: 1200000, sewaTanah: 420000, sewaRuko1: 450000, sewaRuko2: 480000, sewaRuko3: 510000, sewaRuko4: 540000, sewaHotel: 700000, hipotik: 600000, jumlahRuko: 0, adaHotel: false, statusHipotik: false, pemilik: null },
    25: { nama: "SPBU Pertamina", gambarCard: "Kartu_game/Kartu_tanah/aset1.png", harga: 1250000, sewa: 60000, hipotik: 1000000, statusHipotik: false, pemilik: null, tipe: "utilitas" },
    26: { nama: "Tangerang", gambarCard: "Kartu_game/Kartu_tanah/komplek15.png", harga: 1300000, sewaTanah: 490000, sewaRuko1: 520000, sewaRuko2: 550000, sewaRuko3: 580000, sewaRuko4: 610000, sewaHotel: 750000, hipotik: 650000, jumlahRuko: 0, adaHotel: false, statusHipotik: false, pemilik: null },
    27: { nama: "Bekasi", gambarCard: "Kartu_game/Kartu_tanah/komplek16.png", harga: 1350000, sewaTanah: 520000, sewaRuko1: 550000, sewaRuko2: 580000, sewaRuko3: 610000, sewaRuko4: 640000, sewaHotel: 775000, hipotik: 675000, jumlahRuko: 0, adaHotel: false, statusHipotik: false, pemilik: null },
    28: { nama: "PLN", gambarCard: "Kartu_game/Kartu_tanah/aset5.png", harga: 600000, sewa: 100000, hipotik: 300000, statusHipotik: false, pemilik: null, tipe: "utilitas" },
    29: { nama: "Dago", gambarCard: "Kartu_game/Kartu_tanah/komplek17.png", harga: 1400000, sewaTanah: 550000, sewaRuko1: 580000, sewaRuko2: 610000, sewaRuko3: 640000, sewaRuko4: 680000, sewaHotel: 800000, hipotik: 700000, jumlahRuko: 0, adaHotel: false, statusHipotik: false, pemilik: null },
    30: { nama: "PENJARA", tipe: "ke_penjara" },
    31: { nama: "Jakarta Pusat", gambarCard: "Kartu_game/Kartu_tanah/komplek18.png", harga: 1500000, sewaTanah: 600000, sewaRuko1: 630000, sewaRuko2: 660000, sewaRuko3: 690000, sewaRuko4: 720000, sewaHotel: 850000, hipotik: 750000, jumlahRuko: 0, adaHotel: false, statusHipotik: false, pemilik: null },
    32: { nama: "Jakarta Selatan", gambarCard: "Kartu_game/Kartu_tanah/komplek19.png", harga: 1600000, sewaTanah: 630000, sewaRuko1: 660000, sewaRuko2: 690000, sewaRuko3: 720000, sewaRuko4: 750000, sewaHotel: 875000, hipotik: 775000, jumlahRuko: 0, adaHotel: false, statusHipotik: false, pemilik: null },
    33: { nama: "Dana Umum", tipe: "kartu" },
    34: { nama: "Surabaya Barat", gambarCard: "Kartu_game/Kartu_tanah/komplek20.png", harga: 1700000, sewaTanah: 660000, sewaRuko1: 690000, sewaRuko2: 720000, sewaRuko3: 750000, sewaRuko4: 780000, sewaHotel: 900000, hipotik: 800000, jumlahRuko: 0, adaHotel: false, statusHipotik: false, pemilik: null },
    35: { nama: "Tanjung Priok", gambarCard: "Kartu_game/Kartu_tanah/aset2.png", harga: 2000000, sewa: 150000, hipotik: 1800000, statusHipotik: false, pemilik: null, tipe: "infrastruktur" },
    36: { nama: "Kesempatan", tipe: "kartu" },
    37: { nama: "SCBD Jakarta", gambarCard: "Kartu_game/Kartu_tanah/komplek21.png", harga: 1900000, sewaTanah: 700000, sewaRuko1: 730000, sewaRuko2: 760000, sewaRuko3: 790000, sewaRuko4: 820000, sewaHotel: 1000000, hipotik: 900000, jumlahRuko: 0, adaHotel: false, statusHipotik: false, pemilik: null },
    38: { nama: "Bayar PPh", pajak: 1000000, tipe: "pajak" },
    39: { nama: "IKN", gambarCard: "Kartu_game/Kartu_tanah/komplek22.png", harga: 2000000, sewaTanah: 750000, sewaRuko1: 780000, sewaRuko2: 810000, sewaRuko3: 840000, sewaRuko4: 880000, sewaHotel: 1100000, hipotik: 1000000, jumlahRuko: 0, adaHotel: false, statusHipotik: false, pemilik: null }
};

// ==========================================
// 4. INIT GRID 11x11 OVERLAY & PENENTUAN SISI
// ==========================================
function getCoordinates(index) {
    if (index <= 10) return { row: 11, col: 11 - index };
    if (index <= 20) return { row: 11 - (index - 10), col: 1 };
    if (index <= 30) return { row: 1, col: 1 + (index - 20) };
    return { row: 1 + (index - 30), col: 11 };
}

function initBoardTiles() {
    const gridElem = document.getElementById('board-grid');
    gridElem.innerHTML = '';

    for (let i = 0; i < 40; i++) {
        const coord = getCoordinates(i);
        const tile = document.createElement('div');
        
        let sideClass = "tile-corner";
        if (i > 0 && i < 10) sideClass = "tile-side-bottom";
        else if (i > 10 && i < 20) sideClass = "tile-side-left";
        else if (i > 20 && i < 30) sideClass = "tile-side-top";
        else if (i > 30 && i < 40) sideClass = "tile-side-right";

        tile.className = `tile-box ${sideClass}`;
        tile.style.gridRow = coord.row;
        tile.style.gridColumn = coord.col;
        tile.id = `tile-${i}`;

        tile.innerHTML = `
            <div class="building-container"></div>
            <div class="pion-container"></div>
        `;
        gridElem.appendChild(tile);
    }
}

// ==========================================
// 5. RENDER PION & BANGUNAN PRESISI SESUAI WARNA PEMAIN
// ==========================================
function renderSemuaPionDanBangunan() {
    for (let i = 0; i < 40; i++) {
        const tileElem = document.getElementById(`tile-${i}`);
        if (!tileElem) continue;

        const buildingBox = tileElem.querySelector('.building-container');
        const pionBox = tileElem.querySelector('.pion-container');

        buildingBox.innerHTML = '';
        pionBox.innerHTML = '';

        const kotak = daftarKotak[i];
        if (kotak && kotak.pemilik !== null) {
            const pemilik = paraPemain.find(p => p.id === kotak.pemilik);
            if (kotak.adaHotel) {
                const hotelImgSrc = pemilik ? pemilik.hotelImg : "hotel.png";
                buildingBox.innerHTML = `<img src="${hotelImgSrc}" class="hotel-img" title="Hotel ${pemilik ? pemilik.nama : ''}">`;
            } else if (kotak.jumlahRuko > 0) {
                buildingBox.className = `building-container ruko-count-${kotak.jumlahRuko}`;
                const rukoImgSrc = pemilik ? pemilik.rukoImg : "ruko.png";
                for (let r = 0; r < kotak.jumlahRuko; r++) {
                    buildingBox.innerHTML += `<img src="${rukoImgSrc}" class="ruko-img" title="Ruko ${pemilik ? pemilik.nama : ''}">`;
                }
            }
        }

        const pemainDiKotak = paraPemain.filter(p => p.posisi === i);
        if (pemainDiKotak.length > 0) {
            pionBox.className = `pion-container pion-count-${pemainDiKotak.length}`;
            pemainDiKotak.forEach(p => {
                pionBox.innerHTML += `<img src="${p.pionImg}" class="pion-img" title="${p.nama}">`;
            });
        }
    }
}

// ==========================================
// 6. MENAMPILKAN KARTU DI PANEL KIRI
// ==========================================
function tampilkanKartuDiPanelKiri(gambarSrc, indexKotak = null) {
    const emptyMsg = document.getElementById('empty-card-msg');
    const cardImg = document.getElementById('active-card-img');

    if (gambarSrc) {
        emptyMsg.classList.add('hidden');
        cardImg.src = gambarSrc;
        cardImg.classList.remove('hidden');
    } else {
        emptyMsg.classList.remove('hidden');
        cardImg.classList.add('hidden');
    }
}

// ==========================================
// 7. LOGIKA HIPOTIK & TEBUS KARTU TANAH
// ==========================================
function toggleHipotik(indexKotak) {
    const pemain = paraPemain[giliranSekarang];
    const k = daftarKotak[indexKotak];

    if (!k || k.pemilik !== pemain.id) return;

    if (!k.statusHipotik) {
        if (k.jumlahRuko > 0 || k.adaHotel) {
            alert("Jual semua Ruko dan Hotel terlebih dahulu sebelum meng-hipotikkan tanah ini!");
            return;
        }
        k.statusHipotik = true;
        pemain.uang += k.hipotik;
        catatLog(`${pemain.nama} meng-hipotikkan **${k.nama}** dan mendapat dana **${formatRupiah(k.hipotik)}**!`, "bonus");
    } else {
        const biayaTebus = Math.round(k.hipotik * 1.1);
        if (pemain.uang < biayaTebus) {
            alert(`Uang Anda tidak cukup untuk menebus hipotik! (Dibutuhkan ${formatRupiah(biayaTebus)})`);
            return;
        }
        pemain.uang -= biayaTebus;
        k.statusHipotik = false;
        catatLog(`${pemain.nama} menebus hipotik **${k.nama}** seharga **${formatRupiah(biayaTebus)}**!`, "buy");
    }

    renderSemuaPionDanBangunan();
    perbaruiTampilan();
    tampilkanKartuDiPanelKiri(k.gambarCard, indexKotak);
}

// ==========================================
// 8. RENDER BOX INVENTARIS DI PANEL KIRI
// ==========================================
function perbaruiInventoriKiri() {
    const invContainer = document.getElementById('inventory-box');
    if (!invContainer) return;

    const pemain = paraPemain[giliranSekarang];
    if (!pemain) {
        invContainer.innerHTML = '';
        return;
    }

    let html = `<div style="font-size: 0.9rem; font-weight: bold; margin-bottom: 10px; color: #f8fafc; border-bottom: 1px solid #334155; padding-bottom: 6px;">🎒 Inventaris ${pemain.nama}</div>`;
    let adaKartu = false;

    // A. Kartu Bebas Penjara
    if (pemain.kartuBebasPenjara > 0) {
        adaKartu = true;
        html += `
            <div class="inv-card-box jail-card-box" style="display:flex; justify-content:space-between; align-items:center; background:#0c4a6e; padding:8px 12px; border-radius:8px; margin-bottom:8px; border:1px solid #0284c7;">
                <span style="font-size: 0.8rem; font-weight: bold; color: #38bdf8;">🎟️ Bebas Penjara (${pemain.kartuBebasPenjara})</span>
                <button class="btn-use-card" onclick="pakaiKartuBebasPenjaraManual(${pemain.id})" style="font-size: 0.75rem; padding:5px 12px; background:#0284c7; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">Gunakan</button>
            </div>`;
    }

    // B. Daftar Kartu Tanah & Opsi Hipotik (Ukuran Gambar Ditingkatkan)
    let htmlTanah = '';
    Object.keys(daftarKotak).forEach(key => {
        const k = daftarKotak[key];
        if (k.pemilik === pemain.id) {
            adaKartu = true;
            const gambarSrc = k.gambarCard || 'default_card.png';
            const isHipotik = k.statusHipotik;
            const textHipotik = isHipotik ? "Tebus" : "Hipotik";
            const badgeHipotik = isHipotik ? `<span style="color:#f87171; font-size:0.65rem; font-weight:bold; background:#451a1a; padding:2px 6px; border-radius:4px; width:fit-content;">HIPOTIK</span>` : "";

            htmlTanah += `
                <div class="inv-card-box ${isHipotik ? 'is-hipotik' : ''}" style="display:flex; justify-content:space-between; align-items:center; background:${isHipotik ? '#3f1d1d' : '#334155'}; padding:8px 10px; border-radius:8px; margin-bottom:8px; border:1px solid ${isHipotik ? '#ef4444' : '#475569'};">
                    <div style="display:flex; align-items:center; gap:12px; cursor:pointer; flex: 1;" onclick="tampilkanKartuDiPanelKiri('${gambarSrc}', ${key})">
                        <img src="${gambarSrc}" style="width:52px; height:72px; object-fit:cover; border-radius:6px; box-shadow: 0 2px 5px rgba(0,0,0,0.5);" title="Klik untuk lihat ${k.nama}">
                        <div style="display:flex; flex-direction:column; gap:4px;">
                            <span style="font-size:0.85rem; font-weight:bold; color:#f1f5f9;">${k.nama}</span>
                            ${badgeHipotik}
                        </div>
                    </div>
                    <button class="btn-hipotik-action" onclick="toggleHipotik(${key})" style="font-size:0.75rem; padding:6px 12px; border-radius:6px; border:none; background:${isHipotik ? '#22c55e' : '#3b82f6'}; color:white; font-weight:bold; cursor:pointer;">${textHipotik}</button>
                </div>`;
        }
    });

    if (!adaKartu) {
        html += `<div style="font-size: 0.8rem; color: #94a3b8; font-style: italic; text-align: center; padding: 12px 0;">Belum memiliki kartu properti atau kartu bebas penjara.</div>`;
    } else {
        html += `<div class="inventory-list" style="max-height: 280px; overflow-y: auto; padding-right: 4px;">${htmlTanah}</div>`;
    }

    invContainer.innerHTML = html;
}

// ==========================================
// 9. UTILITAS & LOG BERWARNA
// ==========================================
function formatRupiah(nominal) {
    return "Rp " + nominal.toLocaleString('id-ID');
}

function catatLog(pesan, tipe = "default") {
    const logBox = document.getElementById('log-box');
    if (logBox) {
        logBox.innerHTML += `<p class="log-item log-${tipe}">• ${pesan}</p>`;
        logBox.scrollTop = logBox.scrollHeight;
    }
}

function perbaruiTampilan() {
    const playerStatus = document.getElementById('player-status');
    if (!playerStatus) return;

    playerStatus.innerHTML = '';
    paraPemain.forEach((p, idx) => {
        const isTurn = (idx === giliranSekarang);
        const turnLabel = isTurn ? " (Giliran Anda)" : "";
        const statusPenjara = p.diPenjara ? ` <span style="color: #ef4444; font-size: 0.75rem; font-weight: bold;">[🔒 DI PENJARA]</span>` : "";

        playerStatus.innerHTML += `
            <div class="player-card ${isTurn ? 'active-player-card' : ''}">
                <div class="player-header">
                    <span style="color: ${p.warna}; font-weight: bold;">${p.nama}${turnLabel}${statusPenjara}</span>
                    <span style="font-weight: bold;">${formatRupiah(p.uang)}</span>
                </div>
                <div style="font-size: 0.75rem; color: #475569; margin-top: 2px;">🚀 Lewat START: <b>${p.jumlahLewatStart || 0}x</b></div>
            </div>
        `;
    });

    perbaruiInventoriKiri();
}

function perbaruiStatusTombol(pemain) {
    const btnBeli = document.getElementById('buy-btn');
    const btnRuko = document.getElementById('build-ruko-btn');
    const btnHotel = document.getElementById('build-hotel-btn');

    btnBeli.disabled = true;
    btnRuko.disabled = true;
    btnHotel.disabled = true;

    const kotak = daftarKotak[pemain.posisi];
    if (!kotak) return;

    if (kotak.harga && kotak.pemilik === null) {
        if (pemain.uang >= kotak.harga) {
            btnBeli.disabled = false;
        }
    } 
    else if (kotak.harga && kotak.pemilik === pemain.id && kotak.sewaTanah !== undefined) {
        const totalLewatStart = pemain.jumlahLewatStart || 0;
        const targetRuko = kotak.jumlahRuko + 1;

        if (kotak.jumlahRuko < 4 && !kotak.adaHotel && !kotak.statusHipotik) {
            if (pemain.uang >= HARGA_RUKO && totalLewatStart >= targetRuko) {
                btnRuko.disabled = false;
            }
        } 
        else if (kotak.jumlahRuko === 4 && !kotak.adaHotel && !kotak.statusHipotik) {
            if (pemain.uang >= HARGA_HOTEL && totalLewatStart >= 5) {
                btnHotel.disabled = false;
            }
        }
    }
}

function hitungSewaProperti(kotak) {
    if (kotak.adaHotel) return kotak.sewaHotel;
    switch (kotak.jumlahRuko) {
        case 1: return kotak.sewaRuko1;
        case 2: return kotak.sewaRuko2;
        case 3: return kotak.sewaRuko3;
        case 4: return kotak.sewaRuko4;
        default: return kotak.sewaTanah;
    }
}

function bukaPopup(judul, deskripsi, gambarPath) {
    document.getElementById('popup-title').innerText = judul;
    document.getElementById('popup-desc').innerText = deskripsi;
    
    const imgElem = document.getElementById('popup-image');
    if (gambarPath) {
        imgElem.src = gambarPath;
        imgElem.style.display = "block";
    } else {
        imgElem.style.display = "none";
    }

    document.getElementById('popup-modal').classList.remove('popup-hidden');
}

function tutupPopup() {
    document.getElementById('popup-modal').classList.add('popup-hidden');
}

function cekPemainLainSudahLewatStart(pemain) {
    const pemainLain = paraPemain.filter(p => p.id !== pemain.id);
    if (pemainLain.length === 0) return true;
    return pemainLain.every(p => p.sudahLewatStart === true);
}

function gunakanKartuBebasPenjara(pemain) {
    if (pemain.kartuBebasPenjara > 0) {
        pemain.kartuBebasPenjara--;
        pemain.diPenjara = false;
        if (kartuBebasPenjaraRef) {
            deckKesempatan.push(kartuBebasPenjaraRef);
        }
        catatLog(`🎟️ **${pemain.nama}** menggunakan Kartu Bebas Penjara! Kartu dikembalikan ke tumpukan paling bawah.`, "bonus");
        perbaruiTampilan();
        return true;
    }
    return false;
}

function pakaiKartuBebasPenjaraManual(pemainId) {
    const pemain = paraPemain.find(p => p.id === pemainId);
    if (!pemain || pemain.id !== giliranSekarang) {
        alert("Hanya bisa digunakan saat giliran Anda!");
        return;
    }
    if (!pemain.diPenjara) {
        alert("Anda tidak sedang di dalam Penjara! Kartu ini disimpan sampai Anda masuk Penjara.");
        return;
    }
    gunakanKartuBebasPenjara(pemain);
}

// ==========================================
// 10. LOGIKA PARKIR BEBAS
// ==========================================
function bukaPopupParkirBebas(pemain) {
    document.getElementById('total-kas-pajak').innerText = formatRupiah(kasPajakTerkumpul);
    document.getElementById('teleport-select-box').classList.add('hidden');
    
    const btnPajak = document.getElementById('btn-klaim-pajak');
    if (kasPajakTerkumpul === 0) {
        btnPajak.style.opacity = "0.5";
        btnPajak.style.cursor = "not-allowed";
    } else {
        btnPajak.style.opacity = "1";
        btnPajak.style.cursor = "pointer";
    }

    document.getElementById('parkir-modal').classList.remove('popup-hidden');
}

function pilihOpsiParkir(opsi) {
    const pemain = paraPemain[giliranSekarang];

    if (opsi === 'pajak') {
        if (kasPajakTerkumpul === 0) {
            alert("Kas pajak sedang kosong!");
            return;
        }
        pemain.uang += kasPajakTerkumpul;
        catatLog(`${pemain.nama} mengambil seluruh Kas Pajak sebesar **${formatRupiah(kasPajakTerkumpul)}**!`, "bonus");
        kasPajakTerkumpul = 0;
        
        document.getElementById('parkir-modal').classList.add('popup-hidden');
        perbaruiTampilan();
    } 
    else if (opsi === 'teleport') {
        const selectElem = document.getElementById('select-kotak-tujuan');
        selectElem.innerHTML = '';

        Object.keys(daftarKotak).forEach(idx => {
            selectElem.innerHTML += `<option value="${idx}">${idx}. ${daftarKotak[idx].nama}</option>`;
        });

        document.getElementById('teleport-select-box').classList.remove('hidden');
    }
}

function eksekusiTeleport() {
    const pemain = paraPemain[giliranSekarang];
    const indeksTujuan = parseInt(document.getElementById('select-kotak-tujuan').value);

    pemain.posisi = indeksTujuan;
    catatLog(`${pemain.nama} memanfaatkan Parkir Bebas untuk berpindah ke **${daftarKotak[indeksTujuan].nama}**!`, "bonus");

    document.getElementById('parkir-modal').classList.add('popup-hidden');
    renderSemuaPionDanBangunan();
    perbaruiTampilan();

    cekKotak(pemain);
}

// ==========================================
// 11. ANIMASI PERGERAKAN PION & DADU
// ==========================================
const delay = ms => new Promise(res => setTimeout(res, ms));

async function lemparDadu() {
    if (sudahLemparDadu) return;

    const pemain = paraPemain[giliranSekarang];

    if (pemain.diPenjara) {
        if (pemain.kartuBebasPenjara > 0) {
            gunakanKartuBebasPenjara(pemain);
        } else if (cekPemainLainSudahLewatStart(pemain)) {
            pemain.diPenjara = false;
            catatLog(`🎉 Pemain lain telah melewati START! **${pemain.nama}** resmi bebas dari Penjara!`, "bonus");
            perbaruiTampilan();
        } else {
            catatLog(`🔒 **${pemain.nama}** masih DI PENJARA! (Menunggu pemain lain melewati START). Giliran dilewati...`, "rent");
            sudahLemparDadu = true;
            document.getElementById('roll-btn').disabled = true;

            await delay(1500);
            selesaiGiliran();
            return;
        }
    }

    const dadu1 = Math.floor(Math.random() * 6) + 1;
    const dadu2 = Math.floor(Math.random() * 6) + 1;
    const totalDadu = dadu1 + dadu2;
    daduTerakhir = totalDadu;

    document.getElementById('dice-result').innerText = `🎲 ${dadu1} + ${dadu2} = ${totalDadu}`;
    catatLog(`${pemain.nama} melempar dadu: ${dadu1} + ${dadu2} = ${totalDadu}`, "default");

    sudahLemparDadu = true;
    document.getElementById('roll-btn').disabled = true;

    for (let step = 0; step < totalDadu; step++) {
        pemain.posisi = (pemain.posisi + 1) % 40;

        if (pemain.posisi === 0) {
            pemain.uang += 2000000;
            pemain.sudahLewatStart = true;
            pemain.jumlahLewatStart = (pemain.jumlahLewatStart || 0) + 1;
            catatLog(`${pemain.nama} melewati START ke-${pemain.jumlahLewatStart} dan mendapat Gaji ${formatRupiah(2000000)}!`, "bonus");
        }

        renderSemuaPionDanBangunan();
        perbaruiTampilan();
        await delay(250);
    }

    cekKotak(pemain);
}

// ==========================================
// 12. CEK KOTAK & OPSI AKSI
// ==========================================
function cekKotak(pemain) {
    const kotak = daftarKotak[pemain.posisi];
    catatLog(`${pemain.nama} mendarat di **${kotak.nama}**.`, "default");

    if (kotak.gambarCard) {
        tampilkanKartuDiPanelKiri(kotak.gambarCard, pemain.posisi);
    }

    // A. KESEMPATAN & DANA UMUM
    if (kotak.tipe === "kartu") {
        const isKesempatan = (kotak.nama === "Kesempatan");
        const deck = isKesempatan ? deckKesempatan : deckDanaUmum;

        if (deck.length > 0) {
            const kartu = deck.shift();

            bukaPopup(`${kotak.nama} - ${pemain.nama}`, kartu.teks || `Kartu ${kotak.nama}`, kartu.gambar);

            if (kartu.hadiah) {
                pemain.uang += kartu.hadiah;
                catatLog(`${pemain.nama} mendapat ${formatRupiah(kartu.hadiah)}!`, "bonus");
            }
            if (kartu.denda) {
                pemain.uang -= kartu.denda;
                catatLog(`${pemain.nama} kena denda ${formatRupiah(kartu.denda)}!`, "rent");
            }
            if (kartu.perbaikanRumah !== undefined) {
                let totalRuko = 0;
                let totalHotel = 0;

                Object.keys(daftarKotak).forEach(key => {
                    const k = daftarKotak[key];
                    if (k.pemilik === pemain.id) {
                        if (k.adaHotel) totalHotel += 1;
                        else totalRuko += (k.jumlahRuko || 0);
                    }
                });

                const totalBiaya = (totalRuko * kartu.perbaikanRumah) + (totalHotel * kartu.perbaikanHotel);
                pemain.uang -= totalBiaya;
                catatLog(`${pemain.nama} membayar perbaikan sebesar **${formatRupiah(totalBiaya)}** (${totalRuko} Ruko, ${totalHotel} Hotel)!`, "rent");
            }
            if (kartu.langkah) {
                const jenisLangkah = kartu.langkah > 0 ? "maju" : "mundur";
                catatLog(`${pemain.nama} ${jenisLangkah} ${Math.abs(kartu.langkah)} langkah!`, "turn");
                pemain.posisi = (pemain.posisi + kartu.langkah + 40) % 40;
                renderSemuaPionDanBangunan();
                perbaruiTampilan();
            }
            if (kartu.kePosisi !== undefined) {
                pemain.posisi = kartu.kePosisi;
                if (kartu.kePosisi === 0) {
                    pemain.sudahLewatStart = true;
                    pemain.jumlahLewatStart = (pemain.jumlahLewatStart || 0) + 1;
                }
                catatLog(`${pemain.nama} berpindah ke ${daftarKotak[kartu.kePosisi].nama}!`, "bonus");
                renderSemuaPionDanBangunan();
                perbaruiTampilan();
            }
            if (kartu.bebasPenjara) {
                pemain.kartuBebasPenjara = (pemain.kartuBebasPenjara || 0) + 1;
                kartuBebasPenjaraRef = kartu;
                catatLog(`${pemain.nama} mendapatkan **Kartu Bebas Penjara**! (Kartu disimpan di inventaris)`, "bonus");
            } else {
                deck.push(kartu);
            }

            if (kartu.masukPenjara) {
                if (pemain.kartuBebasPenjara > 0) {
                    gunakanKartuBebasPenjara(pemain);
                } else {
                    pemain.posisi = 10;
                    pemain.diPenjara = true;
                    catatLog(`${pemain.nama} langsung masuk Penjara!`, "rent");
                    renderSemuaPionDanBangunan();
                    perbaruiTampilan();
                }
            }
        }
    }
    // B. PARKIR BEBAS
    else if (kotak.tipe === "parkir") {
        catatLog(`${pemain.nama} mendarat di Parkir Bebas!`, "bonus");
        bukaPopupParkirBebas(pemain);
    }
    // C. PAJAK
    else if (kotak.tipe === "pajak") {
        pemain.uang -= kotak.pajak;
        kasPajakTerkumpul += kotak.pajak;
        catatLog(`${pemain.nama} bayar pajak sebesar ${formatRupiah(kotak.pajak)}. (Kas Pajak terkumpul: ${formatRupiah(kasPajakTerkumpul)})`, "rent");
    }
    // D. MASUK PENJARA
    else if (kotak.tipe === "ke_penjara") {
        if (pemain.kartuBebasPenjara > 0) {
            gunakanKartuBebasPenjara(pemain);
        } else {
            pemain.posisi = 10;
            pemain.diPenjara = true;
            catatLog(`${pemain.nama} mendarat di kotak Masuk Penjara!`, "rent");
            renderSemuaPionDanBangunan();
            perbaruiTampilan();
        }
    }
    // E. PROPERTI / UTILITAS / INFRASTRUKTUR
    else if (kotak.harga) {
        if (kotak.pemilik === null) {
            // Properti belum ada pemilik
        } else if (kotak.pemilik === pemain.id) {
            catatLog(`Ini adalah properti milik Anda sendiri.`, "default");
        } else {
            const pemilik = paraPemain[kotak.pemilik];
            if (kotak.statusHipotik) {
                catatLog(`Properti ini sedang dihipotikkan, bebas sewa.`, "default");
            } else {
                let tarifSewa = 0;
                if (kotak.tipe === "infrastruktur" || kotak.tipe === "utilitas") {
                    tarifSewa = kotak.sewa * daduTerakhir;
                    pemain.uang -= tarifSewa;
                    pemilik.uang += tarifSewa;
                    catatLog(`${pemain.nama} membayar sewa ${formatRupiah(tarifSewa)} (${formatRupiah(kotak.sewa)} × ${daduTerakhir} angka dadu) ke ${pemilik.nama}.`, "rent");
                } else {
                    tarifSewa = hitungSewaProperti(kotak);
                    pemain.uang -= tarifSewa;
                    pemilik.uang += tarifSewa;
                    catatLog(`${pemain.nama} membayar sewa ${formatRupiah(tarifSewa)} ke ${pemilik.nama}.`, "rent");
                }
            }
        }
    }

    perbaruiStatusTombol(pemain);
    document.getElementById('end-turn-btn').disabled = false;
}

function beliTanah() {
    const pemain = paraPemain[giliranSekarang];
    const kotak = daftarKotak[pemain.posisi];

    if (kotak && kotak.harga && kotak.pemilik === null && pemain.uang >= kotak.harga) {
        pemain.uang -= kotak.harga;
        kotak.pemilik = pemain.id;

        catatLog(`${pemain.nama} membeli **${kotak.nama}** seharga ${formatRupiah(kotak.harga)}!`, "buy");
        tampilkanKartuDiPanelKiri(kotak.gambarCard, pemain.posisi);

        perbaruiTampilan();
        perbaruiStatusTombol(pemain);
    }
}

function beliRuko() {
    const pemain = paraPemain[giliranSekarang];
    const kotak = daftarKotak[pemain.posisi];
    const targetRuko = kotak.jumlahRuko + 1;
    const totalLewatStart = pemain.jumlahLewatStart || 0;

    if (totalLewatStart < targetRuko) {
        alert(`Anda harus melewati START minimal ${targetRuko}x untuk membangun Ruko ke-${targetRuko}! (Saat ini baru ${totalLewatStart}x)`);
        return;
    }

    if (kotak && kotak.sewaTanah !== undefined && kotak.pemilik === pemain.id && kotak.jumlahRuko < 4 && !kotak.adaHotel && !kotak.statusHipotik) {
        if (pemain.uang >= HARGA_RUKO) {
            pemain.uang -= HARGA_RUKO;
            kotak.jumlahRuko += 1;

            catatLog(`${pemain.nama} membangun Ruko ke-${kotak.jumlahRuko} di **${kotak.nama}**!`, "build");

            renderSemuaPionDanBangunan();
            perbaruiTampilan();
            perbaruiStatusTombol(pemain);
        }
    }
}

function beliHotel() {
    const pemain = paraPemain[giliranSekarang];
    const kotak = daftarKotak[pemain.posisi];
    const totalLewatStart = pemain.jumlahLewatStart || 0;

    if (totalLewatStart < 5) {
        alert(`Anda harus melewati START minimal 5x untuk membangun Hotel! (Saat ini baru ${totalLewatStart}x)`);
        return;
    }

    if (kotak && kotak.sewaTanah !== undefined && kotak.pemilik === pemain.id && kotak.jumlahRuko === 4 && !kotak.adaHotel && !kotak.statusHipotik) {
        if (pemain.uang >= HARGA_HOTEL) {
            pemain.uang -= HARGA_HOTEL;
            kotak.jumlahRuko = 0;
            kotak.adaHotel = true;

            catatLog(`${pemain.nama} meningkatkan **${kotak.nama}** menjadi Hotel Bintang 5!`, "build");

            renderSemuaPionDanBangunan();
            perbaruiTampilan();
            perbaruiStatusTombol(pemain);
        }
    }
}

function selesaiGiliran() {
    sudahLemparDadu = false;
    giliranSekarang = (giliranSekarang + 1) % paraPemain.length;

    document.getElementById('roll-btn').disabled = false;
    document.getElementById('buy-btn').disabled = true;
    document.getElementById('build-ruko-btn').disabled = true;
    document.getElementById('build-hotel-btn').disabled = true;
    document.getElementById('end-turn-btn').disabled = true;

    tampilkanKartuDiPanelKiri(null);

    perbaruiTampilan();
    catatLog(`--- Giliran ${paraPemain[giliranSekarang].nama} ---`, "turn");
}