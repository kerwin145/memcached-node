const express = require('express');
const mysql = require('mysql');
const memjs = require('memjs');


const app = express();
const port = 80
const ipAddress = '0.0.0.0'

const memcachedClient = memjs.Client.create('localhost:11211');
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'your_password',
    database: 'hw6'
});

app.use(function(req, res, next) {
    res.setHeader("X-CSE356", "65b1b43bab30997971ab6f14")
    next()
});

function fetchDataWithCache(playerName, callback) {
    const cacheKey = `player_${playerName}`;
    memcachedClient.get(cacheKey, (err, value) => {
        if (err) {
            console.error('Memcached error:', err);
            fetchFromMySQL(playerName, callback);
            return;
        }
        if (value) {
            // Data found in Memcached, parse and return it
            const data = JSON.parse(value.toString());
            callback(null, data);
        } else {
            // Data not found in Memcached, fetch from MySQL
            fetchFromMySQL(playerName, (error, data) => {
                if (!error) {
                    // Store data in Memcached with an expiry time (e.g., 1 hour)
                    memcachedClient.set(cacheKey, JSON.stringify(data), { expires: 3600 }, () => {
                        // Ignore error handling for Memcached set operation
                    });
                }
                callback(error, data);
            });
        }
    });
}

function fetchFromMySQL(playerName, callback) {
    const query = `SELECT A.Player as p1, B.Player as p2, C.Player as p3, D.Player as p4 FROM assists A, assists B, assists C, assists D WHERE A.POS=B.POS AND B.POS=C.POS AND C.POS=D.POS AND A.Club<>B.Club AND A.club<>C.Club AND A.Club<>C.Club AND A.Club<>D.Club AND B.Club<>C.Club AND B.Club<>D.Club AND C.Club<>D.Club AND A.Player='${playerName}' ORDER BY A.A+B.A+C.A+D.A DESC, A.A DESC, B.A DESC, C.A DESC, D.A DESC, p1, p2, p3, p4 LIMIT 1;`;

    connection.query(query, (error, results, fields) => {
        if (error) {
            callback(error);
            return;
        }
        const players = results.map(result => [result.p1, result.p2, result.p3, result.p4]);
        callback(null, players);
    });
}

app.get('/hw6', (req, res) => {
    const playerName = decodeURIComponent(req.query.player);
    
    // Fetch data with caching
    fetchDataWithCache(playerName, (error, data) => {
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.json({ players: data[0] });
    });
});


app.listen(port, ipAddress, () => {
    console.log(`App listening at http://localhost:${port}`)
});