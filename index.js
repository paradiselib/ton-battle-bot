const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const http = require('http');

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_USERNAME = '@tonbattleofc';
const CHANNEL_LINK = 'https://t.me/tonbattleofc';
const PORT = process.env.PORT || 10000;

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PROMO_HISTORY_FILE = path.join(DATA_DIR, 'promo_history.json');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('TON BATTLE Bot is running!');
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
    const hoursLeft = Math.max(0, 24 - Math.floor(timeDiff / (1000 * 60 * 60)));
    const minutesLeft = Math.max(0, 60 - Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60)));
    
    if (timeDiff >= 24 * 60 * 60 * 1000) {
        return { canGet: true, timeLeft: 0 };
    }
    
    return { 
        canGet: false, 
        hoursLeft: hoursLeft,
        minutesLeft: minutesLeft,
        lastPromo: userHistory.promo,
        attempts: userHistory.attempts || 0
    };
}

function savePromoForUser(userId, promo) {
    const history = loadPromoHistory();
    const existing = history[userId];
    
    history[userId] = {
        promo: promo,
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
    
    bot.sendMessage(chatId, 
        '⚔️ *Добро пожаловать в TON BATTLE \\| PROMOCODE\\!*\n\n' +
        '✅ Вы подписаны на рассылку промокодов\n' +
        '⏰ Промокоды выдаются каждые 24 часа\n' +
        '🎮 Используйте промокоды в игре TON BATTLE \\(Roblox\\)\n\n' +
        '👇 Нажмите кнопку ниже для получения промокода:',
        { parse_mode: 'MarkdownV2', reply_markup: keyboard }
    );
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
    
    bot.sendMessage(chatId, '❌ Вы отписались от рассылки промокодов', { reply_markup: keyboard });
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
        bot.sendMessage(chatId,
            `⏰ *Вы уже получили промокод сегодня\\!*\n\n` +
            `🎁 Ваш текущий промокод: \`${promoCheck.lastPromo}\`\n\n` +
            `⏳ Следующий промокод через: *${promoCheck.hoursLeft}ч ${promoCheck.minutesLeft}м*`,
            { parse_mode: 'MarkdownV2' }
        );
        return;
    }
    
    checkSubscription(userId).then(isSubscribed => {
        if (isSubscribed) {
            const promoCode = generatePromoCode();
            savePromoForUser(userId, promoCode);
            
            bot.sendMessage(chatId, 
                `🎁 *Ваш промокод:* \`${promoCode}\`\n\n` +
                '📋 Нажмите на код чтобы скопировать\n' +
                '⚔️ Используйте его в игре TON BATTLE \\(Roblox\\)\\!\n\n' +
                '⏰ Следующий промокод через 24 часа',
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
                '❌ Для получения промокода нужно подписаться на наш канал!\n\n' +
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
            bot.answerCallbackQuery(query.id, {
                text: `⏰ Следующий промокод через ${promoCheck.hoursLeft}ч ${promoCheck.minutesLeft}м`,
                show_alert: true
            });
            
            bot.sendMessage(chatId,
                `⏰ *Вы уже получили промокод сегодня\\!*\n\n` +
                `🎁 Ваш текущий промокод: \`${promoCheck.lastPromo}\`\n\n` +
                `⏳ Следующий промокод через: *${promoCheck.hoursLeft}ч ${promoCheck.minutesLeft}м*`,
                { parse_mode: 'MarkdownV2' }
            );
            return;
        }
        
        checkSubscription(userId).then(isSubscribed => {
            if (isSubscribed) {
                const promoCode = generatePromoCode();
                savePromoForUser(userId, promoCode);
                
                bot.sendMessage(chatId, 
                    `🎁 *Ваш промокод:* \`${promoCode}\`\n\n` +
                    '📋 Нажмите на код чтобы скопировать\n' +
                    '⚔️ Используйте его в игре TON BATTLE \\(Roblox\\)\\!\n\n' +
                    '⏰ Следующий промокод через 24 часа',
                    { parse_mode: 'MarkdownV2' }
                );
                bot.answerCallbackQuery(query.id);
            } else {
                const keyboard = {
                    inline_keyboard: [
                        [{ text: '📢 Подписаться на канал', url: CHANNEL_LINK }],
                        [{ text: '✅ Я подписался', callback_data: 'check_subscription' }]
                    ]
                };
                
                bot.editMessageText(
                    '❌ Для получения промокода нужно подписаться на наш канал!\n\n' +
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
            bot.answerCallbackQuery(query.id, {
                text: `⏰ Следующий промокод через ${promoCheck.hoursLeft}ч ${promoCheck.minutesLeft}м`,
                show_alert: true
            });
            return;
        }
        
        checkSubscription(userId).then(isSubscribed => {
            if (isSubscribed) {
                const promoCode = generatePromoCode();
                savePromoForUser(userId, promoCode);
                
                bot.sendMessage(chatId, 
                    `✅ Спасибо за подписку\\!\n\n` +
                    `🎁 *Ваш промокод:* \`${promoCode}\`\n\n` +
                    '📋 Нажмите на код чтобы скопировать\n' +
                    '⚔️ Используйте его в игре TON BATTLE \\(Roblox\\)\\!\n\n' +
                    '⏰ Следующий промокод через 24 часа',
                    { parse_mode: 'MarkdownV2' }
                );
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
            '✅ Вы снова подписаны на рассылку промокодов!\n' +
            '⏰ Промокоды выдаются каждые 24 часа',
            {
                chat_id: chatId,
                message_id: query.message.message_id,
                reply_markup: keyboard
            }
        );
        bot.answerCallbackQuery(query.id);
    }
});

cron.schedule('0 12 * * *', () => {
    const users = loadUsers();
    const promoCode = generatePromoCode();
    
    console.log(`Рассылка промокода: ${promoCode} для ${users.length} пользователей`);
    
    users.forEach(chatId => {
        bot.sendMessage(chatId, 
            `🎁 Новый промокод дня: \`${promoCode}\`\n\n` +
            '📋 Нажмите на код чтобы скопировать\n' +
            '⚔️ Используйте его в игре TON BATTLE (Roblox)!\n' +
            '⏰ Следующий промокод через 24 часа',
            { parse_mode: 'Markdown' }
        ).catch(err => {
            console.error(`Ошибка отправки пользователю ${chatId}:`, err.message);
        });
    });
});

console.log('⚔️ TON BATTLE | PROMOCODE бот запущен!');
console.log('⏰ Промокоды будут рассылаться каждый день в 12:00');
