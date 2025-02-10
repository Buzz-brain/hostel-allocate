const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3000;

// Middleware
app.set('view engine', 'ejs');

// Serve static files (e.g., CSS)
app.use(express.static('public'));

// Home Route
app.get('/', (req, res) => {
    res.render('index');
});
// Home Route
app.get('/login', (req, res) => {
    res.render('login');
});
// Home Route
app.get('/admin', (req, res) => {
    res.render('admin');
});
// Render Register Page
app.get('/register', (req, res) => {
    res.render('register');
});

app.get('/dashboard', (req, res) => {
    res.render('dashboard');
});

// Connect to MongoDB
mongoose.connect('mongodb+srv://chinomsochristian03:ahYZxLh5loYrfgss@cluster0.dmkcl.mongodb.net/hostel-assign?retryWrites=true&w=majority');

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
    console.log('Connected to MongoDB');
});

// Define the schemas
const studentSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: String,
    role: { type: String, default: 'student' },
    phone: String,
    hostel: String,
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    preferences: {
        lightCondition: String,
        noiseLevel: String,
        readingTime: String
    }
});

const adminSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: String,
    role: { type: String, default: 'admin' },
    phone: String
});

const roomSchema = new mongoose.Schema({
    roomId: String,
    hostel: String,
    preferences: {
        lightCondition: String,
        noiseLevel: String,
        readingTime: String
    },
    occupants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }]
});


// Create the models
const Student = mongoose.model('Student', studentSchema);
const Admin = mongoose.model('Admin', adminSchema);
const Room = mongoose.model('Room', roomSchema);


// Middleware to parse JSON bodies
app.use(express.json());

// Route for registration
app.post('/register', async (req, res) => {
    const { name, email, password, role, phone } = req.body;

    // Check if the user already exists
    const existingUser = await Student.findOne({ email }) || await Admin.findOne({ email });
    if (existingUser) {
        return res.json({ message: 'User already exists' });
    }

    // Validate the user's request
    if (!name || !email || !password || !role || !phone) {
        return res.json({ message: 'Please fill in all fields' });
    }

    if (password.length < 4) {
        return res.json({ message: 'Password must be at least 4 characters' });
    }

    if (role !== 'admin' && role !== 'student') {
        return res.json({ message: 'Invalid role' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    if (role === 'admin') {
        const admin = new Admin({ name, email, password: hashedPassword, role, phone });
        await admin.save();
        res.json({ message: 'Admin registered successfully' });
    } else {
        const student = new Student({ name, email, password: hashedPassword, phone });
        await student.save();
        res.json({ message: 'Student registered successfully' });
    }
});



app.post('/verify-token', async (req, res) => {
    const { token } = req.body;

    try {
        const decoded = jwt.verify(token, 'secretkey');
        res.json({ valid: true });
    } catch (error) {
        res.json({ valid: false });
    }
});


// Route for login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Validate the user's request
  if (!email || !password) {
    return res.json({ message: 'Please fill in all fields' });
  }

  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+.[a-zA-Z]{2,}$/.test(email)) {
    return res.json({ message: 'Invalid email format' });
  }

  if (password.length < 4) {
    return res.json({ message: 'Password must be at least 4 characters' });
  }

  let user = await Student.findOne({ email });
  if (!user) {
    user = await Admin.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
  }

  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const token = jwt.sign({ userId: user._id, role: user.role }, 'secretkey', { expiresIn: '1h' });
  const message = "Login Successful"
  res.json({ token, user, message });
});



// Route to assign hostel and get preferences
app.post('/assign-hostel', async (req, res) => {
    const { userId, hostel, preferences } = req.body;
    console.log(req.body)

    // Validate the request
    if (!userId || !hostel || !preferences) {
        return res.json({ message: 'Please fill in all fields' });
    }

    const requiredPreferences = ['lightCondition', 'noiseLevel', 'readingTime'];
    if (!requiredPreferences.every(preference => preference in preferences)) {
        return res.json({ message: 'Please provide all preferences' });
    }

    const user = await Student.findById(userId);
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }


    console.log(user.hostel)
    // Check if user has already been assigned a hostel
    if (user.hostel !== undefined) {
        return res.json({ message: 'You have already been assigned to a hostel' });
    }


    user.hostel = hostel;
    user.preferences = preferences;
    await user.save();
    res.json({ message: `You have been assigned to ${hostel} and preferences saved` });
});


  app.get('/get-user-data', async (req, res) => {
    const userId = req.query.userId;
    const user = await Student.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    const roomId = user.room;
    if (!roomId) {
      return res.json({ message: 'User has no room assigned' });
    }
    const room = await Room.findById(roomId);
    const roommates = await Student.find({ room: roomId });
    res.json({ user, roommates });
  });


// Route to assign room
app.post('/assign-room', async (req, res) => {
  const { userId } = req.body;
  const user = await Student.findById(userId);
  console.log(user)

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  // Check if the user has a hostel assigned
  if (!user.hostel) {
    return res.status(400).json({ message: 'Hostel must be assigned before assigning a room' });
  }

  // Check if the user is already assigned a room
  if (user.room) {
    return res.json({ message: 'You are already assigned a room' });
  }

  const room = await Room.findOne({ hostel: user.hostel, preferences: user.preferences });
  if (!room) {
    // Create a new room if no matching room is found
    const newRoom = new Room({ hostel: user.hostel, preferences: user.preferences, occupants: [user._id] });
    await newRoom.save();
    user.room = newRoom._id;
    // Update the user's room ID
    await user.save();
    res.json({ roomId: newRoom._id });
    // Return the room ID
  } else {
    // Check if the user is already in the room
    if (!room.occupants.includes(user._id)) {
      // Add user to existing room
      room.occupants.push(user._id);
      await room.save();
      user.room = room._id;
      // Update the user's room ID
      await user.save();
      res.json({ roomId: room._id });
      // Return the room ID
    } else {
      res.json({ message: 'User is already in the room' });
    }
  }
});



// Route to get roommates
app.get('/get-roommates', async (req, res) => {
    const { roomId } = req.query;
    const room = await Room.findById(roomId);

    if (!room || !roomId) {
        return res.status(404).json({ message: 'Room not found' });
    }

    const roommates = await Student.find({ _id: { $in: room.occupants } });
    res.json({ roommates });
});









// Admin 

app.get('/get-room-count', async (req, res) => {
    try {
      const roomCount = await Room.countDocuments();
      res.json({ roomCount });
    } catch (err) {
      res.status(500).json({ message: 'Error fetching room count' });
    }
  });
  

  app.get('/get-student-count', async (req, res) => {
    try {
      const studentCount = await Student.countDocuments();
      res.json({ studentCount });
    } catch (err) {
      res.status(500).json({ message: 'Error fetching student count' });
    }
  });
  

  app.get('/get-students-without-roommate', async (req, res) => {
    try {
      const studentsWithoutRoommate = await Student.find({
        room: { $exists: true },
      }).populate('room').then(students => {
        return students.filter(student => student.room.occupants.length === 1);
      });
      res.json({ studentsWithoutRoommate });
    } catch (err) {
      res.status(500).json({ message: 'Error fetching students without roommate' });
    }
  });
  
  
  app.get('/get-students-with-roommate', async (req, res) => {
    try {
      const studentsWithRoommate = await Student.find({
        room: { $exists: true },
      }).populate('room').then(students => {
        return students.filter(student => student.room.occupants.length > 1);
      });
      res.json({ studentsWithRoommate });
    } catch (err) {
      res.status(500).json({ message: 'Error fetching students with roommate' });
    }
  });
  
  
  

  app.get('/get-students-ranked', async (req, res) => {
    try {
      const students = await Student.find().sort({ createdAt: -1 });
      res.json({ students });
    } catch (err) {
      res.status(500).json({ message: 'Error fetching students' });
    }
  });
  
  app.get('/get-student-details', async (req, res) => {
    try {
      const rooms = await Room.find();
      const roomIds = rooms.map(room => room._id.toString());
      const students = await Student.find().populate('room');
      const studentDetails = students.map(student => {
        const roomNumber = roomIds.indexOf(student.room._id.toString()) + 1;
        const status = student.room.occupants.length > 1 ? 'Allocated' : 'Not Allocated';
        return {
          name: student.name,
          roomNumber,
          hostelName: student.hostel,
          status
        };
      });
      res.json({ studentDetails });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Error fetching student details' });
    }
  });
  
  

// Start the server
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});

