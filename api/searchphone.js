import express from 'express';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import firebaseApp from '../config/firebase/firebaseConfig.js';
import { getStorage } from 'firebase/storage';

const storage = getStorage(firebaseApp);
const router = express.Router();

// SQLite Database setup
const database = await open({
    filename: './database_delivery.db',
    driver: sqlite3.Database
});

router.get('/search-user/:phone/:uid', async (req, res) => {
    const { phone, uid } = req.params;

    try {
        const users = await database.all('SELECT * FROM users WHERE phone LIKE ? AND uid != ?', [`%${phone}%`, uid]);
        if (users.length > 0) {
            res.status(200).json(users);
        } else {
            res.status(404).json({ message: 'No users found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

export default router;
