const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL || "https://hbvoyhobltznbosntoiu.supabase.co/functions/v1/check-domains";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhidm95aG9ibHR6bmJvc250b2l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NTU3ODAsImV4cCI6MjA5MTEzMTc4MH0.vjHdvvaG-O2-l4ItfHBJziRgr8IM3r0VMzXFipZzYNE";

app.use(cors());
app.use(express.json());

async function checkDomainStatus(domainName) {
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
        
        // Ambil data pertama dari array response
        const item = response.data?.data?.[0];
        
        if (!item) {
            return {
                domain: cleanDomain,
                status: "ERROR",
                message: "API Supabase mengembalikan data kosong",
                raw_response: response.data
            };
        }

        return {
            domain: cleanDomain,
            nawala_blocked: item.nawala?.blocked ?? null, // Null jika tidak ada data
            network_blocked: item.network?.blocked ?? null,
            status: (item.nawala?.blocked || item.network?.blocked) ? "DIBLOKIR" : "AMAN",
            raw_data: item // Penting: Lihat data aslinya
        };

    } catch (error) {
        return { 
            domain: cleanDomain, 
            status: "ERROR",
            message: "Gagal menghubungi API Supabase",
            error_detail: error.message
        };
    }
}

// Helper HTML Table yang Lebih Jelas
function renderHtmlTable(domains, results) {
    let html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Status Domain Nawala</title>
        <style>
            body { font-family: 'Segoe UI', sans-serif; padding: 20px; background: #f4f4f9; }
            .container { max-width: 900px; margin: 0 auto; background: white; padding: 25px; border-radius: 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
            h1 { color: #2d3748; text-align: center; margin-bottom: 30px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { padding: 15px; border-bottom: 1px solid #eee; text-align: left; vertical-align: top; }
            th { background-color: #4a5568; color: white; font-weight: 600; }
            tr:hover { background-color: #f7fafc; }
            
            .status-aman { color: #38a169; font-weight: bold; background: #f0fff4; padding: 5px 10px; border-radius: 20px; display: inline-block; }
            .status-blokir { color: #e53e3e; font-weight: bold; background: #fff5f5; padding: 5px 10px; border-radius: 20px; display: inline-block; }
            .status-error { color: #d69e2e; font-weight: bold; background: #fffff0; padding: 5px 10px; border-radius: 20px; display: inline-block; }
            
            .debug-info { font-size: 11px; color: #718096; margin-top: 5px; font-family: monospace; }
            .json-link { float: right; color: #667eea; text-decoration: none; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="container">
            <a href="?format=json" class="json-link">Lihat JSON API</a>
            <h1>🛡️ Cek Status Internet Positif (Nawala)</h1>
            <table>
                <thead>
                    <tr>
                        <th width="30%">Domain</th>
                        <th width="20%">Status Akhir</th>
                        <th width="50%">Detail Teknis (Raw Data)</th>
                    </tr>
                </thead>
                <tbody>
    `;

    results.forEach(item => {
        let statusBadge = '';
        if (item.status === 'DIBLOKIR') statusBadge = '<span class="status-blokir">🔴 DIBLOKIR</span>';
        else if (item.status === 'AMAN') statusBadge = '<span class="status-aman">🟢 AMAN</span>';
        else statusBadge = '<span class="status-error">⚠️ ERROR/GAGAL CEK</span>';

        // Tampilkan detail teknis
        let debugText = JSON.stringify(item.raw_data || item.error_detail || {}, null, 2);

        html += `
            <tr>
                <td style="font-weight:bold; font-size:16px;">${item.domain}</td>
                <td>${statusBadge}</td>
                <td>
                    <div class="debug-info">${debugText}</div>
                </td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
            <p style="margin-top:20px; color:#666; font-size:14px;">
                *Data diambil dari Edge Function Supabase Nawala. Jika status "Error", kemungkinan API sedang down atau rate-limited.
            </p>
        </div>
    </body>
    </html>
    `;
    return html;
}

app.get('/api/check', async (req, res) => {
    let domains = req.query.domain;
    const format = req.query.format;

    if (!domains) {
        return res.json({ help: "Gunakan: /api/check?domain=google.com&domain=fb.com" });
    }

    if (!Array.isArray(domains)) domains = [domains];

    const results = [];
    for (const d of domains) {
        const result = await checkDomainStatus(d);
        results.push(result);
        await new Promise(r => setTimeout(r, 100));
    }

    const isBrowser = req.headers['user-agent'] && req.headers['user-agent'].includes('Mozilla');
    
    if (isBrowser && format !== 'json') {
        res.setHeader('Content-Type', 'text/html');
        return res.send(renderHtmlTable(domains, results));
    }

    res.json({ success: true, count: results.length, results });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
