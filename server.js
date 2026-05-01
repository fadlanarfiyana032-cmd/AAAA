const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Konfigurasi Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || "https://hbvoyhobltznbosntoiu.supabase.co/functions/v1/check-domains";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhidm95aG9ibHR6bmJvc250b2l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NTU3ODAsImV4cCI6MjA5MTEzMTc4MH0.vjHdvvaG-O2-l4ItfHBJziRgr8IM3r0VMzXFipZzYNE";

app.use(cors());
app.use(express.json());

// Fungsi Helper untuk Cek Domain
async function checkDomainStatus(domainName) {
    // Bersihkan domain di luar try-catch agar bisa diakses saat error
    let cleanDomain = domainName.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
    
    try {
        const response = await axios.post(
            SUPABASE_URL,
            { name: cleanDomain },
            {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            }
        );
        
        if (response.data && response.data.success && response.data.data && response.data.data.length > 0) {
            return response.data.data[0];
        } else {
            return { 
                domain: cleanDomain, 
                nawala: { blocked: false }, 
                network: { blocked: false },
                status: 'unknown' 
            };
        }
    } catch (error) {
        return { 
            domain: cleanDomain, 
            nawala: { blocked: false }, 
            network: { blocked: false },
            error: 'Failed to fetch data from upstream' 
        };
    }
}

// Helper untuk render HTML Table jika dibuka di Browser
function renderHtmlTable(domains, results) {
    let html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Hasil Cek Domain</title>
        <style>
            body { font-family: sans-serif; padding: 20px; background: #f0f2f5; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
            h1 { color: #333; text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { padding: 12px; border-bottom: 1px solid #ddd; text-align: left; }
            th { background-color: #4a5568; color: white; }
            .safe { color: green; font-weight: bold; }
            .blocked { color: red; font-weight: bold; }
            .json-link { display: block; text-align: right; margin-bottom: 10px; color: #667eea; text-decoration: none; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🔍 Hasil Pengecekan Domain</h1>
            <a href="?format=json" class="json-link">Lihat sebagai JSON API</a>
            <table>
                <thead>
                    <tr>
                        <th>Domain</th>
                        <th>Nawala</th>
                        <th>Network</th>
                    </tr>
                </thead>
                <tbody>
    `;

    results.forEach(item => {
        const nawalaStatus = item.nawala?.blocked ? '<span class="blocked">DIBLOKIR</span>' : '<span class="safe">Aman</span>';
        const networkStatus = item.network?.blocked ? '<span class="blocked">DIBLOKIR</span>' : '<span class="safe">Aman</span>';
        
        html += `
            <tr>
                <td>${item.domain}</td>
                <td>${nawalaStatus}</td>
                <td>${networkStatus}</td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
    </body>
    </html>
    `;
    return html;
}

// ENDPOINT GET (Bisa dibuka di Browser)
app.get('/api/check', async (req, res) => {
    let domains = req.query.domain;
    const format = req.query.format; // Cek apakah user minta JSON atau HTML

    if (!domains) {
        return res.json({
            message: "Cara Penggunaan:",
            example: "GET /api/check?domain=google.com&domain=fb.com",
            note: "Tambahkan &domain=namadomain.com untuk mengecek lebih banyak domain."
        });
    }

    if (!Array.isArray(domains)) {
        domains = [domains];
    }

    try {
        const results = [];
        for (const d of domains) {
            const result = await checkDomainStatus(d);
            results.push(result);
            await new Promise(r => setTimeout(r, 100));
        }

        // Jika user buka di browser dan tidak minta format=json, tampilkan HTML
        const isBrowser = req.headers['user-agent'] && req.headers['user-agent'].includes('Mozilla');
        
        if (isBrowser && format !== 'json') {
            res.setHeader('Content-Type', 'text/html');
            return res.send(renderHtmlTable(domains, results));
        }

        // Default return JSON untuk API
        res.json({
            success: true,
            count: results.length,
            queried_domains: domains,
            results: results
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ENDPOINT POST (Untuk Aplikasi/Code)
app.post('/api/check', async (req, res) => {
    const { domains } = req.body;

    if (!domains || !Array.isArray(domains)) {
        return res.status(400).json({ error: 'Kirim JSON: { "domains": ["contoh.com"] }' });
    }

    try {
        const results = [];
        for (const d of domains) {
            const result = await checkDomainStatus(d);
            results.push(result);
            await new Promise(r => setTimeout(r, 100));
        }

        res.json({
            success: true,
            count: results.length,
            results: results
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server ready at port ${PORT}`);
});
