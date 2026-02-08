async function handleDownload() {
    const urlInput = document.getElementById('urlInput');
    const url = urlInput.value.trim();
    const format = document.querySelector('input[name="format"]:checked').value;
    const btn = document.getElementById('dlBtn');
    const loader = document.getElementById('loader');
    const resultDiv = document.getElementById('result');

    // 1. Validasi Input
    if (!url) {
        alert("Masukkan link video atau musik terlebih dahulu!");
        return;
    }

    // 2. UI State: Start Loading
    btn.disabled = true;
    btn.innerText = "Processing Scraper...";
    loader.style.display = 'block';
    resultDiv.style.display = 'none';

    try {
        // 3. Panggil API Backend (Mega Scraper)
        // Kita kirim URL dan Format sebagai Query String
        const response = await fetch(`/api/download?url=${encodeURIComponent(url)}&format=${format}`);
        const data = await response.json();

        if (data.success) {
            // 4. Tampilkan Hasil
            document.getElementById('resTitle').innerText = data.title;
            const dlLink = document.getElementById('resLink');
            dlLink.href = data.download_url;
            
            // Tambahkan nama file otomatis jika memungkinkan
            dlLink.setAttribute('download', `${data.title}.${format}`);

            resultDiv.style.display = 'block';
            btn.innerText = "Success!";
            
            // Scroll otomatis ke hasil (untuk mobile)
            resultDiv.scrollIntoView({ behavior: 'smooth' });
        } else {
            // 5. Tangani Gagal Scraping
            alert("Gagal: " + (data.message || "Platform tidak didukung atau link private."));
            btn.innerText = "Try Again";
        }
    } catch (err) {
        // 6. Tangani Error Server/Jaringan
        console.error("Fetch Error:", err);
        alert("Terjadi kesalahan koneksi ke server.");
        btn.innerText = "Error";
    } finally {
        // 7. Reset Button State
        setTimeout(() => {
            btn.disabled = false;
            if (btn.innerText !== "Success!") {
                btn.innerText = "Ambil Video";
            }
        }, 3000);
        loader.style.display = 'none';
    }
}

// Fitur Tambahan: Tekan 'Enter' untuk download
document.getElementById('urlInput').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        handleDownload();
    }
});