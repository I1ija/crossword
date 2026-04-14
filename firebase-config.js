/**
 * firebase-config.js
 *
 * HOW TO FILL THIS IN:
 * 1. Go to https://console.firebase.google.com
 * 2. Click "Add project" → give it a name (e.g. "my-crossword")
 * 3. Once created, click the </> (web) icon to register a web app
 * 4. Copy the firebaseConfig object and paste the values below
 * 5. In the Firebase Console:
 *    - Go to "Firestore Database" → Create database → Start in production mode
 *    - Go to "Authentication" → Get started → Email/Password → Enable it
 *    - Go to "Authentication" → Users → Add user → enter YOUR email & password
 * 6. In Firestore → Rules, paste this and click Publish:
 *
 *   rules_version = '2';
 *   service cloud.firestore {
 *     match /databases/{database}/documents {
 *       match /puzzles/{puzzleId} {
 *         allow read: if true;
 *         allow write: if request.auth != null;
 *       }
 *     }
 *   }
 */

const firebaseConfig = {
  apiKey: "AIzaSyDPqDrHmOp_Lzx-x0PyOWc0zces2_Gsd8g",
  authDomain: "crossword-90fc5.firebaseapp.com",
  projectId: "crossword-90fc5",
  storageBucket: "crossword-90fc5.firebasestorage.app",
  messagingSenderId: "1004617329406",
  appId: "1:1004617329406:web:c122f6afa758fba6e8d3af",
};
firebase.initializeApp(firebaseConfig);
