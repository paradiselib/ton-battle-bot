const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_USERNAME = '@tonbattleofc';
const CHANNEL_LINK = 'https://t.me/tonbattleofc';

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

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
        keyboard: [
            [{ text: '🎁 Получить промокод' }],
            [{ text: '❌ Отписаться' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
    };
    
    bot.sendMessage(chatId, 
        '⚔️ Добро пожаловать в TON BATTLE | PROMOCODE!\n\n' +
        '✅ Вы подписаны на рассылку промокодов\n' +
        '⏰ Промокоды выдаются каждые 24 часа\n' +
        '🎮 Используйте промокоды в игре TON BATTLE (Roblox)\n\n' +
        '👇 Используйте кнопки ниже:',
        { reply_markup: keyboard }
    );
});

bot.onText(/\/stop/, (msg) => {
    const chatId = msg.chat.id;
    let users = loadUsers();
    
    users = users.filter(id => id !== chatId);
    saveUsers(users);
    
    const keyboard = {
        keyboard: [
            [{ text: '🔄 Подписаться снова' }]
        ],
        resize_keyboard: true
    };
    
    bot.sendMessage(chatId, '❌ Вы отписались от рассылки промокодов', { reply_markup: keyboard });
});

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const userId = msg.from.id;
    
    if (text === '🎁 Получить промокод') {
        checkSubscription(userId).then(isSubscribed => {
            if (isSubscribed) {
                const promoCode = generatePromoCode();
                bot.sendMessage(chatId, 
                    `🎁 Ваш промокод: \`${promoCode}\`\n\n` +
                    '📋 Нажмите на код чтобы скопировать\n' +
                    '⚔️ Используйте его в игре TON BATTLE (Roblox)!',
                    { parse_mode: 'Markdown' }
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
    }
    
    if (text === '❌ Отписаться') {
        let users = loadUsers();
        users = users.filter(id => id !== chatId);
        saveUsers(users);
        
        const keyboard = {
            keyboard: [
                [{ text: '🔄 Подписаться снова' }]
            ],
            resize_keyboard: true
        };
        
        bot.sendMessage(chatId, '❌ Вы отписались от рассылки промокодов', { reply_markup: keyboard });
    }
    
    if (text === '🔄 Подписаться снова') {
        const users = loadUsers();
        
        if (!users.includes(chatId)) {
            users.push(chatId);
            saveUsers(users);
        }
        
        const keyboard = {
            keyboard: [
                [{ text: '🎁 Получить промокод' }],
                [{ text: '❌ Отписаться' }]
            ],
            resize_keyboard: true
        };
        
        bot.sendMessage(chatId, 
            '✅ Вы снова подписаны на рассылку промокодов!\n' +
            '⏰ Промокоды выдаются каждые 24 часа',
            { reply_markup: keyboard }
        );
    }
});

bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    
    if (query.data === 'check_subscription') {
        checkSubscription(userId).then(isSubscribed => {
            if (isSubscribed) {
                const promoCode = generatePromoCode();
                bot.sendMessage(chatId, 
                    `✅ Спасибо за подписку!\n\n` +
                    `🎁 Ваш промокод: \`${promoCode}\`\n\n` +
                    '📋 Нажмите на код чтобы скопировать\n' +
                    '⚔️ Используйте его в игре TON BATTLE (Roblox)!',
                    { parse_mode: 'Markdown' }
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
});

bot.onText(/\/promo/, (msg) => {
    const chatId = msg.chat.id;
    const promoCode = generatePromoCode();
    
    bot.sendMessage(chatId, 
        `🎁 Ваш промокод: \`${promoCode}\`\n\n` +
        '📋 Нажмите на код чтобы скопировать\n' +
        '⚔️ Используйте его в игре TON BATTLE (Roblox)!',
        { parse_mode: 'Markdown' }
    );
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
