const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Konfigurasi Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || "https://hbvoyhobltznbosntoiu.supabase.co/functions/v1/check-domains";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhidm95aG9ibHR6bmJvc250b2l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NTU3ODAsImV4cCI6MjA5MTEzMTc4MH0.vjHdvvaG-O2-l4ItfHBJziRgr8IM3r0VMzXFipZzYNE";

app.use(cors()); // Agar bisa diakses dari mana saja
app.use(express.json());

// Fungsi Helper untuk Cek Domain
async function checkDomainStatus(domainName) {
    try {
        // Bersihkan domain
        let cleanDomain = domainName.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
        
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
            error: 'Failed to fetch data' 
        };
    }
}

// 1. ENDPOINT GET (Bisa dibuka langsung di Browser)
// Cara pakai: https://api-kamu.railway.app/api/check?domain=google.com&domain=fb.com
app.get('/api/check', async (req, res) => {
    let domains = req.query.domain;

    // Jika tidak ada parameter domain, tampilkan panduan
    if (!domains) {
        return res.json({
            message: "Cara Penggunaan:",
            example: "GET /api/check?domain=google.com&domain=facebook.com",
            note: "Tambahkan &domain=namadomain.com untuk mengecek lebih banyak domain."
        });
    }

    // Ubah menjadi array jika user hanya kirim 1 domain
    if (!Array.isArray(domains)) {
        domains = [domains];
    }

    try {
        const results = [];
        // Proses semua domain yang dikirim via URL
        for (const d of domains) {
            const result = await checkDomainStatus(d);
            results.push(result);
            // Delay sedikit biar tidak kena rate limit
            await new Promise(r => setTimeout(r, 100));
        }

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

// 2. ENDPOINT POST (Untuk Aplikasi/HTML Form)
// Body: { "domains": ["google.com", "fb.com"] }
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
