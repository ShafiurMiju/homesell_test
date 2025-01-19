const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");
const cors = require("cors");
const mysql = require("mysql2/promise");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

app.use(
  cors({
    origin: "https://clientsellhometest.vercel.app", // Replace with your frontend URL
    credentials: true, // Allow cookies if needed
  })
);

app.options("*", cors());

app.use(bodyParser.json());

const dbConfig = {
  host: "162.214.68.40", // Replace with your database host
  user: "home9admin_sellhome9", // Replace with your MySQL username
  password: "Sell9Home", // Replace with your MySQL password
  database: "home9admin_SellHome9", // Replace with your database name
};

// x-api-key
const realEstateApiKey = "DIZWAY-74b8-7a65-97e2-a74e3aaf662d";

const autoCompleteApiUrl = "https://api.realestateapi.com/v2/AutoComplete";
const realEstateApiUrl = "https://api.realestateapi.com/v1/SkipTrace";
const propertyDetailApiUrl = "https://api.realestateapi.com/v2/PropertyDetail";
const propertyCompsApiUrl = "https://api.realestateapi.com/v3/PropertyComps";
const propertyAVMApiUrl = "https://api.realestateapi.com/v2/PropertyAvm";

app.get("/", (req, res) => {
  res.send("Welcome to the API system!");
});

// Login User (JWT)
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    // Connect to the database
    const connection = await mysql.createConnection(dbConfig);

    // Query the user by email
    const [results] = await connection.execute(
      "SELECT * FROM user WHERE email = ?",
      [email]
    );

    // Close the connection
    await connection.end();

    if (results.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = results[0];

    // Compare the provided password with the stored password
    if (password !== user.password) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    // Create a JWT token
    const token = jwt.sign({ id: user.id, email: user.email }, "JWT_SECRET", {
      expiresIn: "1h",
    });

    res.status(200).json({
      message: "Login successful",
      token, // Return the token
      user: {
        id: user.userId,
        email: user.email,
        name: user.firstName, // Assuming your table has a `name` column
      },
    });
  } catch (error) {
    console.error("Error during login:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get user info by userId
app.get("/api/user/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    // Connect to the database
    const connection = await mysql.createConnection(dbConfig);

    // Query user information
    const [results] = await connection.execute(
      "SELECT * FROM user WHERE userId = ?",
      [userId]
    );

    // Close the connection
    await connection.end();

    if (results.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Send user information
    res.status(200).json({ success: true, data: results[0] });
  } catch (error) {
    console.error("Error fetching user info:", error.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// API endpoint to check database connection
app.get("/api/db-check", async (req, res) => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    await connection.ping(); // Check the connection by pinging the server
    await connection.end();
    res.status(200).json({ message: "Database connection successful!" });
  } catch (error) {
    console.error("Database connection error:", error);
    res.status(500).json({ error: "Database connection failed." });
  }
});

//Auto Complete API
app.post("/api/autocomplete", async (req, res) => {
  try {
    const requestBody = req.body;

    // Make API request to external service
    const autoCompleteResponse = await axios.post(
      autoCompleteApiUrl,
      requestBody,
      {
        headers: {
          "x-api-key": realEstateApiKey,
          "Content-Type": "application/json",
        },
      }
    );

    res.json(autoCompleteResponse.data);
  } catch (error) {
    console.error(
      "Error occurred:",
      error.response?.status || 500,
      error.message
    );

    res.status(500).json({
      message: "An error occurred",
      error: error.message,
    });
  }
});

//Skiptrace API
app.post("/api/skiptrace", async (req, res) => {
  let connection;

  try {
    const requestBody = req.body;

    if (
      !requestBody.id ||
      !requestBody.fulladdress ||
      !requestBody.fulladdress.address
    ) {
      return res.status(400).json({
        success: false,
        message: "userId and full address details are required.",
      });
    }

    console.log("Request Body:", requestBody);

    // Connect to the database
    connection = await mysql.createConnection(dbConfig);

    // Check if skiptrace already exists
    const [existingRows] = await connection.execute(
      "SELECT * FROM userActions WHERE userId = ? AND Skiptrace = ?",
      [requestBody.id, requestBody.fulladdress.address]
    );

    if (existingRows.length > 0) {
      // Call the Real Estate API
      const realEstateResponse = await axios.post(
        realEstateApiUrl,
        requestBody.fulladdress,
        {
          headers: {
            "x-api-key": realEstateApiKey,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("Real Estate API Response:", realEstateResponse.data);

      // Send success response with API data
      return res.status(201).json({
        success: true,
        message: "Skiptrace record found and API data fetched.",
        data: realEstateResponse.data,
      });
    }

    // If skiptrace doesn't exist, insert a new record in `userActions` table
    const [insertResult] = await connection.execute(
      "INSERT INTO userActions (userId, Skiptrace, date) VALUES (?, ?, ?)",
      [requestBody.id, requestBody.fulladdress.address, new Date()]
    );

    console.log("Inserted new record into userActions:", insertResult.insertId);

    // Call the Real Estate API
    const realEstateResponse = await axios.post(
      realEstateApiUrl,
      requestBody.fulladdress,
      {
        headers: {
          "x-api-key": realEstateApiKey,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Real Estate API Response:", realEstateResponse.data);

    // Send success response with API data
    res.status(201).json({
      success: true,
      message: "Skiptrace record created successfully and API data fetched.",
      data: realEstateResponse.data,
    });
  } catch (error) {
    console.error("Error occurred:", error.message);

    // Handle and send error response
    res.status(500).json({
      success: false,
      message: "An error occurred while processing skiptrace.",
      error: error.message,
    });
  } finally {
    // Ensure the database connection is closed
    if (connection) {
      await connection.end();
    }
  }
});

// Property Detail API
app.post("/api/property-detail", async (req, res) => {
  try {
    const requestBody = req.body;

    // Call the PropertyDetail API
    const propertyDetailResponse = await axios.post(
      propertyDetailApiUrl,
      requestBody,
      {
        headers: {
          "x-api-key": realEstateApiKey,
          "Content-Type": "application/json",
        },
      }
    );

    res.json({
      message: "Property detail data processed successfully",
      data: propertyDetailResponse.data,
    });
  } catch (error) {
    console.error("Error occurred:", error.message);

    if (!res.headersSent) {
      return res.status(500).json({
        message: "An error occurred",
        error: error.message,
      });
    }
  }
});

// Coms Property API
app.post("/api/property-comps", async (req, res) => {
  try {
    const requestBody = req.body;

    // Call the Property Comparables API
    const propertyCompsResponse = await axios.post(
      propertyCompsApiUrl,
      requestBody,
      {
        headers: {
          "x-api-key": realEstateApiKey,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(
      "Response from Property Comps API:",
      propertyCompsResponse.data
    );
  } catch (error) {
    console.error("Error occurred:", error.message);
    res
      .status(500)
      .json({ message: "An error occurred", error: error.message });
  }
});

//AVM
app.post("/api/property-avm", async (req, res) => {
  try {
    const requestBody = req.body;

    const email = { email: requestBody.email };

    // Call the Property Comparables API
    const propertyAVMResponse = await axios.post(
      propertyAVMApiUrl,
      requestBody,
      {
        headers: {
          "x-api-key": "DIZWAYADDONTEST-b049-72ca-a511-0035c08f2559",
          "Content-Type": "application/json",
        },
      }
    );

    console.log(propertyAVMResponse.data);

    res.json({
      message: "Property AVM data processed successfully",
      data: propertyAVMResponse.data,
    });
  } catch (error) {
    console.error("Error occurred:", error.message);
    res
      .status(500)
      .json({ message: "An error occurred", error: error.message });
  }
});

//Reduce Credit
app.post("/api/reduce-credit", async (req, res) => {
  const { userId, amount } = req.body;

  // Validate input
  if (!userId || !amount || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: "Valid userId and a positive amount are required.",
    });
  }

  try {
    // Connect to the database
    const connection = await mysql.createConnection(dbConfig);

    // Check the current credit of the user
    const [userRows] = await connection.execute(
      "SELECT credit FROM user WHERE userId = ?",
      [userId]
    );

    if (userRows.length === 0) {
      await connection.end();
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    const currentCredit = userRows[0].credit;

    // Ensure there is enough credit
    if (currentCredit < amount) {
      await connection.end();
      return res.status(400).json({
        success: false,
        message: "Insufficient credits.",
      });
    }

    // Reduce the user's credit
    const [result] = await connection.execute(
      "UPDATE user SET credit = credit - ? WHERE userId = ?",
      [amount, userId]
    );

    // Close the connection
    await connection.end();

    res.status(200).json({
      success: true,
      message: "Credit reduced successfully.",
      remainingCredit: currentCredit - amount,
    });
  } catch (error) {
    console.error("Error reducing credit:", error.message);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
