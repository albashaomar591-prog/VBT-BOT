// ============================================
// دروع الطوارئ - البوت ميموتش ابدا v1.0
// ============================================
process.on('uncaughtException', (err) => {
    console.log(`[${رقم_البوت || 'البوت'}] مصيبة مسكناها:`, err.message);
});

process.on('unhandledRejection', (reason) => {
    console.log(`[${رقم_البوت || 'البوت'}] وعد باظ مسكناه:`, reason);
});
// ============================================

// ============================================
// ملف index.js - سينجل كلاينت v2.4.6 مالتي كلاينت بدون هبد
// ============================================

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');

// بناخد رقم البوت من باراميتر التشغيل: node index.js 20123456789
const رقم_البوت = process.argv[2];
if (!رقم_البوت) {
    console.error('لازم تكتب رقم البوت: node index.js 20123456789');
    process.exit(1);
}

const فولدر_العميل = path.join(__dirname, 'clients', رقم_البوت);

// حمل rules.js - كود واحد مركزي
const rules = require('./rules.js');

// حمل كونفج وليستس بتوع العميل ده بس
const config = require(path.join(فولدر_العميل, 'config.js'));
const lists = require(path.join(فولدر_العميل, 'lists.js'));

// تحميل ذاكرة اليوم من الملف مرة واحدة عند التشغيل
let ذاكرة_اليوم = rules.تحميل_اليومي(فولدر_العميل);

console.log(`جاري تشغيل بوت: ${رقم_البوت} | الشركة: ${config.الشركة}`);

// تشغيل العميل - قللت الرام + أضفت single-process
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: رقم_البوت,
        dataPath: فولدر_العميل + '/session' // السيشن جوه فولدر العميل
    }),
    puppeteer: {
        headless: "new",
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined, // <-- السطر الوحيد اللي زودته
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--single-process' // توفير رام لكويب
        ]
    }
});

// ============================================
// قفل الـ QR - العميل يمسح مرة واحدة بس v1.0
// ============================================
if (process.env.QR_DONE === '1') {
    console.log(`[${رقم_البوت}] [QR] العميل دا مسح الكود قبل كدا، مستني السيشن يرجع...`);
} else {
    // QR Code
    client.on('qr', qr => {
        console.log(`QR لعميل ${رقم_البوت}:`);
        qrcode.generate(qr, {small: true});
        console.log('اسكان QR عشان البوت يشتغل يا فندم');

        // اول ما QR يظهر نقول للمانجر احفظ الحالة
        process.send && process.send({ type: 'qr_done' });
    });
}
// ============================================

// البوت جاهز - فحص الباقة أول ما يشتغل
client.on('ready', async () => {
    console.log(`✅ البوت اشتغل بنجاح يا فندم`);
    console.log(`رقم البوت ${رقم_البوت}: ${client.info.wid.user}`);

    // فحص الباقة عند التشغيل
    const الباقة_شغالة = await rules.تحقق_الباقة(client, config, رقم_البوت, '');
    if (!الباقة_شغالة) {
        console.log(`⚠️ تحذير: باقة العميل ${config.الشركة} منتهية. البوت واقف`);
    }
});

// ===== Auto-Reconnect v1.0 - زودت التأخير 30 ثانية =====
client.on('disconnected', (reason) => {
    console.log(`[${رقم_البوت}] البوت فصل: ${reason}`);
    console.log(`[${رقم_البوت}] بعمل ريستارت تلقائي بعد 30 ثانية...`);

    setTimeout(() => {
        client.initialize();
    }, 30000); // 30 ثانية ويرجع
});

client.on('auth_failure', msg => {
    console.log(`[${رقم_البوت}] فشل المصادقة: ${msg}`);
    console.log(`[${رقم_البوت}] امسح فولدر session وامسح QR من جديد`);
});
// ===== نهاية الريكونكت =====

// الرسايل الواردة
client.on('message', async msg => {
    try {
        // تحديث اليومي من الملف كل رسالة عشان لو فيه فواتير جديدة
        ذاكرة_اليوم = rules.تحميل_اليومي(فولدر_العميل);

        // ننادي دالة واحدة بس وهي اللي هتشغل كل قواعدك
        await rules.معالجة_الرسالة(msg, config, lists, client, فولدر_العميل, ذاكرة_اليوم);

    } catch (error) {
        console.error(`[${رقم_البوت}] إيرور:`, error.message);
        await msg.reply('معلش يا فندم في مشكلة تقنية، المشرف هيتابع مع حضرتك');
    }
});

// فلاج عشان التقرير ميتبعتش مرتين
let تم_إرسال_التقرير_اليوم = false;

// التقرير اليومي الساعة 11:59 م - كل 5 دقايق بدل دقيقة عشان الرام
setInterval(async () => {
    const now = new Date();

    if (now.getHours() === 23 && now.getMinutes() === 59 &&!تم_إرسال_التقرير_اليوم) {
        تم_إرسال_التقرير_اليوم = true;
        try {
            // نحدث الذاكرة قبل التقرير
            ذاكرة_اليوم = rules.تحميل_اليومي(فولدر_العميل);
            await rules.التقرير_اليومي_للمدير(client, ذاكرة_اليوم, config);
            rules.إعادة_الضبط(ذاكرة_اليوم, فولدر_العميل);
            console.log(`[${رقم_البوت}] التقرير اتبعت واتعمل Reset`);
        } catch(e) {
            console.log(`[${رقم_البوت}] التقرير اليومي:`, e.message);
        }
    }

    // تصفير الفلاج الساعة 12 بالليل عشان تاني يوم
    if (now.getHours() === 0 && now.getMinutes() === 0) {
        تم_إرسال_التقرير_اليوم = false;
    }
}, 300000); // كل 5 دقايق بدل دقيقة

// تشغيل البوت
client.initialize();
console.log(`جاري تشغيل البوت ${رقم_البوت}...`);