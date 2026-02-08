const axios = require('axios');
const cheerio = require('cheerio');

// --- 1. TIKTOK (TikWm) ---
async function tiktokScraper(url) {
    const { data } = await axios.post('https://www.tikwm.com/api/', new URLSearchParams({ url, web: 1 }));
    return { title: data.data.title, url: data.data.play };
}

// --- 2. SPOTIFY (Spotmate) ---
async function spotifyScraper(url) {
    const rynn = await axios.get('https://spotmate.online/', { headers: { 'user-agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(rynn.data);
    const { data: dl } = await axios.post('https://spotmate.online/convert', { urls: url }, {
        headers: { cookie: rynn.headers['set-cookie']?.join('; '), 'x-csrf-token': $('meta[name="csrf-token"]').attr('content'), 'user-agent': 'Mozilla/5.0' }
    });
    return { title: "Spotify Music", url: dl.url };
}

// --- 3. INSTAGRAM (FastDl) ---
async function instagramScraper(url) {
    const { data } = await axios.post('https://fastdl.app/api/convert', { url, lang: 'en' });
    const $ = cheerio.load(data.data);
    const dl_link = $('a.download-button').first().attr('href');
    return { title: "Instagram Content", url: dl_link };
}

// --- 4. THREADS (ThreadsPhotoDownloader) ---
async function threadsScraper(url) {
    const { data } = await axios.post('https://threadalphotodownloader.com/api/v1/threads', { url });
    // Biasanya return array media
    const dl_link = data.media[0].url;
    return { title: "Threads Media", url: dl_link };
}

// --- 5. SOUNDCLOUD (ForHub) ---
async function soundcloudScraper(url) {
    const { data } = await axios.post('https://forhub.io/soundcloud/action.php', new URLSearchParams({ url }));
    const $ = cheerio.load(data);
    const dl_link = $('td a.btn-default').attr('href');
    return { title: "SoundCloud Audio", url: dl_link };
}

// --- 6. DAILYMOTION (SaveFrom Logic) ---
async function dailymotionScraper(url) {
    const { data } = await axios.post('https://worker.sf-helper.com/savefrom.php', new URLSearchParams({ url }));
    const dl_link = data.url[0].url;
    return { title: data.meta.title || "Dailymotion Video", url: dl_link };
}

// --- 7. FACEBOOK (FDownloader) ---
async function fbScraper(url) {
    const { data } = await axios.post('https://fdownloader.net/api/ajaxSearch', new URLSearchParams({ q: url }));
    const $ = cheerio.load(data.data);
    const dl_link = $('a.btn-download').first().attr('href');
    return { title: "Facebook Video", url: dl_link };
}

// --- 8. YOUTUBE (Y2Mate) ---
async function youtubeScraper(url, format) {
    const analyze = await axios.post('https://www.y2mate.com/api/ajaxSearch/index', new URLSearchParams({ q: url, vt: 'home' }));
    const vidId = analyze.data.vid;
    const k = (format === 'mp3') ? analyze.data.links.mp3.mp3128.k : analyze.data.links.mp4[Object.keys(analyze.data.links.mp4)[0]].k;
    const { data: dl } = await axios.post('https://www.y2mate.com/api/ajaxSearch/convert', new URLSearchParams({ type: 'youtube', _id: vidId, v_id: vidId, ftype: format, fquality: '128', key: k }));
    const dl_url = cheerio.load(dl.result)('a').attr('href');
    return { title: analyze.data.title, url: dl_url };
}

// --- 9. X/TWITTER, SNACK, PIN, CAPCUT (Short Hand) ---
// (Fungsi-fungsi ini sama seperti sebelumnya, gue gabungin di Router biar ringkas)

// --- MAIN ROUTER ---
module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const { url, format = 'mp4' } = req.query;
    if (!url) return res.status(400).json({ success: false });

    try {
        let result;
        const host = new URL(url).hostname.replace('www.', '');

        if (host.includes('tiktok.com')) result = await tiktokScraper(url);
        else if (url.includes('googleusercontent.com/spotify.com/0')) result = await spotifyScraper(url);
        else if (host.includes('instagram.com')) result = await instagramScraper(url);
        else if (host.includes('threads.net')) result = await threadsScraper(url);
        else if (host.includes('soundcloud.com')) result = await soundcloudScraper(url);
        else if (host.includes('dailymotion.com')) result = await dailymotionScraper(url);
        else if (host.includes('facebook.com') || host.includes('fb.watch')) result = await fbScraper(url);
        else if (host.includes('youtube.com') || host.includes('youtu.be')) result = await youtubeScraper(url, format);
        else if (host.includes('twitter.com') || host.includes('x.com')) {
            const { data } = await axios.post('https://twdown.net/download.php', new URLSearchParams({ URL: url }));
            result = { title: "X Video", url: cheerio.load(data)('a[download]').first().attr('href') };
        }
        else if (host.includes('snackvideo.com') || host.includes('sck.io')) {
            const { data } = await axios.post('https://getvideo.paps.info/api/snackvideo', { url });
            result = { title: data.title, url: data.url };
        }
        else if (host.includes('pinterest.com') || host.includes('pin.it')) {
            const { data } = await axios.get(`https://pinterestvideodownloader.com/?url=${url}`);
            const $ = cheerio.load(data);
            result = { title: "Pinterest", url: $('video source').attr('src') || $('a[download]').attr('href') };
        }
        else if (host.includes('capcut.com')) {
            const { data } = await axios.post('https://backend.clonemyclip.com/api/capcut', { url });
            result = { title: "CapCut", url: data.videoUrl };
        }
        else return res.status(400).json({ success: false, message: "Platform belum didukung" });

        if (!result.url) throw new Error("Gagal mengambil link download");
        res.status(200).json({ success: true, title: result.title, download_url: result.url });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};