import multer from 'multer';
import path from 'path';
import fs from 'fs';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads/';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.match(/\/(jpeg|jpg|png|pdf|msword|vnd.openxmlformats-officedocument.wordprocessingml.document|zip|x-autocad)$/)) {
    cb(null, true);
  } else {
    cb(null, true); 
  }
};

const upload = multer({ storage, fileFilter });
export default upload;