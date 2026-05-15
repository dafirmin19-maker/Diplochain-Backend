const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'diplochain-dev-secret-change-me';

// ─── CONFIG BLOCKCHAIN ───────────────────────────────────────────────────────
const INFURA_API_KEY = process.env.INFURA_API_KEY || '319a77a84980452c81ff56e695ffaf2e';
const CONTRACT_ADDRESS = '0xBF0674C9C6582B35Fdbe44ae41f286246A00A43E';

const CONTRACT_ABI = [
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true,  "internalType": "bytes32",  "name": "diplomaHash", "type": "bytes32" },
      { "indexed": false, "internalType": "string",   "name": "studentName", "type": "string"  },
      { "indexed": false, "internalType": "string",   "name": "degreeName",  "type": "string"  },
      { "indexed": false, "internalType": "address",  "name": "issuedBy",    "type": "address" },
      { "indexed": false, "internalType": "uint256",  "name": "issuedAt",    "type": "uint256" }
    ],
    "name": "DiplomaRegistered",
    "type": "event"
  }
];
// ─────────────────────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());

// ─── STOCKAGE EN MÉMOIRE ─────────────────────────────────────────────────────
let diplomas = [];

let users = [
  {
    id: 'usr_admin',
    fullName: 'Administrateur',
    email: 'admin@diplochain.com',
    password: 'Admin123',
    phone: null,
    institution: 'DiploChain',
    role: 'admin',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'usr_da_firmin',
    fullName: 'Da Firmin',
    email: 'da.firmin@example.com',
    password: 'Password123',
    phone: '+226 70 00 00 00',
    institution: 'Universite Polytechnique de Ouagadougou',
    role: 'student',
    createdAt: new Date().toISOString(),
  },
];
// ─────────────────────────────────────────────────────────────────────────────

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidBlockchainHash(hash) {
  return /^0x[0-9a-fA-F]{16,64}$/.test(hash);
}

function formatUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone || null,
    institution: user.institution || null,
    role: user.role,
    createdAt: user.createdAt,
  };
}

function getBaseUrl(req) {
  return `${req.protocol}://${req.get('host')}`;
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── MIDDLEWARE AUTH ──────────────────────────────────────────────────────────
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, error: 'Token manquant' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, error: 'Token invalide' });
    req.user = user;
    next();
  });
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── ROUTE RACINE ────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ message: 'DiploChain API is running', version: '2.0' });
});

// ─── ROUTES AUTH ─────────────────────────────────────────────────────────────

// LOGIN
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email et mot de passe requis.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, error: 'Adresse email invalide.' });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ success: false, error: 'Mot de passe invalide (min. 8 caractères).' });
  }

  const user = users.find(
    u => u.email.toLowerCase() === email.toLowerCase().trim() && u.password === password
  );

  if (!user) {
    return res.status(401).json({ success: false, error: 'Email ou mot de passe incorrect.' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({ success: true, token, user: formatUser(user) });
});

// INSCRIPTION
app.post('/api/auth/register', (req, res) => {
  const { fullName, email, password, phone, institution } = req.body;

  if (!fullName || !email || !password) {
    return res.status(400).json({ success: false, error: 'Nom, email et mot de passe requis.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, error: 'Adresse email invalide.' });
  }

  const exists = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
  if (exists) {
    return res.status(409).json({ success: false, error: 'Cet email est déjà utilisé.' });
  }

  const newUser = {
    id: `usr_${Date.now()}`,
    fullName: fullName.trim(),
    email: email.toLowerCase().trim(),
    password,
    phone: phone?.trim() || null,
    institution: institution?.trim() || null,
    role: 'student',
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);

  const token = jwt.sign(
    { id: newUser.id, email: newUser.email, role: newUser.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  console.log(`✅ Nouvel utilisateur : ${newUser.fullName} (${newUser.email})`);
  res.status(201).json({ success: true, token, user: formatUser(newUser) });
});

// PROFIL
app.get('/api/auth/me', authenticateToken, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
  res.json({ success: true, user: formatUser(user) });
});

app.get('/api/users/:id/profile', authenticateToken, (req, res) => {
  // Un utilisateur ne peut accéder qu'à son propre profil (sauf admin)
  if (req.user.id !== req.params.id && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Accès interdit.' });
  }
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
  res.json({ success: true, user: formatUser(user) });
});

// ─── ROUTES DIPLÔMES ─────────────────────────────────────────────────────────

// Liste des diplômes — filtrée par userId, vérification d'autorisation
app.get('/api/diplomas', authenticateToken, (req, res) => {
  const requestedUserId = req.query.user;

  // Si un userId est spécifié, vérifier que c'est le sien (ou admin)
  if (requestedUserId && requestedUserId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Accès interdit.' });
  }

  const userId = requestedUserId || req.user.id;
  const filtered = diplomas.filter(d => {
    // Filtrer par studentId si disponible, sinon retourner tous pour l'utilisateur connecté
    if (d.userId) return d.userId === userId;
    return true;
  });

  res.json({ success: true, data: filtered, total: filtered.length });
});

app.get('/api/diplomas/:id', authenticateToken, (req, res) => {
  const diploma = diplomas.find(d => d.id === req.params.id);
  if (!diploma) return res.status(404).json({ success: false, error: 'Diplôme non trouvé' });
  res.json({ success: true, diploma });
});

// Vérification par hash
app.get('/api/verify/:hash', (req, res) => {
  const { hash } = req.params;
  if (!isValidBlockchainHash(hash)) {
    return res.status(400).json({ success: false, error: 'Format de hash invalide.' });
  }
  const diploma = diplomas.find(d => d.blockchainHash === hash);
  if (!diploma) return res.status(404).json({ success: false, error: 'Diplôme non trouvé' });

  const publicVerificationUrl = `${req.protocol}://${req.get('host')}/api/public/diplomas/${encodeURIComponent(hash)}`;
  res.json({
    success: true,
    isVerified: true,
    data: { ...diploma, status: 'AUTHENTIQUE', publicVerificationUrl },
  });
});

// Route publique — validation hash + réponse normalisée
app.get('/api/public/diplomas/:hash', (req, res) => {
  const { hash } = req.params;

  if (!isValidBlockchainHash(hash)) {
    return res.status(400).json({ success: false, error: 'Format de hash invalide.' });
  }

  const diploma = diplomas.find(d => d.blockchainHash === hash);
  if (!diploma) return res.status(404).json({ success: false, error: 'Diplôme non trouvé' });

  const publicVerificationUrl = `${req.protocol}://${req.get('host')}/api/public/diplomas/${encodeURIComponent(hash)}`;
  res.json({
    success: true,
    data: {
      ...diploma,
      publicVerificationUrl,
    },
  });
});

// ─── ROUTE SANTÉ ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    diplomas: diplomas.length,
    users: users.length,
    blockchain: 'Sepolia',
    contract: CONTRACT_ADDRESS,
  });
});

// ─── ÉCOUTE BLOCKCHAIN ───────────────────────────────────────────────────────
async function startBlockchainListener() {
  try {
    const provider = new ethers.JsonRpcProvider(
      `https://sepolia.infura.io/v3/${INFURA_API_KEY}`
    );

    const network = await provider.getNetwork();
    console.log(`✅ Connecté à Sepolia (chainId: ${network.chainId})`);

    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

    contract.on('DiplomaRegistered', (diplomaHash, studentName, degreeName, issuedBy, issuedAt) => {
      console.log(`\n🎓 Nouveau diplôme détecté ! ${studentName}`);
      const newDiploma = {
        id: `diploma_${Date.now()}`,
        title: degreeName,
        university: 'Blockchain Sepolia',
        studentName,
        degreeName,
        issuedBy,
        blockchainHash: diplomaHash,
        isVerified: true,
        date: new Date(Number(issuedAt) * 1000).toISOString(),
        source: 'blockchain',
      };
      const exists = diplomas.find(d => d.blockchainHash === diplomaHash);
      if (!exists) {
        diplomas.push(newDiploma);
        console.log(`✅ Diplôme ajouté (total: ${diplomas.length})`);
      }
    });

    console.log('🔍 Récupération des diplômes existants sur la blockchain...');
    const filter = contract.filters.DiplomaRegistered();
    const events = await contract.queryFilter(filter, 0, 'latest');

    for (const event of events) {
      const { diplomaHash, studentName, degreeName, issuedBy, issuedAt } = event.args;
      const exists = diplomas.find(d => d.blockchainHash === diplomaHash);
      if (!exists) {
        diplomas.push({
          id: `diploma_${event.transactionHash}_${event.logIndex}`,
          title: degreeName,
          university: 'Blockchain Sepolia',
          studentName,
          degreeName,
          issuedBy,
          blockchainHash: diplomaHash,
          isVerified: true,
          date: new Date(Number(issuedAt) * 1000).toISOString(),
          source: 'blockchain_history',
        });
      }
    }

    console.log(`📚 ${events.length} diplôme(s) historique(s) chargé(s)`);
    console.log('👂 En écoute des nouveaux diplômes...\n');

  } catch (error) {
    console.error('❌ Erreur connexion blockchain :', error.message);
    console.log('⚠️  Le serveur continue sans écoute blockchain.');
  }
}

// ─── KEEP-ALIVE RENDER ───────────────────────────────────────────────────────
function startKeepAlive() {
  setInterval(() => {
    https.get('https://diplochain-backend-zg6l.onrender.com/api/health', (res) => {
      console.log(`🏓 Keep-alive ping → ${res.statusCode}`);
    }).on('error', (err) => {
      console.log(`⚠️ Keep-alive error: ${err.message}`);
    });
  }, 14 * 60 * 1000);
  console.log('🏓 Keep-alive démarré (ping toutes les 14 min)');
}

// ─── DÉMARRAGE ────────────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, async () => {
    console.log(`🚀 Serveur démarré sur le port ${PORT}`);
    await startBlockchainListener();
    startKeepAlive();
  });
} else {
  // Mode test : démarrer la blockchain en arrière-plan sans bloquer
  startBlockchainListener().catch(() => {});
}

module.exports = app;