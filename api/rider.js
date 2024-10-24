import express from 'express';
import multer from 'multer';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bcrypt from 'bcrypt';
import firebaseApp from '../config/firebase/firebaseConfig.js';  // นำเข้าจากไฟล์คอนฟิก

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

// POST Add Rider Route
router.post("/add-rider", upload.single("image"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: "No file uploaded." });
    }

    const storageRef = ref(storage, `uploads/${req.file.originalname}`);
    const fileBuffer = req.file.buffer;

    // Create metadata for the file
    const metadata = {
        contentType: req.file.mimetype, // Set the correct content type
    };

    try {
        // Upload the file with metadata
        await uploadBytesResumable(storageRef, fileBuffer, metadata);
        const downloadURL = await getDownloadURL(storageRef);
        
        const riderData = {
            name: req.body.name,
            phone: req.body.phone,
            password: req.body.password,
            vehicleRegistration: req.body.vehicleRegistration, 
            image: downloadURL 
        };

        // ตรวจสอบว่ามีผู้ขับขี่ (rider) อยู่ในระบบหรือไม่
        const existingRider = await database.get('SELECT * FROM riders WHERE phone = ?', [riderData.phone]);

        if (existingRider) {
            return res.status(400).json({ message: "This number is already in use." });
        }

        // เข้ารหัสรหัสผ่านก่อนเก็บลงในฐานข้อมูล
        const hashedPassword = await bcrypt.hash(riderData.password, 10);

        const insertQuery = `
            INSERT INTO riders (name, phone, password, vehicleRegistration, image)
            VALUES (?, ?, ?, ?, ?)`;

        // Run the insert query
        await database.run(insertQuery, [
            riderData.name,
            riderData.phone,
            hashedPassword, 
            riderData.vehicleRegistration, 
            riderData.image 
        ]);

        res.status(200).json({
            message: "Rider added successfully.",
            imageURL: downloadURL
        });
    } catch (error) {
        console.error("Error uploading file or inserting rider data:", error);
        res.status(500).json({ message: "Error processing request", error: error.message });
    }
});


// GET all riders Route
router.get("/get-riders", async (req, res) => {
    try {
        const riders = await database.all('SELECT rid AS id, name, phone, vehicleRegistration, image FROM riders'); 
        if (riders.length > 0) {
            res.status(200).json(riders);
        } else {
            res.status(404).json({ message: "No riders found." });
        }
    } catch (error) {
        console.error("Error retrieving riders:", error);
        res.status(500).json({ message: "Error retrieving riders", error: error.message });
    }
});

// POST Login Route for Riders
router.post("/login", async (req, res) => {
    const { phone, password } = req.body;

    if (!phone || !password) {
        return res.status(400).json({ message: "Phone number and password are required." });
    }

    try {
        const rider = await database.get('SELECT * FROM riders WHERE phone = ?', [phone]);

        if (!rider) {
            return res.status(401).json({ message: "No rider found with this phone number." });
        }

        if (await bcrypt.compare(password, rider.password)) { 
            res.status(200).json({
                message: "Login successful.",
                rider: {
                    rid: rider.rid, 
                    name: rider.name,
                    phone: rider.phone,
                    vehicleRegistration: rider.vehicleRegistration, 
                    image: rider.image 
                }
            });
        } else {
            res.status(401).json({ message: "Invalid password." });
        }
    } catch (error) {
        console.error("Error logging in:", error);
        res.status(500).json({ message: "Error processing request", error: error.message });
    }
});

// GET Rider by RID Route
router.get("/get-rider/:rid", async (req, res) => {
    const rid = req.params.rid; // ดึง RID จาก URL params

    try {
        const rider = await database.get('SELECT * FROM riders WHERE rid = ?', [rid]);

        if (rider) {
            res.status(200).json(rider);
        } else {
            res.status(404).json({ message: "Rider not found." });
        }
    } catch (error) {
        console.error("Error retrieving rider:", error);
        res.status(500).json({ message: "Error retrieving rider", error: error.message });
    }
});

export default router;
