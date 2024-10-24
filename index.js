// server.js
import express from 'express';
import userRouter from './api/user.js'; 
import riderRouter from './api/rider.js'; 
import searchRouter from './api/searchphone.js'; 
import shipmentsRouter from './api/shipments.js'; 
import multer from 'multer';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // เพื่อจัดการกับข้อมูลที่ส่งแบบ URL-encoded
app.use('/rider', riderRouter);
app.use('/user', userRouter); // ใช้ router สำหรับเส้นทาง /user
app.use('/rider', riderRouter);
app.use('/search', searchRouter);
app.use('/shipments', shipmentsRouter);
// Global error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!', error: err.message });
});

// เริ่มเซิร์ฟเวอร์
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
