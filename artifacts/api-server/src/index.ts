import express from "express";
import cors from "cors";

const app = express();

// ✅ Middleware
app.use(cors());
app.use(express.json());

// ✅ Health check (VERY IMPORTANT for testing)
app.get("/", (req, res) => {
  res.json({ message: "API is running 🚀" });
});

// ✅ LOGIN ROUTE (FINAL)
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  // Demo user (you can replace with DB later)
  if (email === "
      
        
      
        volunteer@iitm.ac.in
 
      
    " && password === "123456") {
    return res.json({
      success: true,
      user: {
        id: "1",
        email,
        role: "volunteer",
      },
    });
  }

  return res.status(401).json({
    success: false,
    message: "Invalid credentials",
  });
});

export default app;