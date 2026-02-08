const axios = require('axios');
const cheerio = require('cheerio');

// Konfigurasi Header agar menyerupai browser asli
const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Origin': 'https://google.com',
    'Referer': 'https://google.com'
};

/**
 * 1. TIKTOK SCRAPER (TikWm)
 */
async function tiktokScraper(url) {
    const { data } = await axios.post('https://www.tikwm.com/api/', new URLSearchParams({ url, web: 1 }), { headers });
    if (!data.data) throw new Error("TikTok data not found");
    return { title: data.data.title, url: data.data.play };
}

/**
 * 2. SPOTIFY SCRAPER (Spotmate)
 */
async function spotifyScraper(url) {
    const rynn = await axios.get('https://spotmate.online/', { headers });
    const $ = cheerio.load(rynn.data);
    const cookie = rynn.headers['set-cookie']?.join('; ');
    const token = $('meta[name="csrf-token"]').attr('content');

    const { data: dl } = await axios.post('https://spotmate.online/convert', { urls: url }, {
        headers: { 
            cookie, 
            'x-csrf-token': token,
            ...headers
        }
    });
    return { title: "Spotify Track", url: dl.url };
}

/**
 * 3. YOUTUBE SCRAPER (Tmate/Y2Mate Logic)
 */
async function youtubeScraper(url, format) {
    const search = await axios.post('https://tmate.app/api/ajaxSearch', new URLSearchParams({ q: url, vt: 'home' }), { headers });
    const vidId = search.data.vid;
    
    let k = "";
    if (format === 'mp3') {
        k = search.data.links.mp3.mp3128.k;
    } else {
        const mp4Links = search.data.links.mp4;
        const q = mp4Links['720'] ? '720' : Object.keys(mp4Links)[0];
        k = mp4Links[q].k;
    }

    const convert = await axios.post('https://tmate.app/api/ajaxSearch/convert', new URLSearchParams({
        type: 'youtube', _id: vidId, v_id: vidId, ajax: '1', ftype: format, fquality: format === 'mp3' ? '128' : '720', key: k
    }), { headers });

    const dl_url = cheerio.load(convert.data.result)('a').attr('href');
    return { title: search.data.title, url: dl_url };
}

/**
 * 4. UNIVERSAL SCRAPER (FB, IG, X, Threads, Pinterest, CapCut)
 * Menggunakan Jalur API Loovids/Savefrom
 */
async function universalScraper(url) {
    const { data } = await axios.post('https://worker.sf-helper.com/savefrom.php', new URLSearchParams({ url }), { headers });
    if (!data || !data.url || data.url.length === 0) {
        // Fallback ke Loovids jika Savefrom gagal
        const loovids = await axios.post('https://loovids.com/api/ajaxSearch', new URLSearchParams({ q: url }), { headers });
        const $ = cheerio.load(loovids.data.data);
        const link = $('a.btn-download').attr('href');
        if (!link) throw new Error("Media link not found");
        return { title: "Social Media Media", url: link };
    }
    return { title: data.meta?.title || "Downloaded Media", url: data.url[0].url };
}

/**
 * MAIN ROUTER HANDLER
 */
module.exports = async (req, res) => {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    
    const { url, format = 'mp4' } = req.query;

    if (!url) return res.status(400).json({ success: false, message: "URL is required" });

    try {
        let result;
        const lowUrl = url.toLowerCase();

        // Router Logika berdasarkan Hostname
        if (lowUrl.includes('tiktok.com')) {
            result = await tiktokScraper(url);
        } 
        else if (lowUrl.includes('googleusercontent.com/spotify.com') || lowUrl.includes('spotify.com')) {
            result = await spotifyScraper(url);
        } 
        else if (lowUrl.includes('youtube.com') || lowUrl.includes('youtu.be')) {
            result = await youtubeScraper(url, format);
        } 
        else {
            // Menangani FB, IG, X, Pinterest, SnackVideo, CapCut secara otomatis
            result = await universalScraper(url);
        }

        if (!result.url) throw new Error("Scraper returned empty URL");

        res.status(200).json({
            success: true,
            title: result.title,
            download_url: result.url
        });

    } catch (e) {
        console.error("Scraper Error:", e.message);
        res.status(500).json({ 
            success: false, 
            message: "Gagal mengambil video. Link mungkin private atau tidak didukung.",
            error: e.message 
        });
    }
};
