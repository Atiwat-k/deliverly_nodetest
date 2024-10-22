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
// POST Add User Route
router.post("/add-user", upload.single("image"), async (req, res) => {
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
        
        const userData = {
            name: req.body.name,
            phone: req.body.phone,
            password: req.body.password,
            address: req.body.address,
            gps: req.body.gps,
            image: downloadURL // URL ที่เข้าถึงได้
        };

        // ตรวจสอบว่ามีผู้ใช้อยู่ในระบบหรือไม่
        const existingUser = await database.get('SELECT * FROM users WHERE phone = ?', [userData.phone]);

        if (existingUser) {
            return res.status(400).json({ message: "มีผู้ใช้เบอร์นี้แล้ว" });
        }

        // เข้ารหัสรหัสผ่านก่อนเก็บลงในฐานข้อมูล
        const hashedPassword = await bcrypt.hash(userData.password, 10);

        const insertQuery = `
            INSERT INTO users (name, phone, password, address, gps, image)
            VALUES (?, ?, ?, ?, ?, ?)`;

        // Run the insert query
        await database.run(insertQuery, [
            userData.name,
            userData.phone,
            hashedPassword, // ใช้รหัสผ่านที่เข้ารหัส
            userData.address,
            userData.gps,
            userData.image
        ]);

        res.status(200).json({
            message: "File uploaded successfully and user data added.",
            filename: downloadURL
        });
    } catch (error) {
        console.error("Error uploading file or inserting user data:", error);
        res.status(500).json({ message: "Error processing request", error: error.message });
    }
});

// GET all users Route
router.get("/get-users", async (req, res) => {
    try {
        const users = await database.all('SELECT * FROM users');
        if (users.length > 0) {
            res.status(200).json(users);
        } else {
            res.status(404).json({ message: "No users found." });
        }
    } catch (error) {
        console.error("Error retrieving users:", error);
        res.status(500).json({ message: "Error retrieving users", error: error.message });
    }
});
// POST Login Route
router.post("/login", async (req, res) => {
  const { phone, password } = req.body;

  if (!phone || !password) {
      return res.status(400).json({ message: "Phone number and password are required." });
  }

  try {
      const user = await database.get('SELECT * FROM users WHERE phone = ?', [phone]);

      if (!user) {
          return res.status(401).json({ message: "No user found with this phone number." });
      }

      if (await bcrypt.compare(password, user.password)) { // ตรวจสอบรหัสผ่าน
          res.status(200).json({
              message: "Login successful.",
              user: {
                  uid: user.uid,
                  name: user.name,
                  phone: user.phone,
                  address: user.address,
                  gps: user.gps,
                  image: user.image
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
export default router;
