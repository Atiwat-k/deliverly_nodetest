import express from 'express';
import multer from 'multer';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bcrypt from 'bcrypt';
import firebaseApp from '../config/firebase/firebaseConfig.js'; // นำเข้าจากไฟล์คอนฟิก

const storage = getStorage(firebaseApp); // ใช้ storage จากแอปที่นำเข้ามา

const router = express.Router();

// SQLite Database setup
const database = await open({
    filename: './database_delivery.db',
    driver: sqlite3.Database
});

// Create multer instance with file filter
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 67108864 // 64 MB
    },
    fileFilter: (req, file, cb) => {
        // Check if the file is a PNG, JPG, or JPEG image
        const allowedTypes = ['image/png', 'image/jpg', 'image/jpeg'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true); // Accept the file
        } else {
            cb(new Error('Only .png, .jpg, and .jpeg files are allowed!'), false); // Reject the file
        }
    }
});

router.post('/shipments', upload.fields([{ name: 'image', maxCount: 1 }]), async (req, res) => {
    const file = req.files && req.files.image && req.files.image[0];
    if (!file) {
        return res.status(400).json({ message: "No file uploaded." });
    }

    const storageRef = ref(storage, `images/${file.originalname}`);
    const fileBuffer = file.buffer;

    const metadata = {
        contentType: file.mimetype,
    };

    try {
        await uploadBytesResumable(storageRef, fileBuffer, metadata);
        const downloadURL = await getDownloadURL(storageRef);

        const { sender_id, receiver_id, description, pickup_location, delivery_location } = req.body;

        const insertQuery = `
            INSERT INTO shipments (sender_id, receiver_id, description, status, image, pickup_location, delivery_location)
            VALUES (?, ?, ?, 1, ?, ?, ?)
        `;

        const result = await database.run(insertQuery, [
            sender_id,
            receiver_id,
            description,
            downloadURL,
            pickup_location,
            delivery_location
        ]);

        res.status(201).json({
            shipment_id: result.lastID,
            message: "Shipment created successfully."
        });
    } catch (error) {
        console.error("Error uploading file or inserting shipment data:", error);
        res.status(500).json({ message: "Error processing request", error: error.message });
    }
});
// API: Get all shipments
router.get('/shipments', async (req, res) => {
    try {
        const shipments = await database.all('SELECT * FROM shipments');
        res.status(200).json(shipments);
    } catch (error) {
        console.error("Error fetching shipments:", error);
        res.status(500).json({ message: "Error fetching shipments", error: error.message });
    }
});

// API: Get shipments by sender ID with receiver user details
router.get('/sender/:senderId', async (req, res) => {
    const { senderId } = req.params; // รับ sender ID จากพารามิเตอร์ในคำขอ

    try {
        const shipments = await database.all(`
               SELECT  
        receiver.uid AS receiver_uid, 
        receiver.name AS receiver_name, 
        receiver.phone AS receiver_phone, 
        receiver.image AS receiver_image,
        receiver.gps AS receiver_gps,  -- เพิ่ม gps ของผู้รับ
        sender.uid AS sender_uid, 
        sender.name AS sender_name,
        sender.phone AS sender_phone,
        sender.image AS sender_image,
        sender.gps AS sender_gps,  -- เพิ่ม gps ของผู้ส่ง
        shipments.status,
        shipments.shipment_id,
        shipments.sender_id
    FROM shipments 
    LEFT JOIN users AS receiver ON shipments.receiver_id = receiver.uid 
    LEFT JOIN users AS sender ON shipments.sender_id = sender.uid 
    WHERE shipments.sender_id = ?`,
    [senderId]
        );

        if (shipments.length === 0) {
            return res.status(404).json({ message: "No shipments found for this sender." });
        }

        res.status(200).json(shipments);
    } catch (error) {
        console.error("Error fetching shipments by sender ID:", error);
        res.status(500).json({ message: "Error fetching shipments", error: error.message });
    }
});

router.get('/shipments', async (req, res) => {
    try {
        const shipments = await database.all('SELECT * FROM shipments');
        res.status(200).json(shipments);
    } catch (error) {
        console.error("Error fetching shipments:", error);
        res.status(500).json({ message: "Error fetching shipments", error: error.message });
    }
});

// API: Get shipments by sender ID with receiver user details
router.get('/receiver/:receiverId', async (req, res) => {
    const { receiverId } = req.params; // รับ receiver ID จากพารามิเตอร์ในคำขอ

    try {
        const shipments = await database.all(`
            SELECT  
             receiver.uid AS receiver_uid, 
        receiver.name AS receiver_name, 
        receiver.phone AS receiver_phone, 
        receiver.image AS receiver_image,
        receiver.gps AS receiver_gps,  -- เพิ่ม gps ของผู้รับ
        sender.uid AS sender_uid, 
        sender.name AS sender_name,
        sender.phone AS sender_phone,
        sender.image AS sender_image,
        sender.gps AS sender_gps,  -- เพิ่ม gps ของผู้ส่ง
        shipments.status,
        shipments.shipment_id,
        shipments.sender_id
            FROM shipments 
            LEFT JOIN users AS receiver ON shipments.receiver_id = receiver.uid 
            LEFT JOIN users AS sender ON shipments.sender_id = sender.uid 
            WHERE shipments.receiver_id = ?`,
            [receiverId]
        );

        if (shipments.length === 0) {
            return res.status(404).json({ message: "No shipments found for this receiver." });
        }

        res.status(200).json(shipments);
    } catch (error) {
        console.error("Error fetching shipments by receiver ID:", error);
        res.status(500).json({ message: "Error fetching shipments", error: error.message });
    }
});
export default router;
