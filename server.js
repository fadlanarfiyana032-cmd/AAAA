const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Konfigurasi Supabase (Diambil dari Environment Variables Railway)
const SUPABASE_URL = process.env.SUPABASE_URL || "https://hbvoyhobltznbosntoiu.supabase.co/functions/v1/check-domains";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhidm95aG9ibHR6bmJvc250b2l1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NTU3ODAsImV4cCI6MjA5MTEzMTc4MH0.vjHdvvaG-O2-l4ItfHBJziRgr8IM3r0VMzXFipZzYNE";

// Middleware
app.use(cors()); // Penting: Mengizinkan browser mengakses API ini
app.use(express.json());

// Health Check (Opsional, untuk cek apakah server hidup)
app.get('/', (req, res) => {
    res.json({ status: 'OK', message: 'Nawala Checker API is running!' });
});

// Endpoint Utama: POST /api/check
app.post('/api/check', async (req, res) => {
    try {
        const { domains } = req.body;

        // Validasi Input
        if (!domains || !Array.isArray(domains) || domains.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Payload harus berupa JSON dengan key "domains" berisi array string. Contoh: { "domains": ["google.com"] }' 
            });
        }

        console.log(`Received request for ${domains.length} domains.`);

        const results = [];
        
        // Proses domain satu per satu atau batch kecil untuk menghindari rate limit
        // Kita gunakan Promise.all untuk paralel processing tapi dengan batasan
        const BATCH_SIZE = 3; // Cek 3 domain sekaligus
        
        for (let i = 0; i < domains.length; i += BATCH_SIZE) {
            const batch = domains.slice(i, i + BATCH_SIZE);
            
            const promises = batch.map(async (domainName) => {
                try {
                    // Bersihkan domain dari http/https/www jika ada
                    let cleanDomain = domainName.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];

                    // Panggil Supabase Edge Function
                    const response = await axios.post(
                        SUPABASE_URL,
                        { name: cleanDomain }, // Format payload yang benar: { name: "..." }
                        {
                            headers: {
                                'apikey': SUPABASE_KEY,
                                'Authorization': `Bearer ${SUPABASE_KEY}`,
                                'Content-Type': 'application/json'
                            },
                            timeout: 5000 // Timeout 5 detik per request
                        }
                    );
                    
                    if (response.data && response.data.success && response.data.data && response.data.data.length > 0) {
                        return response.data.data[0];
                    } else {
                        return { 
                            domain: cleanDomain, 
                            nawala: { blocked: false }, 
                            network: { blocked: false },
                            note: 'Empty response from upstream' 
                        };
                    }
                } catch (error) {
                    console.error(`Error checking ${cleanDomain}:`, error.message);
                    return { 
                        domain: cleanDomain, 
                        nawala: { blocked: false }, 
                        network: { blocked: false },
                        error: 'Upstream API Error' 
                    };
                }
            });

            const batchResults = await Promise.all(promises);
            results.push(...batchResults);

            // Delay sedikit antar batch agar tidak dianggap spam oleh Supabase
            if (i + BATCH_SIZE < domains.length) {
                await new Promise(r => setTimeout(r, 200));
            }
        }

        // Kirim Response Sukses
        res.json({
            success: true,
            count: results.length,
            data: results
        });

    } catch (error) {
        console.error('Server Critical Error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal Server Error', 
            details: error.message 
        });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🔗 Local URL: http://localhost:${PORT}`);
});
