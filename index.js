const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const BOT_TOKEN = process.env.BOT_TOKEN;
const API_SECRET = process.env.API_SECRET || 'change_this_secret_key';
const CHANNEL_USERNAME = '@tonbattleofc';
const CHANNEL_LINK = 'https://t.me/tonbattleofc';
const PORT = process.env.PORT || 10000;
const MAX_BODY_SIZE = 1024 * 1024;

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PROMO_HISTORY_FILE = path.join(DATA_DIR, 'promo_history.json');

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Secret');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    if (req.url === '/promos' && req.method === 'GET') {
        const apiSecret = req.headers['x-api-secret'];
        console.log('[DEBUG] Received API_SECRET:', apiSecret);
        console.log('[DEBUG] Expected API_SECRET:', API_SECRET);
        console.log('[DEBUG] Match:', apiSecret === API_SECRET);
        
        if (apiSecret !== API_SECRET) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Forbidden' }));
            return;
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(promoQueue));
    } else if (req.url === '/clear-promos' && req.method === 'POST') {
        const apiSecret = req.headers['x-api-secret'];
        if (apiSecret !== API_SECRET) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Forbidden' }));
            return;
        }
        
        let body = '';
        let bodySize = 0;
        
        req.on('data', chunk => {
            bodySize += chunk.length;
            if (bodySize > MAX_BODY_SIZE) {
                res.writeHead(413, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Payload too large' }));
                req.connection.destroy();
                return;
            }
            body += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const codes = data.codes || [];
                
                if (!Array.isArray(codes)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid data format' }));
                    return;
                }
                
                codes.forEach(code => {
                    if (typeof code === 'string') {
                        const index = promoQueue.findIndex(p => p.Code === code);
                        if (index !== -1) {
                            promoQueue.splice(index, 1);
                        }
                    }
                });
                
                console.log(`[PromoQueue] Cleared ${codes.length} promos. Remaining: ${promoQueue.length}`);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, cleared: codes.length, remaining: promoQueue.length }));
            } catch (error) {
                console.error('[PromoQueue] Error clearing promos:', error.message);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
    } else if (req.url === '/botdrops' && req.method === 'GET') {
        const BOT_DROPS_FILE = path.join(DATA_DIR, 'bot_drops.json');
        
        if (fs.existsSync(BOT_DROPS_FILE)) {
            const data = fs.readFileSync(BOT_DROPS_FILE, 'utf8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(data);
        } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end('[]');
        }
    } else if (req.url === '/update-botdrops' && req.method === 'POST') {
        const apiSecret = req.headers['x-api-secret'];
        if (apiSecret !== API_SECRET) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Forbidden' }));
            return;
        }
        
        let body = '';
        let bodySize = 0;
        
        req.on('data', chunk => {
            bodySize += chunk.length;
            if (bodySize > MAX_BODY_SIZE) {
                res.writeHead(413, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Payload too large' }));
                req.connection.destroy();
                return;
            }
            body += chunk.toString();
        });
        
        req.on('end', () => {
            try {
                const drops = JSON.parse(body);
                
                if (!Array.isArray(drops)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid data format' }));
                    return;
                }
                
                const BOT_DROPS_FILE = path.join(DATA_DIR, 'bot_drops.json');
                
                fs.writeFileSync(BOT_DROPS_FILE, JSON.stringify(drops, null, 2));
                
                cachedDrops = drops;
                lastDropsUpdate = Date.now();
                
                console.log(`Обновлено ${drops.length} BotDrop предметов из Roblox`);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, count: drops.length }));
            } catch (error) {
                console.error('Ошибка обновления BotDrops:', error.message);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
    } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('TON BATTLE Bot is running!');
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`HTTP сервер запущен на порту ${PORT}`);
});

bot.setMyCommands([
    { command: 'start', description: '🚀 Запустить бота' },
    { command: 'promo', description: '🎁 Получить промокод' },
    { command: 'stop', description: '❌ Отписаться от рассылки' }
]);

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

function loadUsers() {
    if (fs.existsSync(USERS_FILE)) {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        return JSON.parse(data);
    }
    return [];
}

function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function loadPromoHistory() {
    if (fs.existsSync(PROMO_HISTORY_FILE)) {
        const data = fs.readFileSync(PROMO_HISTORY_FILE, 'utf8');
        return JSON.parse(data);
    }
    return {};
}

function savePromoHistory(history) {
    fs.writeFileSync(PROMO_HISTORY_FILE, JSON.stringify(history, null, 2));
}

function canGetPromo(userId) {
    const history = loadPromoHistory();
    const userHistory = history[userId];
    
    if (!userHistory) return { canGet: true, timeLeft: 0 };
    
    const lastTime = new Date(userHistory.lastTime);
    const now = new Date();
    const timeDiff = now - lastTime;
    const timeLeft = (24 * 60 * 60 * 1000) - timeDiff;
    
    if (timeDiff >= 24 * 60 * 60 * 1000) {
        return { canGet: true, timeLeft: 0 };
    }
    
    const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    
    return { 
        canGet: false, 
        hoursLeft: hoursLeft,
        minutesLeft: minutesLeft,
        lastPromo: userHistory.promo,
        lastReward: userHistory.reward,
        attempts: userHistory.attempts || 0
    };
}

function savePromoForUser(userId, promo, reward) {
    const history = loadPromoHistory();
    const existing = history[userId];
    
    history[userId] = {
        promo: promo,
        reward: reward,
        lastTime: new Date().toISOString(),
        attempts: existing ? (existing.attempts || 0) : 0,
        totalPromos: existing ? (existing.totalPromos || 0) + 1 : 1
    };
    savePromoHistory(history);
}

function recordAttempt(userId) {
    const history = loadPromoHistory();
    if (!history[userId]) {
        history[userId] = { attempts: 1, lastTime: new Date().toISOString() };
    } else {
        history[userId].attempts = (history[userId].attempts || 0) + 1;
    }
    savePromoHistory(history);
}

function isSpamming(userId) {
    const history = loadPromoHistory();
    const userHistory = history[userId];
    
    if (!userHistory || !userHistory.attempts) return false;
    
    const lastTime = new Date(userHistory.lastTime);
    const now = new Date();
    const timeDiff = now - lastTime;
    
    if (timeDiff < 60 * 1000 && userHistory.attempts > 5) {
        return true;
    }
    
    if (timeDiff >= 60 * 1000) {
        history[userId].attempts = 0;
        savePromoHistory(history);
    }
    
    return false;
}

function generatePromoCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'TON';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

let cachedDrops = [
    'Gift', 'Rose', 'Rocket', 'Flowers', 'Diamond', 'Ring', 'Lol Pop', 'Snoop Dogg',
    'Jester Hat', 'Snake Box', 'Xmax Stocking', 'Gigner Cookie', 'Pet Snake', 'Hex Pox',
    'Sakura Flower', 'Hanging Star', 'Eternal Rose', 'Kissed Frog', 'Perfume Bottle',
    'Hypno Lollipop', 'Star Notepad', 'Light Sword', 'Jolly Chimp', 'Valentine Box',
    'Trapped Heart', 'Voodoo Doll', 'Scared Cat', 'Loot Bag', 'Mini Oscar', 'Gem Signet',
    'Heroic Helmet', 'Artisan Brick', 'Bow Tie (Velvet Gold)', 'Swicc Watch (Day Trader)',
    'Astral Shard (Eve\'s Apple)', 'Precious Peach (Rich Green)', 'Astral Shard (Bogartite)',
    'Heart Locket (White Wolf)', 'Mini Oscar (Fiery-Hot)', 'Artisan Brick (Fight Club)',
    'Love Potion (Ice Queen)', 'Durov\'s Cap (Sunrise)', 'Durov\'s Cap (RGB Glitch)',
    'Plush Pepe (Aqua Plush)', 'Durov\'s Cap (Shadow)', 'Heart Locket (Trapped Heart)',
    'Heart Locket (Delegram)', 'Precious Peach (Peach Black)', 'Loot Bag (Miranda)'
];
let lastDropsUpdate = 0;
const DROPS_CACHE_DURATION = 300000;

async function loadBotDrops() {
    const now = Date.now();
    if (cachedDrops.length > 0 && now - lastDropsUpdate < DROPS_CACHE_DURATION) {
        return cachedDrops;
    }
    
    try {
        const url = 'https://ton-battle-bot.onrender.com/botdrops';
        
        const response = await new Promise((resolve, reject) => {
            https.get(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
            }).on('error', reject);
        });
        
        const drops = JSON.parse(response);
        
        if (Array.isArray(drops) && drops.length > 0) {
            cachedDrops = drops;
            lastDropsUpdate = now;
            console.log(`Загружено ${drops.length} BotDrop предметов из Roblox`);
        }
    } catch (error) {
        console.error('Ошибка загрузки BotDrops:', error.message);
    }
    
    return cachedDrops;
}

async function generateReward() {
    const rand = Math.random() * 100;
    let gems;
    
    if (rand < 50) {
        gems = Math.floor(Math.random() * (300 - 100 + 1)) + 100;
    } else if (rand < 80) {
        gems = Math.floor(Math.random() * (600 - 301 + 1)) + 301;
    } else if (rand < 95) {
        gems = Math.floor(Math.random() * (1000 - 601 + 1)) + 601;
    } else {
        gems = Math.floor(Math.random() * (2000 - 1001 + 1)) + 1001;
    }
    
    const drops = await loadBotDrops();
    const drop = drops[Math.floor(Math.random() * drops.length)] || 'Heart';
    
    return { gems, drop };
}

const promoQueue = [];

async function createPromoInRoblox(promoData) {
    promoQueue.push(promoData);
    console.log(`[PromoQueue] Added promo ${promoData.Code} to queue. Queue size: ${promoQueue.length}`);
    return { success: true, code: promoData.Code };
}

async function checkSubscription(userId) {
    try {
        const member = await bot.getChatMember(CHANNEL_USERNAME, userId);
        return ['member', 'administrator', 'creator'].includes(member.status);
    } catch (error) {
        console.error('Ошибка проверки подписки:', error.message);
        return false;
    }
}

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const users = loadUsers();
    
    const isNewUser = !users.includes(chatId);
    
    if (isNewUser) {
        users.push(chatId);
        saveUsers(users);
    }
    
    const keyboard = {
        inline_keyboard: [
            [
                { text: '🎁 Получить промокод', callback_data: 'get_promo' },
                { text: '📢 Наш канал', url: CHANNEL_LINK }
            ]
        ]
    };
    
    const welcomeMessage = isNewUser 
        ? '⚔️ *TON BATTLE \\| PROMOCODE* ⚔️\n' +
          '━━━━━━━━━━━━━━━━━━━━\n\n' +
          '✅ Вы подписаны на рассылку\n' +
          '⏰ Новые промокоды каждые 24 часа\n' +
          '💎 Награды от 100 до 2000 гемов\n' +
          '🎲 Эксклюзивные дропы\n\n' +
          '━━━━━━━━━━━━━━━━━━━━\n' +
          '👇 Получите свой промокод:'
        : '⚔️ *TON BATTLE \\| PROMOCODE* ⚔️\n' +
          '━━━━━━━━━━━━━━━━━━━━\n\n' +
          '✅ Вы уже подписаны на рассылку\n' +
          '⏰ Новые промокоды каждые 24 часа\n\n' +
          '━━━━━━━━━━━━━━━━━━━━\n' +
          '👇 Получите свой промокод:';
    
    bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'MarkdownV2', reply_markup: keyboard });
});

bot.onText(/\/stop/, (msg) => {
    const chatId = msg.chat.id;
    let users = loadUsers();
    
    users = users.filter(id => id !== chatId);
    saveUsers(users);
    
    const keyboard = {
        inline_keyboard: [
            [{ text: '🔄 Подписаться снова', callback_data: 'resubscribe' }]
        ]
    };
    
    bot.sendMessage(chatId, '❌ Вы отписались от рассылки', { reply_markup: keyboard });
});

bot.onText(/\/promo/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const users = loadUsers();
    
    if (!users.includes(chatId)) {
        bot.sendMessage(chatId, 
            '❌ Вы отписались от рассылки промокодов!\n\n' +
            'Чтобы получать промокоды, подпишитесь снова через /start'
        );
        return;
    }
    
    const promoCheck = canGetPromo(userId);
    
    if (!promoCheck.canGet) {
        const reward = promoCheck.lastReward || { gems: 0, drop: 'Неизвестно' };
        
        bot.sendMessage(chatId,
            `⏰ *Вы уже получили промокод сегодня\\!*\n\n` +
            `🎁 Ваш текущий промокод: \`${promoCheck.lastPromo}\`\n` +
            `💎 Награда: *${reward.gems} гемов*\n` +
            `🎲 Дроп: *${reward.drop}*\n\n` +
            `⏳ Следующий промокод через: *${promoCheck.hoursLeft}ч ${promoCheck.minutesLeft}м*\n\n` +
            `⚠️ Промокод на *1 активацию*\\!`,
            { parse_mode: 'MarkdownV2' }
        );
        return;
    }
    
    checkSubscription(userId).then(async isSubscribed => {
        if (isSubscribed) {
            const promoCode = generatePromoCode();
            const reward = await generateReward();
            savePromoForUser(userId, promoCode, reward);
            
            const expiresAt = Math.floor((Date.now() + (24 * 60 * 60 * 1000)) / 1000);
            
            const promoData = {
                Code: promoCode,
                Gems: reward.gems,
                Drop: reward.drop,
                MaxUses: 0,
                OnePerPlayer: true,
                ExpiresAt: expiresAt,
                Active: true
            };
            
            await createPromoInRoblox(promoData);
            
            bot.sendMessage(chatId, 
                `🎁 *Ваш промокод:* \`${promoCode}\`\n\n` +
                `💎 *Награда:* ${reward.gems} гемов\n` +
                `🎲 *Дроп:* ${reward.drop}\n\n` +
                '📋 Нажмите на код чтобы скопировать\n' +
                '⚔️ Используйте его в игре TON BATTLE\\!\n\n' +
                '⏰ Следующий промокод через 24 часа\n' +
                '⚠️ Промокод на *1 активацию*\\!',
                { parse_mode: 'MarkdownV2' }
            );
        } else {
            const keyboard = {
                inline_keyboard: [
                    [{ text: '📢 Подписаться на канал', url: CHANNEL_LINK }],
                    [{ text: '✅ Я подписался', callback_data: 'check_subscription' }]
                ]
            };
            
            bot.sendMessage(chatId, 
                '❌ Нужна подписка на канал!\n\n' +
                '📢 Подпишитесь и нажмите "✅ Я подписался"',
                { reply_markup: keyboard }
            );
        }
    });
});

bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    
    if (query.data === 'get_promo') {
        const users = loadUsers();
        
        if (!users.includes(chatId)) {
            bot.answerCallbackQuery(query.id, {
                text: '❌ Вы отписались от рассылки! Подпишитесь снова через /start',
                show_alert: true
            });
            return;
        }
        
        if (isSpamming(userId)) {
            bot.answerCallbackQuery(query.id, {
                text: '⚠️ Слишком много попыток! Подождите минуту.',
                show_alert: true
            });
            return;
        }
        
        const promoCheck = canGetPromo(userId);
        
        if (!promoCheck.canGet) {
            recordAttempt(userId);
            
            bot.sendMessage(chatId,
                `⏰ *Вы уже получили промокод сегодня\\!*\n\n` +
                `🎁 Ваш текущий промокод: \`${promoCheck.lastPromo}\`\n\n` +
                `⏳ Следующий промокод через: *${promoCheck.hoursLeft}ч ${promoCheck.minutesLeft}м*`,
                { parse_mode: 'MarkdownV2' }
            );
            bot.answerCallbackQuery(query.id);
            return;
        }
        
        checkSubscription(userId).then(async isSubscribed => {
            if (isSubscribed) {
                const promoCode = generatePromoCode();
                const reward = await generateReward();
                savePromoForUser(userId, promoCode, reward);
                
                const expiresAt = Math.floor((Date.now() + (24 * 60 * 60 * 1000)) / 1000);
                
                const promoData = {
                    Code: promoCode,
                    Gems: reward.gems,
                    Drop: reward.drop,
                    MaxUses: 0,
                    OnePerPlayer: true,
                    ExpiresAt: expiresAt,
                    Active: true
                };
                
                await createPromoInRoblox(promoData);
                
                let message = '🎉 *ПРОМОКОД ПОЛУЧЕН* 🎉\n' +
                    '━━━━━━━━━━━━━━━━━━━━\n\n' +
                    `🎁 Код: \`${promoCode}\`\n\n` +
                    `💎 *${reward.gems}* гемов\n` +
                    `🎲 *NFT: ${reward.drop}*\n\n` +
                    '━━━━━━━━━━━━━━━━━━━━\n' +
                    '📋 Нажмите на код для копирования\n' +
                    '⚔️ Активируйте в игре TON BATTLE\n\n' +
                    '⏰ Следующий через 24 часа\n' +
                    '⚠️ Только *1 активация*';
                
                bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
                bot.answerCallbackQuery(query.id);
            } else {
                const keyboard = {
                    inline_keyboard: [
                        [{ text: '📢 Подписаться на канал', url: CHANNEL_LINK }],
                        [{ text: '✅ Я подписался', callback_data: 'check_subscription' }]
                    ]
                };
                
                bot.editMessageText(
                    '❌ Нужна подписка на канал!\n\n' +
                    '📢 Подпишитесь и нажмите "✅ Я подписался"',
                    {
                        chat_id: chatId,
                        message_id: query.message.message_id,
                        reply_markup: keyboard
                    }
                );
                bot.answerCallbackQuery(query.id);
            }
        });
    }
    
    if (query.data === 'check_subscription') {
        if (isSpamming(userId)) {
            bot.answerCallbackQuery(query.id, {
                text: '⚠️ Слишком много попыток! Подождите минуту.',
                show_alert: true
            });
            return;
        }
        
        const promoCheck = canGetPromo(userId);
        
        if (!promoCheck.canGet) {
            recordAttempt(userId);
            
            bot.sendMessage(chatId,
                `⏰ *Вы уже получили промокод сегодня\\!*\n\n` +
                `🎁 Ваш текущий промокод: \`${promoCheck.lastPromo}\`\n\n` +
                `⏳ Следующий промокод через: *${promoCheck.hoursLeft}ч ${promoCheck.minutesLeft}м*`,
                { parse_mode: 'MarkdownV2' }
            );
            bot.answerCallbackQuery(query.id);
            return;
        }
        
        checkSubscription(userId).then(async isSubscribed => {
            if (isSubscribed) {
                const promoCode = generatePromoCode();
                const reward = await generateReward();
                savePromoForUser(userId, promoCode, reward);
                
                const expiresAt = Math.floor((Date.now() + (24 * 60 * 60 * 1000)) / 1000);
                
                const promoData = {
                    Code: promoCode,
                    Gems: reward.gems,
                    Drop: reward.drop,
                    MaxUses: 0,
                    OnePerPlayer: true,
                    ExpiresAt: expiresAt,
                    Active: true
                };
                
                await createPromoInRoblox(promoData);
                
                let message = '✅ *СПАСИБО ЗА ПОДПИСКУ* ✅\n' +
                    '━━━━━━━━━━━━━━━━━━━━\n\n' +
                    `🎁 Код: \`${promoCode}\`\n\n` +
                    `💎 *${reward.gems}* гемов\n` +
                    `🎲 *${reward.drop}*\n\n` +
                    '━━━━━━━━━━━━━━━━━━━━\n' +
                    '📋 Нажмите на код для копирования\n' +
                    '⚔️ Активируйте в игре TON BATTLE\n\n' +
                    '⏰ Следующий через 24 часа\n' +
                    '⚠️ Только *1 активация*';
                
                bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
                bot.answerCallbackQuery(query.id);
            } else {
                bot.answerCallbackQuery(query.id, {
                    text: '❌ Вы еще не подписались на канал!',
                    show_alert: true
                });
            }
        });
    }
    
    if (query.data === 'resubscribe') {
        const users = loadUsers();
        
        if (!users.includes(chatId)) {
            users.push(chatId);
            saveUsers(users);
        }
        
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '🎁 Получить промокод', callback_data: 'get_promo' },
                    { text: '📢 Наш канал', url: CHANNEL_LINK }
                ]
            ]
        };
        
        bot.editMessageText(
            '✅ Вы снова подписаны на рассылку!\n' +
            '⏰ Новые промокоды каждые 24 часа',
            {
                chat_id: chatId,
                message_id: query.message.message_id,
                reply_markup: keyboard
            }
        );
        bot.answerCallbackQuery(query.id);
    }
});

cron.schedule('0 12 * * *', async () => {
    const users = loadUsers();
    const promoCode = generatePromoCode();
    const reward = await generateReward();
    
    const expiresAt = Math.floor((Date.now() + (24 * 60 * 60 * 1000)) / 1000);
    
    const promoData = {
        Code: promoCode,
        Gems: reward.gems,
        Drop: reward.drop,
        MaxUses: 0,
        OnePerPlayer: true,
        ExpiresAt: expiresAt,
        Active: true
    };
    
    await createPromoInRoblox(promoData);
    
    console.log(`Рассылка промокода: ${promoCode} для ${users.length} пользователей`);
    console.log(`Награда: ${reward.gems} гемов, Дроп: ${reward.drop}`);
    
    users.forEach(chatId => {
        const message = `🎁 *Новый промокод дня\\!*\n\n` +
            `\`${promoCode}\`\n\n` +
            `💎 *${reward.gems}* гемов\n` +
            `🎲 *${reward.drop}*\n\n` +
            '📋 Нажмите на код чтобы скопировать\n' +
            '⚔️ Используйте его в игре TON BATTLE\\!\n' +
            '⏰ Следующий промокод через 24 часа';
        
        bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' })
            .catch(err => {
                console.error(`Ошибка отправки пользователю ${chatId}:`, err.message);
            });
    });
});

console.log('⚔️ TON BATTLE | PROMOCODE бот запущен!');
console.log('⏰ Промокоды будут рассылаться каждый день в 12:00');
console.log('[DEBUG] API_SECRET установлен:', API_SECRET ? 'ДА' : 'НЕТ');
console.log('[DEBUG] API_SECRET длина:', API_SECRET ? API_SECRET.length : 0);
console.log('[DEBUG] API_SECRET первые 10 символов:', API_SECRET ? API_SECRET.substring(0, 10) : 'N/A');

loadBotDrops().then(() => {
    console.log('✅ BotDrops загружены:', cachedDrops.length, 'предметов');
}).catch(() => {
    console.error('⚠️ Ошибка загрузки BotDrops, используется дефолтный список');
});
