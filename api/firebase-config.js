// Vercel Serverless Function
// Halkan waxaa lagu akhriyaa Environment Variables-ka aad gelisay Vercel Dashboard
// (Settings -> Environment Variables), oo aan marnaba ku jirin GitHub repo-ga.

export default function handler(req, res) {
    // Allow only GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    res.status(200).json({
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID,
        measurementId: process.env.FIREBASE_MEASUREMENT_ID
    });
}
