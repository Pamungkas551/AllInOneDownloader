const axios = require('axios');
const cheerio = require('cheerio');

// Header global untuk menghindari deteksi bot
const globalHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*'
};

// --- PLATFORM SCRAPERS ---

const scrapers = {
    async tiktok(url) {
        const params = new URLSearchParams({ url, web: '1' });
        const { data } = await axios.post('https://www.tikwm.com/api/', params, { headers: globalHeaders });
        if (!data.data) throw new Error("TikTok content not found");
        return { title: data.data.title, url: data.data.play };
    },

    async spotify(url) {
        const rynn = await axios.get('https://spotmate.online/', { headers: globalHeaders });
        const $ = cheerio.load(rynn.data);
        const cookie = rynn.headers['set-cookie']?.join('; ');
        const token = $('meta[name="csrf-token"]').attr('content');
        
        const { data: dl } = await axios.post('https://spotmate.online/convert', { urls: url }, {
            headers: { cookie, 'x-csrf-token': token, ...globalHeaders }
        });
        return { title: "Spotify Track", url: dl.url };
    },

    async youtube(url, format) {
        const params = new URLSearchParams({ q: url, vt: 'home' });
        const search = await axios.post('https://tmate.app/api/ajaxSearch', params, { headers: globalHeaders });
        const { vid, links, title } = search.data;
        
        const k = (format === 'mp3') 
            ? links.mp3.mp3128.k 
            : links.mp4[Object.keys(links.mp4)[0]].k;

        const convertParams = new URLSearchParams({
            type: 'youtube', _id: vid, v_id: vid, ajax: '1', 
            ftype: format, fquality: format === 'mp3' ? '128' : '720', key: k
        });

        const convert = await axios.post('https://tmate.app/api/ajaxSearch/convert', convertParams, { headers: globalHeaders });
        const $ = cheerio.load(convert.data.result);
        return { title, url: $('a').attr('href') };
    },

    async universal(url) {
        const params = new URLSearchParams({ url });
        const { data } = await axios.post('https://worker.sf-helper.com/savefrom.php', params, { headers: globalHeaders });
        if (!data?.url?.[0]?.url) throw new Error("Could not extract download link");
        return { title: data.meta?.title || "Media Download", url: data.url[0].url };
    }
};

// --- MAIN HANDLER (Serverless Function) ---

module.exports = async (req, res) => {
    // CORS Modern
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    const { url, format = 'mp4' } = req.query;

    if (!url) {
        return res.status(400).json({ success: false, message: "URL is required" });
    }

    try {
        // Node 24 WHATWG URL Parsing
        const targetUrl = new URL(url);
        const host = targetUrl.hostname.replace('www.', '');

        let result;

        if (host.includes('tiktok.com')) {
            result = await scrapers.tiktok(url);
        } else if (host.includes('googleusercontent.com') || host.includes('spotify.com')) {
            result = await scrapers.spotify(url);
        } else if (host.includes('youtube.com') || host.includes('youtu.be')) {
            result = await scrapers.youtube(url, format);
        } else {
            // Jalur untuk FB, IG, X, Pinterest, dll.
            result = await scrapers.universal(url);
        }

        res.status(200).json({
            success: true,
            title: result.title,
            download_url: result.url
        });

    } catch (error) {
        console.error(`[Error ${new Date().toISOString()}]:`, error.message);
        res.status(500).json({ 
            success: false, 
            message: "Scraper failed or platform not supported.",
            details: error.message 
        });
    }
};
