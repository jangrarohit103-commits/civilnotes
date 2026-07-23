const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3000;

const ADMIN_PASSWORD = "rohit123";

const DATA_FILE = path.join(__dirname, "notes.json");
const UPLOAD_DIR = path.join(__dirname, "uploads");

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]");

function readNotes() {
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
}

function writeNotes(notes) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(notes, null, 2));
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + file.originalname.replace(/\s+/g, "_");
    cb(null, unique);
  },
});
const upload = multer({ storage });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(UPLOAD_DIR));

app.get("/api/notes", (req, res) => {
  const notes = readNotes();
  const { subject, year, q } = req.query;
  let filtered = notes;

  if (subject) {
    filtered = filtered.filter((n) => n.subject.toLowerCase() === subject.toLowerCase());
  }
  if (year) {
    filtered = filtered.filter((n) => n.year === year);
  }
  if (q) {
    const query = q.toLowerCase();
    filtered = filtered.filter(
      (n) =>
        n.title.toLowerCase().includes(query) ||
        n.subject.toLowerCase().includes(query) ||
        (n.content || "").toLowerCase().includes(query)
    );
  }

  res.json(filtered.sort((a, b) => b.createdAt - a.createdAt));
});

app.get("/api/notes/:id", (req, res) => {
  const notes = readNotes();
  const note = notes.find((n) => n.id === req.params.id);
  if (!note) return res.status(404).json({ error: "Note nahi mili" });
  res.json(note);
});

app.get("/api/subjects", (req, res) => {
  const notes = readNotes();
  const map = {};
  notes.forEach((n) => {
    map[n.subject] = (map[n.subject] || 0) + 1;
  });
  const subjects = Object.keys(map).map((s) => ({ name: s, count: map[s] }));
  res.json(subjects);
});

app.get("/api/stats", (req, res) => {
  const notes = readNotes();
  const subjects = new Set(notes.map((n) => n.subject));
  const yearCounts = {};
  ["1", "2", "3", "4"].forEach((y) => {
    yearCounts[y] = notes.filter((n) => n.year === y).length;
  });
  res.json({
    totalNotes: notes.length,
    totalSubjects: subjects.size,
    yearCounts,
  });
});

app.post("/api/notes", upload.single("pdf"), (req, res) => {
  const { title, subject, year, semester, content, password } = req.body;

  if (password !== ADMIN_PASSWORD) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(401).json({ error: "Galat password" });
  }

  if (!title || !subject) {
    return res.status(400).json({ error: "Title aur subject zaroori hai" });
  }

  const notes = readNotes();
  const newNote = {
    id: Date.now().toString(),
    title,
    subject,
    year: year || "",
    semester: semester || "",
    content: content || "",
    pdfFile: req.file ? req.file.filename : null,
    createdAt: Date.now(),
  };

  notes.push(newNote);
  writeNotes(notes);

  res.json({ success: true, note: newNote });
});

app.delete("/api/notes/:id", (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Galat password" });
  }

  const notes = readNotes();
  const note = notes.find((n) => n.id === req.params.id);
  if (!note) return res.status(404).json({ error: "Note nahi mili" });

  if (note.pdfFile) {
    const filePath = path.join(UPLOAD_DIR, note.pdfFile);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  const updated = notes.filter((n) => n.id !== req.params.id);
  writeNotes(updated);

  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server chal raha hai: http://localhost:${PORT}`);


