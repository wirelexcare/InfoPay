// Vercel serverless entry. An Express app instance is itself a
// (req, res) request handler, so exporting it as the default handler is all
// Vercel's @vercel/node runtime needs. The app is imported from the backend's
// compiled output (backend/dist) which the build step produces, so there's no
// TypeScript/ESM resolution to do at bundle time.
import app from "../backend/dist/app.js";

export default app;
