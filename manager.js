// ============================================
// دروع الطوارئ للمانجر - ميموتش ابدا v1.0
// ============================================
process.on('uncaughtException', (err) => {
    console.log(`[المانجر] مصيبة مسكناها:`, err.message);
});

process.on('unhandledRejection', (reason) => {
    console.log(`[المانجر] وعد باظ مسكناه:`, reason);
});
// ============================================

// ============================================
// ملف manager.js - يشغل كل العملاء مرة واحدة v2.4.7
// ============================================

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const express = require('express');

const clientsDir = path.join(__dirname, 'clients');

// سيرفر HTTP عشان Koyeb ميقفلش الـ container + UptimeRobot
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('✅ Bot Manager is running - All clients active');
});

// ده اللي UptimeRobot هيضرب عليه كل 5 دقايق عشان كويب مينامش
app.get('/health', (req, res) => {
    res.send('OK');
});

app.get('/status', (req, res) => {
    res.json({
        status: 'running',
        clients: fs.readdirSync(clientsDir).filter(f => fs.statSync(path.join(clientsDir, f)).isDirectory())
    });
});

app.listen(PORT, () => {
    console.log(`🌐 HTTP Server شغال على بورت ${PORT} عشان Koyeb`);
});

// نجيب كل فولدرات العملاء أوتوماتيك
if (!fs.existsSync(clientsDir)) {
    console.error('فولدر clients مش موجود يا عمر!');
    process.exit(1);
}

const clients = fs.readdirSync(clientsDir).filter(f =>
    fs.statSync(path.join(clientsDir, f)).isDirectory()
);

if (clients.length === 0) {
    console.error('مفيش عملاء في فولدر clients');
    process.exit(1);
}

console.log(`\n🚀 لقيت ${clients.length} عميل هيشتغلو:\n${clients.join('\n')}\n`);

// ============================================
// نظام قفل الـ QR - العميل يمسح مرة واحدة بس v1.0
// ============================================
const stateFile = (client) => path.join(clientsDir, client, 'qr_state.json');

function hasQR(client) {
    if (!fs.existsSync(stateFile(client))) return false;
    try {
        const data = JSON.parse(fs.readFileSync(stateFile(client)));
        return data.qrDone === true;
    } catch { return false; }
}

function setQRDone(client) {
    fs.writeFileSync(stateFile(client), JSON.stringify({ qrDone: true, time: Date.now() }));
}
// ============================================

// ============================================
// تنظيف السيشن البايظ - عشان مفيش ايرور v1.0
// ============================================
function cleanBrokenSession(client) {
    const sessionPath = path.join(clientsDir, client, 'session');
    if (fs.existsSync(sessionPath)) {
        try {
            const files = fs.readdirSync(sessionPath);
            if (files.length === 0) {
                fs.rmSync(sessionPath, { recursive: true, force: true });
                console.log(`[${client}] مسحت session فاضي كان هيعمل ايرور`);
            }
        } catch (e) {
            console.log(`[${client}] معرفتش انضف السيشن: ${e.message}`);
        }
    }
}
// ============================================

// دالة تشغيل البوت مع ريستارت تلقائي - زودت التأخير لـ 30 ثانية عشان الرام
function runBot(clientNumber) {
    cleanBrokenSession(clientNumber);
    console.log(`[${clientNumber}] جاري التشغيل...`);

    const proc = spawn('node', ['index.js', clientNumber], {
        stdio: 'inherit',
        env: {...process.env, NODE_OPTIONS: '--max-old-space-size=140', QR_DONE: hasQR(clientNumber)? '1' : '0' } // 140MB لكل بوت عشان 3 عملا + حالة QR
    });

    proc.on('message', (msg) => {
        if (msg && msg.type === 'qr_done') {
            setQRDone(clientNumber);
            console.log(`[${clientNumber}] ✅ حفظت انه مسح QR خلاص`);
        }
    });

    proc.on('exit', (code) => {
        console.log(`[${clientNumber}] البوت وقع بكود ${code} - ريستارت بعد 30 ثانية`);
        setTimeout(() => {
            console.log(`[${clientNumber}] بعمل ريستارت...`);
            runBot(clientNumber); // ريستارت فعلي
        }, 30000);
    });
}

// نشغل كل عميل
clients.forEach(runBot);

console.log('\n✅ كل البوتات اشتغلت - افتح اللوجز عشان QR\n');
console.log('لو عايز توقف كله: Ctrl + C');

// ============================================
// الكيبر الداخلي - يصحي كويب كل 15 دقيقة v1.0
// ============================================
const http = require('http');
setInterval(() => {
    http.get(`http://localhost:${PORT}/health`, (res) => {
        console.log(`[كيبر] صحيت كويب الساعة ${new Date().toLocaleTimeString('ar-EG')}`);
    }).on('error', (err) => {
        console.log(`[كيبر] معرفتش اصحى كويب: ${err.message}`);
    });
}, 15 * 60 * 1000); // 15 دقيقة
// ============================================