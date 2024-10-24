var express = require('express');
var app = express();

var cookieParser = require('cookie-parser');
var session = require('express-session');
var bodyParser = require('body-parser');
var path = require('path');
var sql = require('mssql');

var config = require('./config');

// Middleware для обработки JSON и cookie
app.use(bodyParser.json());
app.use(cookieParser());
app.use(session({
    saveUninitialized: false,
    resave: false,
    secret: 'supersecret',
    cookie: {maxAge: 600000}  // Сессия истекает через 10 минут
}));

// Настройка шаблонов
app.set('views', path.join(__dirname, 'pages'));
app.set('view engine', 'ejs');

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Функция поиска пользователя в таблице Users
async function findUser(username, password) {
    try {
        let pool = await sql.connect(config);
        let result = await pool.request()
            .input('username', sql.NVarChar(50), username)
            .input('password', sql.NVarChar(50), password)
            .query('SELECT * FROM dbo.Users WHERE Login = @username AND Password = @password');
        return result.recordset.length > 0;
    } catch (err) {
        console.error('Database error:', err);
        return false;
    }
}

// Функция поиска администратора в таблице Admins
async function findAdmin(username, password) {
    try {
        let pool = await sql.connect(config);
        let result = await pool.request()
            .input('username', sql.NVarChar(50), username)
            .input('password', sql.NVarChar(50), password)
            .query('SELECT * FROM dbo.Admins WHERE Login = @username AND Password = @password');
        return result.recordset.length > 0;
    } catch (err) {
        console.error('Database error:', err);
        return false;
    }
}

// Маршрут для логина
app.post('/login', async (req, res) => {
    var username = req.body.username;
    var password = req.body.password;

    let isAdmin = await findAdmin(username, password);
    let isUser = await findUser(username, password);

    if (isAdmin) {
        req.session.username = username;
        req.session.role = 'admin';
        req.session.save((err) => {
            if (err) return res.status(500).send('Session save error');
            console.log("Admin login succeeded:", req.session.username);
            res.send(`Login successful: sessionID: ${req.session.id}; admin: ${req.session.username}`);
        });
    } else if (isUser) {
        req.session.username = username;
        req.session.role = 'user';
        req.session.save((err) => {
            if (err) return res.status(500).send('Session save error');
            console.log("User login succeeded:", req.session.username);
            res.send(`Login successful: sessionID: ${req.session.id}; user: ${req.session.username}`);
        });
    } else {
        console.log("Login failed:", username);
        res.status(401).send('Login error');
    }
});

// Маршрут для выхода из системы
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.status(500).send('Logout error');
        res.clearCookie('connect.sid');
        console.log('Logged out');
        res.send('Logged out!');
    });
});

// Маршрут для страницы администратора
app.get('/admin', (req, res) => {
    if (req.session.role === 'admin') {
        console.log(`${req.session.username} requested admin page`);
        res.render('admin_page');
    } else {
        res.status(403).send('Access Denied!');
    }
});

// Маршрут для страницы пользователя
app.get('/user', (req, res) => {
    if (req.session.role === 'user' || req.session.role === 'admin') {
        console.log(`${req.session.username} requested user page`);
        res.render('user_page');
    } else {
        res.status(403).send('Access Denied!');
    }
});

// Маршрут для гостевой страницы
app.get('/guest', (req, res) => {
    res.render('guest_page');
});

// Запуск сервера
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`App running on port ${PORT}`);
});
