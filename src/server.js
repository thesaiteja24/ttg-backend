import { configDotenv } from "dotenv";
import { app } from "./app.js";
import { connectDB } from "./db/index.js";

configDotenv({ quiet: true });

const PORT = process.env.PORT;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to connect to the database:", error);
    process.exit(1); // Exit the process with failure
  });
