const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = process.env.BOT_TOKEN || '8296253879:AAFYe_ugz6z71fn9m8CTPxS3q5vVEFq0lFs';
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

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const users = loadUsers();
    
    if (!users.includes(chatId)) {
        users.push(chatId);
        saveUsers(users);
    }
    
    bot.sendMessage(chatId, 
        '⚔️ Добро пожаловать в TON BATTLE | PROMOCODE!\n\n' +
        '✅ Вы подписаны на рассылку промокодов\n' +
        '⏰ Промокоды выдаются каждые 24 часа\n' +
        '🎮 Используйте промокоды в игре TON BATTLE (Roblox)\n\n' +
        'Команды:\n' +
        '/start - Подписаться на рассылку\n' +
        '/stop - Отписаться от рассылки\n' +
        '/promo - Получить текущий промокод'
    );
});

bot.onText(/\/stop/, (msg) => {
    const chatId = msg.chat.id;
    let users = loadUsers();
    
    users = users.filter(id => id !== chatId);
    saveUsers(users);
    
    bot.sendMessage(chatId, '❌ Вы отписались от рассылки промокодов');
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
