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

function generatePromoCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'TONBATTLE';
    for (let i = 0; i < 6; i++) {
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
            [{ text: '🎁 Получить промокод', callback_data: 'get_promo' }],
            [{ text: '📢 Наш канал', url: CHANNEL_LINK }]
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

bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    
    if (query.data === 'get_promo') {
        checkSubscription(userId).then(isSubscribed => {
            if (isSubscribed) {
                const promoCode = generatePromoCode();
                bot.sendMessage(chatId, 
                    `🎁 *Ваш промокод:* \`${promoCode}\`\n\n` +
                    '📋 Нажмите на код чтобы скопировать\n' +
                    '⚔️ Используйте его в игре TON BATTLE \\(Roblox\\)\\!',
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
        checkSubscription(userId).then(isSubscribed => {
            if (isSubscribed) {
                const promoCode = generatePromoCode();
                bot.sendMessage(chatId, 
                    `✅ Спасибо за подписку\\!\n\n` +
                    `🎁 *Ваш промокод:* \`${promoCode}\`\n\n` +
                    '� Нажмите на код чтобы скопировать\n' +
                    '⚔️ Используйте его в игре TON BATTLE \\(Roblox\\)\\!',
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
                [{ text: '🎁 Получить промокод', callback_data: 'get_promo' }],
                [{ text: '📢 Наш канал', url: CHANNEL_LINK }]
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

bot.onText(/\/promo/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    checkSubscription(userId).then(isSubscribed => {
        if (isSubscribed) {
            const promoCode = generatePromoCode();
            bot.sendMessage(chatId, 
                `🎁 *Ваш промокод:* \`${promoCode}\`\n\n` +
                '📋 Нажмите на код чтобы скопировать\n' +
                '⚔️ Используйте его в игре TON BATTLE \\(Roblox\\)\\!',
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
